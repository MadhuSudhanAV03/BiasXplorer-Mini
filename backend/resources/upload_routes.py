from flask import request, jsonify
from flask.views import MethodView
from flask_smorest import Blueprint
import os

from services import FileService
from utils.validators import FileValidator, PathValidator

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

blp = Blueprint("Uploads", __name__, url_prefix="/api",
                description="File upload and preview operations")

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
            if not file.filename or file.filename == "":
                return jsonify({"error": "No file selected for upload."}), 400

            # Validate and secure filename
            filename, error = FileValidator.validate_filename(file.filename)
            if error:
                return jsonify({"error": error}), 400

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

            # Validate path
            abs_path, error = PathValidator.validate_upload_path(file_path, BASE_DIR, UPLOAD_DIR)
            if error:
                return jsonify({"error": error}), 400

            # Read dataset and get preview
            df = FileService.read_dataset(abs_path)
            preview_data = FileService.get_preview(df, rows=10)

            return jsonify(preview_data), 200

        except FileNotFoundError:
            return jsonify({"error": "File not found."}), 400
        except ValueError as e:
            return jsonify({"error": f"Invalid file format: {str(e)}"}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 400
