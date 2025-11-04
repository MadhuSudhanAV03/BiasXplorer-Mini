from flask import request, jsonify
from flask.views import MethodView
from flask_smorest import Blueprint
import os

from services import FileService
from utils.validators import PathValidator

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

blp = Blueprint("Preprocess", __name__, url_prefix="/api",
                description="Data preprocessing endpoints")


@blp.route("/preprocess")
class PreprocessDatatset(MethodView):
    def post(self):
        """Preprocess the dataset: remove rows with NaN values and duplicates.
        Input JSON:
        {
          "file_path": "uploads/filename.csv"
        }

        Processing steps:
        1. Count missing values per column
        2. Drop rows with any NaN values
        3. Drop duplicate rows
        4. Save cleaned CSV as uploads/cleaned_<original_basename>.csv

        Returns JSON summary with statistics.
        """
        try:
            data = request.get_json(silent=True) or {}
            file_path = data.get("file_path")
            if not file_path:
                return jsonify({"error": "'file_path' is required in JSON body."}), 400

            # Validate path
            abs_path, error = PathValidator.validate_upload_path(
                file_path, BASE_DIR, UPLOAD_DIR)
            if error:
                return jsonify({"error": error}), 400

            # Read dataset
            df = FileService.read_dataset(abs_path)

            # Count missing values before removal
            missing_before = df.isna().sum().to_dict()
            rows_before = len(df)

            # Drop rows with any NaN values
            df = df.dropna()
            rows_after_dropna = len(df)

            # Drop duplicate rows
            df = df.drop_duplicates()
            rows_after = len(df)

            # Save cleaned dataset as CSV
            original_base = os.path.splitext(os.path.basename(abs_path))[0]
            cleaned_filename = f"cleaned_{original_base}.csv"
            cleaned_path = os.path.join(UPLOAD_DIR, cleaned_filename)
            FileService.save_dataset(df, cleaned_path, ensure_dir=True)

            rows, cols = df.shape
            rows_with_na = rows_before - rows_after_dropna
            duplicates_removed = rows_after_dropna - rows_after

            return jsonify({
                "message": "Preprocessing complete",
                "missing_values": {k: int(v) for k, v in missing_before.items() if v > 0},
                "rows_before": int(rows_before),
                "rows_with_na_removed": int(rows_with_na),
                "duplicates_removed": int(duplicates_removed),
                "rows_after": int(rows_after),
                "dataset_shape": [int(rows), int(cols)],
                "cleaned_file_path": f"uploads/{cleaned_filename}"
            }), 200

        except FileNotFoundError:
            return jsonify({"error": "File not found."}), 400
        except ValueError as e:
            return jsonify({"error": f"Invalid file format: {str(e)}"}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 400
