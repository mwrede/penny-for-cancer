"""Vercel serverless function: POST /api/classify-mole — AI classification against MIDAS."""
import os
import json
import uuid
import base64
from http.server import BaseHTTPRequestHandler
from inference_sdk import InferenceHTTPClient

UPLOAD_DIR = "/tmp/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

client = InferenceHTTPClient(
    api_url="https://serverless.roboflow.com",
    api_key="jIlsPhHeCYPv0LCOooQT",
)


def parse_classification(result):
    if not result or not isinstance(result, list):
        return {"label": "unknown", "confidence": 0}
    for item in result:
        for key, val in item.items():
            if isinstance(val, dict):
                if "class" in val:
                    return {"label": val.get("class", "unknown"), "confidence": round(val.get("confidence", 0) * 100, 1)}
                if "predictions" in val:
                    preds = val["predictions"]
                    if isinstance(preds, dict):
                        top = val.get("top", "")
                        top_conf = preds.get(top, {}).get("confidence", 0)
                        return {"label": top, "confidence": round(top_conf * 100, 1)}
                    if isinstance(preds, list) and len(preds) > 0:
                        p = preds[0]
                        return {"label": p.get("class", "unknown"), "confidence": round(p.get("confidence", 0) * 100, 1)}
            if isinstance(val, list) and len(val) > 0:
                p = val[0]
                if isinstance(p, dict) and "class" in p:
                    return {"label": p["class"], "confidence": round(p.get("confidence", 0) * 100, 1)}
    return {"label": "unknown", "confidence": 0}


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        data = json.loads(self.rfile.read(length))
        image_b64 = data.get("image_base64")
        if not image_b64:
            self._json(400, {"error": "No image data"})
            return

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
            prediction = parse_classification(result)
            prediction["crop_filename"] = crop_name
            self._json(200, prediction)
        except Exception as e:
            self._json(500, {"error": str(e)})

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _json(self, status, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())
