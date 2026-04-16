"""Vercel serverless function: POST /api/detect-penny — run Roboflow penny detection."""
import os
import json
from http.server import BaseHTTPRequestHandler
from inference_sdk import InferenceHTTPClient

UPLOAD_DIR = "/tmp/uploads"

client = InferenceHTTPClient(
    api_url="https://serverless.roboflow.com",
    api_key="jIlsPhHeCYPv0LCOooQT",
)


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
            result = client.run_workflow(
                workspace_name="michael-h89ju",
                workflow_id="penny-area-measurement-pipeline-1776292482637",
                images={"image": full},
                use_cache=True,
            )
            self._json(200, {"result": result})
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
