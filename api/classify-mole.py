"""Vercel serverless function: POST /api/classify-mole — AI classification via Roboflow HTTP API."""
import os
import json
import uuid
import base64
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler

UPLOAD_DIR = "/tmp/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

API_KEY = "jIlsPhHeCYPv0LCOooQT"
WORKSPACE = "michael-h89ju"
WORKFLOW_ID = "custom-workflow-11"


def parse_classification(result):
    """Extract yes/no label and confidence from workflow response."""
    # Handle both {"outputs": [...]} and direct list formats
    items = result
    if isinstance(result, dict) and "outputs" in result:
        items = result["outputs"]
    if not items or not isinstance(items, list):
        return {"label": "unknown", "confidence": 0}

    for item in items:
        if not isinstance(item, dict):
            continue
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

        try:
            # Call Roboflow workflow API directly with base64 image
            url = f"https://serverless.roboflow.com/{WORKSPACE}/workflows/{WORKFLOW_ID}"
            payload = json.dumps({
                "api_key": API_KEY,
                "inputs": {
                    "image": {"type": "base64", "value": image_b64}
                }
            }).encode("utf-8")

            req = urllib.request.Request(
                url,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=25) as resp:
                result = json.loads(resp.read().decode("utf-8"))

            prediction = parse_classification(result)
            crop_name = f"crop_{uuid.uuid4().hex[:8]}.jpg"
            prediction["crop_filename"] = crop_name
            self._json(200, prediction)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            self._json(500, {"error": f"Roboflow API error {e.code}: {body}"})
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
