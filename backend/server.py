import os
import json
import uuid
import math
from datetime import datetime

from PIL import Image
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from inference_sdk import InferenceHTTPClient

app = Flask(__name__)
CORS(app)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
DATA_FILE = os.path.join(os.path.dirname(__file__), "moles.json")
os.makedirs(UPLOAD_DIR, exist_ok=True)

PENNY_AREA_SQ_INCHES = 0.448

client = InferenceHTTPClient(
    api_url="https://serverless.roboflow.com",
    api_key="jIlsPhHeCYPv0LCOooQT",
)


def load_moles():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE) as f:
            return json.load(f)
    return []


def save_moles_db(moles):
    with open(DATA_FILE, "w") as f:
        json.dump(moles, f, indent=2)


@app.route("/api/upload", methods=["POST"])
def upload():
    if "image" not in request.files:
        return jsonify({"error": "No image"}), 400
    f = request.files["image"]
    ext = os.path.splitext(f.filename)[1] or ".jpg"
    name = uuid.uuid4().hex + ext
    path = os.path.join(UPLOAD_DIR, name)
    f.save(path)
    img = Image.open(path)
    w, h = img.size
    return jsonify({"filename": name, "width": w, "height": h})


@app.route("/uploads/<path:filename>")
def serve_upload(filename):
    return send_from_directory(UPLOAD_DIR, filename)


@app.route("/api/detect-penny", methods=["POST"])
def detect_penny():
    data = request.get_json()
    image_b64 = data.get("image_base64")
    if not image_b64:
        return jsonify({"error": "No image data"}), 400
    # Save base64 to temp file for SDK
    import base64
    img_bytes = base64.b64decode(image_b64)
    temp_name = f"penny_{uuid.uuid4().hex[:8]}.jpg"
    temp_path = os.path.join(UPLOAD_DIR, temp_name)
    with open(temp_path, "wb") as f:
        f.write(img_bytes)
    try:
        result = client.run_workflow(
            workspace_name="michael-h89ju",
            workflow_id="penny-area-measurement-pipeline-1776292482637",
            images={"image": temp_path},
            use_cache=True,
        )
        print("=== ROBOFLOW RESPONSE ===")
        print(json.dumps(result, indent=2, default=str))
        print("=========================")
        return jsonify({"result": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/calculate", methods=["POST"])
def calculate():
    data = request.get_json()
    mask_px = data.get("mask_pixel_count", 0)
    penny_pixel_area = data.get("penny_pixel_area", 0)

    if not penny_pixel_area or not mask_px:
        return jsonify({"error": "Missing data"}), 400

    if penny_pixel_area <= 0:
        return jsonify({"error": "Bad penny area"}), 400

    sq_in_per_px = PENNY_AREA_SQ_INCHES / penny_pixel_area
    mole_area_in = mask_px * sq_in_per_px
    mole_area_mm = mole_area_in * 645.16
    mole_diam_in = 2 * math.sqrt(mole_area_in / math.pi)
    mole_diam_mm = mole_diam_in * 25.4

    return jsonify({
        "penny_pixel_area": round(penny_pixel_area, 1),
        "mole_pixel_count": mask_px,
        "mole_area_sq_inches": round(mole_area_in, 4),
        "mole_area_sq_mm": round(mole_area_mm, 2),
        "mole_diameter_inches": round(mole_diam_in, 4),
        "mole_diameter_mm": round(mole_diam_mm, 2),
    })


@app.route("/api/classify-mole", methods=["POST"])
def classify_mole():
    """Receive a cropped mole image (base64 JPEG), save it, and run through
    the skin-cancer classification workflow (custom-workflow-11).
    Returns the prediction label (yes/no) and confidence."""
    data = request.get_json()
    image_b64 = data.get("image_base64")
    if not image_b64:
        return jsonify({"error": "No image data"}), 400

    # Decode and save as a temp file for Roboflow
    import base64
    img_bytes = base64.b64decode(image_b64)
    crop_name = f"crop_{uuid.uuid4().hex[:8]}.jpg"
    crop_path = os.path.join(UPLOAD_DIR, crop_name)
    with open(crop_path, "wb") as f:
        f.write(img_bytes)

    try:
        result = client.run_workflow(
            workspace_name="michael-h89ju",
            workflow_id="custom-workflow-11",
            images={"image": crop_path},
            use_cache=True,
        )
        print("=== CLASSIFY RESPONSE ===")
        print(json.dumps(result, indent=2, default=str))
        print("=========================")

        # Parse the classification result
        prediction = parse_classification(result)
        prediction["crop_filename"] = crop_name
        return jsonify(prediction)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def parse_classification(result):
    """Extract yes/no label and confidence from the workflow response."""
    if not result or not isinstance(result, list):
        return {"label": "unknown", "confidence": 0}

    for item in result:
        # Check common workflow output structures
        for key, val in item.items():
            if isinstance(val, dict):
                # Direct classification output: {class: "yes", confidence: 0.87}
                if "class" in val:
                    return {
                        "label": val.get("class", "unknown"),
                        "confidence": round(val.get("confidence", 0) * 100, 1),
                    }
                # Nested predictions
                if "predictions" in val:
                    preds = val["predictions"]
                    if isinstance(preds, dict):
                        # Classification format: {predictions: {yes: {confidence: 0.8}, no: ...}, top: "yes"}
                        top = val.get("top", "")
                        top_conf = preds.get(top, {}).get("confidence", 0)
                        return {
                            "label": top,
                            "confidence": round(top_conf * 100, 1),
                        }
                    if isinstance(preds, list) and len(preds) > 0:
                        p = preds[0]
                        return {
                            "label": p.get("class", "unknown"),
                            "confidence": round(p.get("confidence", 0) * 100, 1),
                        }
            if isinstance(val, list) and len(val) > 0:
                p = val[0]
                if isinstance(p, dict) and "class" in p:
                    return {
                        "label": p["class"],
                        "confidence": round(p.get("confidence", 0) * 100, 1),
                    }

    return {"label": "unknown", "confidence": 0}


@app.route("/api/moles", methods=["GET"])
def get_moles():
    return jsonify(load_moles())


@app.route("/api/moles", methods=["POST"])
def save_mole():
    data = request.get_json()
    moles = load_moles()
    record = {
        "id": uuid.uuid4().hex[:8],
        "name": data.get("name", "Unnamed"),
        "date": data.get("date", datetime.now().strftime("%Y-%m-%d")),
        "image_filename": data.get("image_filename"),
        "mask_pixel_count": data.get("mask_pixel_count"),
        "measurements": data.get("measurements"),
        "classification": data.get("classification"),
        "crop_image": data.get("crop_image"),
        "notes": data.get("notes", ""),
    }
    moles.append(record)
    save_moles_db(moles)
    return jsonify(record)


@app.route("/api/moles", methods=["DELETE"])
def delete_mole():
    mole_id = request.args.get("id")
    if mole_id:
        moles = [m for m in load_moles() if m["id"] != mole_id]
        save_moles_db(moles)
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(debug=True, port=5001)
