"""Vercel serverless function: POST /api/calculate — compute mole size from pixel data."""
import json
import math
from http.server import BaseHTTPRequestHandler

PENNY_AREA_SQ_INCHES = 0.448


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        data = json.loads(self.rfile.read(length))
        mask_px = data.get("mask_pixel_count", 0)
        penny_pixel_area = data.get("penny_pixel_area", 0)

        if not penny_pixel_area or not mask_px:
            self._json(400, {"error": "Missing data"})
            return
        if penny_pixel_area <= 0:
            self._json(400, {"error": "Bad penny area"})
            return

        sq_in_per_px = PENNY_AREA_SQ_INCHES / penny_pixel_area
        mole_area_in = mask_px * sq_in_per_px
        mole_area_mm = mole_area_in * 645.16
        mole_diam_in = 2 * math.sqrt(mole_area_in / math.pi)
        mole_diam_mm = mole_diam_in * 25.4

        self._json(200, {
            "penny_pixel_area": round(penny_pixel_area, 1),
            "mole_pixel_count": mask_px,
            "mole_area_sq_inches": round(mole_area_in, 4),
            "mole_area_sq_mm": round(mole_area_mm, 2),
            "mole_diameter_inches": round(mole_diam_in, 4),
            "mole_diameter_mm": round(mole_diam_mm, 2),
        })

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
