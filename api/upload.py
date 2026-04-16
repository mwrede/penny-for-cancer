"""Vercel serverless function: POST /api/upload — upload an image file."""
import os
import json
import uuid
from http.server import BaseHTTPRequestHandler
from PIL import Image
from io import BytesIO
import cgi

UPLOAD_DIR = "/tmp/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            self._json(400, {"error": "Expected multipart/form-data"})
            return

        # Parse multipart
        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={"REQUEST_METHOD": "POST", "CONTENT_TYPE": content_type},
        )
        file_item = form["image"]
        if not file_item.filename:
            self._json(400, {"error": "No image"})
            return

        ext = os.path.splitext(file_item.filename)[1] or ".jpg"
        name = uuid.uuid4().hex + ext
        path = os.path.join(UPLOAD_DIR, name)
        with open(path, "wb") as f:
            f.write(file_item.file.read())

        img = Image.open(path)
        w, h = img.size
        self._json(200, {"filename": name, "width": w, "height": h})

    def _json(self, status, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
