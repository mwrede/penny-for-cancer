"""Vercel serverless function: POST /api/upload — upload an image file.
Uses struct to read image dimensions instead of PIL to avoid large dependencies."""
import os
import json
import uuid
import struct
from http.server import BaseHTTPRequestHandler
import cgi

UPLOAD_DIR = "/tmp/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def get_image_size(path):
    """Get image dimensions without PIL — supports JPEG, PNG, GIF, BMP, WebP."""
    with open(path, "rb") as f:
        head = f.read(32)

        # PNG
        if head[:8] == b'\x89PNG\r\n\x1a\n':
            w, h = struct.unpack('>II', head[16:24])
            return w, h

        # GIF
        if head[:6] in (b'GIF87a', b'GIF89a'):
            w, h = struct.unpack('<HH', head[6:10])
            return w, h

        # BMP
        if head[:2] == b'BM':
            w, h = struct.unpack('<ii', head[18:26])
            return w, abs(h)

        # JPEG
        if head[:2] == b'\xff\xd8':
            f.seek(2)
            while True:
                marker, size = struct.unpack('>HH', f.read(4))
                if 0xFFC0 <= marker <= 0xFFC3:
                    f.read(1)  # precision
                    h, w = struct.unpack('>HH', f.read(4))
                    return w, h
                f.seek(size - 2, 1)
                if f.tell() > 1_000_000:
                    break

        # WebP
        if head[:4] == b'RIFF' and head[8:12] == b'WEBP':
            if head[12:16] == b'VP8 ':
                w = (head[26] | (head[27] << 8)) & 0x3FFF
                h = (head[28] | (head[29] << 8)) & 0x3FFF
                return w, h

    return 1920, 1080  # fallback


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            self._json(400, {"error": "Expected multipart/form-data"})
            return

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

        w, h = get_image_size(path)
        self._json(200, {"filename": name, "width": w, "height": h})

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
        self.wfile.write(json.dumps(data).encode())
