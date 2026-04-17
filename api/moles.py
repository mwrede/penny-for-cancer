"""Vercel serverless function: GET/POST /api/moles — mole records.
Note: On Vercel, /tmp is ephemeral. For production, use a database.
This uses /tmp/moles.json as a session-level store."""
import os
import json
import uuid
from datetime import datetime
from http.server import BaseHTTPRequestHandler

DATA_FILE = "/tmp/moles.json"


def load_moles():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE) as f:
            return json.load(f)
    return []


def save_moles(moles):
    with open(DATA_FILE, "w") as f:
        json.dump(moles, f, indent=2)


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self._json(200, load_moles())

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        data = json.loads(self.rfile.read(length))
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
            "avatar_config": data.get("avatar_config"),
            "abc_analysis": data.get("abc_analysis"),
            "notes": data.get("notes", ""),
        }
        moles.append(record)
        save_moles(moles)
        self._json(200, record)

    def do_DELETE(self):
        # Extract mole ID from query string
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        mole_id = params.get("id", [None])[0]
        if mole_id:
            moles = [m for m in load_moles() if m["id"] != mole_id]
            save_moles(moles)
        self._json(200, {"ok": True})

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _json(self, status, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
