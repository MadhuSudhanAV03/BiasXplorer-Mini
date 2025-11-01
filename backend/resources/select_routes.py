from flask import request, jsonify, current_app
from flask.views import MethodView
from flask_smorest import Blueprint
import os

from services import FileService
from utils.validators import PathValidator

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

blp = Blueprint("Select and Categorize", __name__, url_prefix="/api",
                description="Selecting columns and categorizing them")


@blp.route('/features')
class SelectFeatures(MethodView):
    def post(self):
        """Select a subset of features from the dataset and save as a new CSV.
        Input JSON:
        {
          "file_path": "uploads/filename.csv",
          "selected_features": ["age", "gender", "income"]
        }
        Saves to uploads/selected_<original_basename>.csv
        """
        try:
            data = request.get_json(silent=True) or {}
            file_path = data.get("file_path")
            selected = data.get("selected_features")

            if not file_path:
                return jsonify({"error": "'file_path' is required in JSON body."}), 400
            if selected is None:
                return jsonify({"error": "'selected_features' is required in JSON body."}), 400

            # Coerce string to list and validate type
            if isinstance(selected, str):
                selected = [selected]
            if not isinstance(selected, list) or not all(isinstance(c, (str, int, float)) for c in selected):
                return jsonify({"error": "'selected_features' must be a list of column names."}), 400

            # Validate path
            abs_path, error = PathValidator.validate_upload_path(file_path, BASE_DIR, UPLOAD_DIR)
            if error:
                return jsonify({"error": error}), 400

            # Read dataset
            df = FileService.read_dataset(abs_path)
            df_columns = FileService.get_columns(df)
            df_col_set = set(df_columns)

            # Normalize requested features to strings and dedupe preserving order
            wanted = []
            seen = set()
            for c in [str(x) for x in selected]:
                if c not in seen:
                    seen.add(c)
                    wanted.append(c)

            missing = [c for c in wanted if c not in df_col_set]
            if missing:
                return jsonify({
                    "error": "Some selected features were not found in the dataset.",
                    "details": {
                        "missing_features": missing,
                        "available_columns": df_columns
                    }
                }), 400

            # Filter and save
            filtered_df = df[wanted]
            original_base = os.path.splitext(os.path.basename(abs_path))[0]
            selected_filename = f"selected_{original_base}.csv"
            selected_path = os.path.join(UPLOAD_DIR, selected_filename)
            FileService.save_dataset(filtered_df, selected_path, ensure_dir=True)

            return jsonify({
                "message": "Features selected successfully",
                "selected_features": wanted,
                "selected_file_path": f"uploads/{selected_filename}"
            }), 200

        except FileNotFoundError:
            return jsonify({"error": "File not found."}), 400
        except ValueError as e:
            return jsonify({"error": f"Invalid file format: {str(e)}"}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 400


@blp.route('/column-types')
class SetColumnTypes(MethodView):
    def post(self):
        """Set column types (categorical/continuous) for a given uploaded dataset.
        Expects JSON body like:
        {
          "file_path": "uploads/filename.csv",
          "categorical": ["gender", "city"],
          "continuous": ["age", "salary"]
        }
        """
        try:
            data = request.get_json(silent=True) or {}
            file_path = data.get("file_path")
            categorical = data.get("categorical", [])
            continuous = data.get("continuous", [])

            if not file_path:
                return jsonify({"error": "'file_path' is required in JSON body."}), 400

            # Validate input types and coerce simple strings
            if isinstance(categorical, str):
                categorical = [categorical]
            if isinstance(continuous, str):
                continuous = [continuous]
            if not isinstance(categorical, list) or not all(isinstance(c, (str, int, float)) for c in categorical):
                return jsonify({"error": "'categorical' must be a list of column names."}), 400
            if not isinstance(continuous, list) or not all(isinstance(c, (str, int, float)) for c in continuous):
                return jsonify({"error": "'continuous' must be a list of column names."}), 400

            # Validate path
            abs_path, error = PathValidator.validate_upload_path(file_path, BASE_DIR, UPLOAD_DIR)
            if error:
                return jsonify({"error": error}), 400

            # Read dataset to validate column existence
            df = FileService.read_dataset(abs_path)
            df_columns = FileService.get_columns(df)
            df_col_set = set(df_columns)

            # Normalize provided column names to strings
            cat_cols = [str(c) for c in categorical]
            cont_cols = [str(c) for c in continuous]

            # Dedupe while preserving order
            def dedupe(seq):
                seen = set()
                out = []
                for x in seq:
                    if x not in seen:
                        seen.add(x)
                        out.append(x)
                return out

            cat_cols = dedupe(cat_cols)
            cont_cols = dedupe(cont_cols)

            # Validate existence
            missing_cat = [c for c in cat_cols if c not in df_col_set]
            missing_cont = [c for c in cont_cols if c not in df_col_set]
            if missing_cat or missing_cont:
                return jsonify({
                    "error": "Some columns were not found in the dataset.",
                    "details": {
                        "missing_categorical": missing_cat,
                        "missing_continuous": missing_cont,
                        "available_columns": df_columns
                    }
                }), 400

            # Optional: warn on overlaps
            overlaps = sorted(set(cat_cols).intersection(set(cont_cols)))
            if overlaps:
                return jsonify({
                    "error": "Columns overlap between 'categorical' and 'continuous'.",
                    "details": {"overlaps": overlaps}
                }), 400

            # Save temporarily in in-memory store keyed by file_path
            store = current_app.config.get("COLUMN_TYPES_STORE", {})
            store[file_path] = {
                "categorical": cat_cols,
                "continuous": cont_cols,
            }
            current_app.config["COLUMN_TYPES_STORE"] = store

            return jsonify({
                "message": "Column types saved successfully.",
                "file_path": file_path,
                "columns": {
                    "categorical": cat_cols,
                    "continuous": cont_cols
                }
            }), 200

        except FileNotFoundError:
            return jsonify({"error": "File not found."}), 400
        except ValueError as e:
            return jsonify({"error": f"Invalid file format: {str(e)}"}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 400
