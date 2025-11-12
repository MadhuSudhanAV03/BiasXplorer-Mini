from datetime import datetime
from reportlab.lib.utils import ImageReader
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas as rl_canvas
from flask import request, jsonify
from flask.views import MethodView
from flask_smorest import Blueprint
import os
from flask import send_from_directory
import io
import base64
import matplotlib
matplotlib.use("Agg")
ALLOWED_EXTENSIONS = {"csv", "xls", "xlsx"}
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
REPORTS_DIR = os.path.join(BASE_DIR, "reports")
CORRECTED_DIR = os.path.join(BASE_DIR, "corrected")
blp = Blueprint("Reports", __name__, url_prefix="/api",
                description="Report endpoints")


@blp.route("/reports/generate")
class GenerateReport(MethodView):
    def post(self):
        """Generate a PDF report compiling bias detection and correction results.
        Input JSON:
        {
          "bias_summary": {...},
          "correction_summary": {...},
          "visualizations": {"before_chart": "<base64>", "after_chart": "<base64>"}
        }
        Saves as reports/report_<timestamp>.pdf and returns its relative path.
        """
        try:
            payload = request.get_json(silent=True) or {}
            bias_summary = payload.get("bias_summary", {})
            correction_summary = payload.get("correction_summary", {})
            visualizations = payload.get("visualizations", {})

            if not isinstance(bias_summary, dict):
                return jsonify({"error": "'bias_summary' must be an object."}), 400
            if not isinstance(correction_summary, dict):
                return jsonify({"error": "'correction_summary' must be an object."}), 400
            if not isinstance(visualizations, dict):
                return jsonify({"error": "'visualizations' must be an object."}), 400

            os.makedirs(REPORTS_DIR, exist_ok=True)
            ts = datetime.now().strftime("%Y_%m_%d_%H%M%S")
            filename = f"report_{ts}.pdf"
            pdf_path = os.path.join(REPORTS_DIR, filename)

            c = rl_canvas.Canvas(pdf_path, pagesize=letter)
            width, height = letter
            margin = 50
            y = height - margin

            def write_line(text: str, fontsize: int = 11, leading: int = 16):
                nonlocal y
                if y < margin + leading:
                    c.showPage()
                    y = height - margin
                c.setFont("Helvetica", fontsize)
                c.drawString(margin, y, text)
                y -= leading

            # Title
            c.setTitle("BiasXplorer - Categorical Bias Report")
            write_line("BiasXplorer - Categorical Bias Report",
                       fontsize=16, leading=22)
            write_line(
                f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", fontsize=10, leading=14)
            y -= 6

            # Dataset summary (if any info can be derived)
            write_line("Dataset summary:", fontsize=13, leading=18)
            # If correction_summary has file paths or totals, print them
            total_before = correction_summary.get("before", {}).get("total")
            total_after = correction_summary.get("after", {}).get("total")
            method = correction_summary.get("method") or payload.get("method")
            if method:
                write_line(f"- Correction method: {method}")
            if total_before is not None:
                write_line(f"- Samples before: {total_before}")
            if total_after is not None:
                write_line(f"- Samples after: {total_after}")
            y -= 6

            # Bias severity table
            write_line("Bias severity:", fontsize=13, leading=18)
            if bias_summary:
                for col, stats in bias_summary.items():
                    severity = (stats or {}).get(
                        "severity", "N/A") if isinstance(stats, dict) else "N/A"
                    write_line(f"- {col}: {severity}")
            else:
                write_line("- No bias summary provided")
            y -= 6

            # Correction details block (print key items)
            write_line("Correction details:", fontsize=13, leading=18)
            if correction_summary:
                # Print before counts (top few)
                before = correction_summary.get("before", {})
                after = correction_summary.get("after", {})
                if before:
                    counts = before.get("counts", {})
                    if isinstance(counts, dict) and counts:
                        write_line("- Before counts:")
                        for k, v in list(counts.items())[:10]:
                            write_line(f"   {k}: {v}", fontsize=10, leading=14)
                if after:
                    counts = after.get("counts", {})
                    if isinstance(counts, dict) and counts:
                        write_line("- After counts:")
                        for k, v in list(counts.items())[:10]:
                            write_line(f"   {k}: {v}", fontsize=10, leading=14)
            else:
                write_line("- No correction summary provided")
            y -= 6

            # Embed charts if provided
            before_chart_b64 = visualizations.get("before_chart")
            after_chart_b64 = visualizations.get("after_chart")

            def draw_b64_image(title: str, b64_str: str, max_width: int = 500, max_height: int = 300):
                nonlocal y
                try:
                    img_bytes = base64.b64decode(b64_str)
                    img = ImageReader(io.BytesIO(img_bytes))
                    iw, ih = img.getSize()
                    scale = min(max_width / iw, max_height / ih)
                    w, h = iw * scale, ih * scale
                    if y < margin + h + 40:
                        c.showPage()
                        y = height - margin
                    write_line(title, fontsize=12, leading=16)
                    c.drawImage(img, margin, y - h, width=w, height=h)
                    y -= h + 16
                except Exception:
                    write_line(
                        f"[Could not render {title}]", fontsize=10, leading=14)

            if before_chart_b64:
                draw_b64_image("Before distribution", before_chart_b64)
            if after_chart_b64:
                draw_b64_image("After distribution", after_chart_b64)

            c.showPage()
            c.save()

            return jsonify({"report_path": f"api/reports/download/{filename}"}), 200

        except Exception as e:
            return jsonify({"error": str(e)}), 400


@blp.route("/reports/download/<path:filename>")
class ServeReport(MethodView):
    def get(self, filename):
        """Serve generated PDF reports from the reports directory."""
        try:
            os.makedirs(REPORTS_DIR, exist_ok=True)
            # send_from_directory safely joins and serves files under REPORTS_DIR
            return send_from_directory(REPORTS_DIR, filename, as_attachment=True)
        except Exception as e:
            return jsonify({"error": str(e)}), 400


@blp.route("/corrected/download/<path:filename>")
class ServeCorrected(MethodView):
    def get(self, filename):
        """Serve corrected CSV files from the corrected directory.

        The frontend typically has a path like 'corrected/<file>.csv'. Pass just
        the filename portion to this route.
        """
        try:
            os.makedirs(CORRECTED_DIR, exist_ok=True)
            # Security: ensure we only serve inside CORRECTED_DIR
            return send_from_directory(CORRECTED_DIR, filename, as_attachment=True)
        except Exception as e:
            return jsonify({"error": str(e)}), 400
