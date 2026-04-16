"""Vercel serverless function: POST /api/detect-penny — run Roboflow penny detection via HTTP API."""
import os
import json
import base64
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler

UPLOAD_DIR = "/tmp/uploads"
API_KEY = "jIlsPhHeCYPv0LCOooQT"
WORKSPACE = "michael-h89ju"
WORKFLOW_ID = "penny-area-measurement-pipeline-1776292482637"


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        data = json.loads(self.rfile.read(length))
        filename = data.get("image_path")
        if not filename:
            self._json(400, {"error": "No image_path"})
            return

        full = os.path.join(UPLOAD_DIR, filename)
        if not os.path.exists(full):
            self._json(404, {"error": "Not found"})
            return

        try:
            # Read image and encode as base64
            with open(full, "rb") as f:
                img_b64 = base64.b64encode(f.read()).decode("utf-8")

            # Call Roboflow workflow API directly
            url = f"https://serverless.roboflow.com/{WORKSPACE}/workflows/{WORKFLOW_ID}"
            payload = json.dumps({
                "api_key": API_KEY,
                "inputs": {
                    "image": {"type": "base64", "value": img_b64}
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

            # The workflow API returns {"outputs": [...]}
            outputs = result.get("outputs", result)
            self._json(200, {"result": outputs})
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
