from flask import request, jsonify
from flask.views import MethodView
from flask_smorest import Blueprint
import os
from werkzeug.utils import secure_filename
import pandas as pd

ALLOWED_EXTENSIONS = {"csv", "xls", "xlsx"}
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

blp = Blueprint("Uploads", __name__,
                description="File upload and preview operations")


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@blp.route("/upload")
class UploadFile(MethodView):
    def post(self):
        """Upload a dataset file (CSV or Excel) via multipart/form-data under key 'file'."""
        try:
            # Validate form-data key and file presence
            if "file" not in request.files:
                return jsonify({"error": "No file part in the request. Expected form-data key 'file'."}), 400

            file = request.files["file"]

            # Validate filename presence
            if file.filename == "":
                return jsonify({"error": "No file selected for upload."}), 400

            filename = secure_filename(file.filename)

            # Validate extension
            if not allowed_file(filename):
                return jsonify({"error": "Invalid file type. Only .csv, .xls, .xlsx are allowed."}), 400

            # Ensure uploads directory exists and save file
            os.makedirs(UPLOAD_DIR, exist_ok=True)
            save_path = os.path.join(UPLOAD_DIR, filename)
            file.save(save_path)

            # Return relative path for client usage
            return jsonify({
                "message": "File uploaded successfully",
                "file_path": f"uploads/{filename}"
            }), 200

        except Exception as e:
            # Surface a concise error to the client
            return jsonify({"error": str(e)}), 400


@blp.route("/preview")
class PreviewDataset(MethodView):
    def post(self):
        """Preview the first 10 rows and column names of an uploaded dataset.
        Expects JSON body: {"file_path": "uploads/filename.csv"}
        """
        try:
            payload = request.get_json(silent=True) or {}
            file_path = payload.get("file_path")
            if not file_path:
                return jsonify({"error": "'file_path' is required in JSON body."}), 400

            # Normalize and validate path: must be under uploads directory
            norm_rel_path = os.path.normpath(file_path)
            if os.path.isabs(norm_rel_path):
                return jsonify({"error": "Absolute paths are not allowed. Use relative path under 'uploads/'."}), 400

            abs_path = os.path.join(BASE_DIR, norm_rel_path)

            # Ensure resolved path is inside the UPLOAD_DIR to prevent path traversal
            if os.path.commonpath([abs_path, UPLOAD_DIR]) != UPLOAD_DIR:
                return jsonify({"error": "Invalid file_path. Must be within the 'uploads/' directory."}), 400

            if not os.path.exists(abs_path):
                return jsonify({"error": f"File not found: {file_path}"}), 400

            ext = os.path.splitext(abs_path)[1].lower()
            if ext == ".csv":
                df = pd.read_csv(abs_path)
            elif ext in (".xls", ".xlsx"):
                df = pd.read_excel(abs_path)
            else:
                return jsonify({"error": "Unsupported file type. Only .csv, .xls, .xlsx are supported."}), 400

            head_df = df.head(10)
            # Replace NaN/NaT with None for JSON compatibility
            clean_df = head_df.where(pd.notnull(head_df), None)
            columns = list(map(str, clean_df.columns.tolist()))
            preview_records = clean_df.to_dict(orient="records")

            return jsonify({
                "columns": columns,
                "preview": preview_records
            }), 200

        except FileNotFoundError:
            return jsonify({"error": "File not found."}), 400
        except ValueError as e:
            return jsonify({"error": f"Invalid file format: {str(e)}"}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 400
