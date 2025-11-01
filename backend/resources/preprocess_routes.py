from flask import request, jsonify, current_app
from flask.views import MethodView
from flask_smorest import Blueprint
import os
import pandas as pd

from services import FileService
from utils.validators import PathValidator

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

blp = Blueprint("Preprocess", __name__, url_prefix="/api",
                description="Data preprocessing endpoints")


@blp.route("/preprocess")
class PreprocessDatatset(MethodView):
    def post(self):
        """Preprocess the dataset: handle missing values and remove duplicates.
        Input JSON:
        {
          "file_path": "uploads/filename.csv",
          "categorical": [optional list to override],
          "continuous": [optional list to override]
        }
        Uses stored column types if present; otherwise infers from dtypes.
        Saves cleaned CSV as uploads/cleaned_<original_basename>.csv
        Returns JSON summary.
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

            # Determine column types: override > stored > inferred
            override_cat = data.get("categorical")
            override_cont = data.get("continuous")

            store = current_app.config.get("COLUMN_TYPES_STORE", {})
            stored = store.get(file_path, {})

            if isinstance(override_cat, str):
                override_cat = [override_cat]
            if isinstance(override_cont, str):
                override_cont = [override_cont]

            if override_cat is not None and not isinstance(override_cat, list):
                return jsonify({"error": "'categorical' must be a list of column names if provided."}), 400
            if override_cont is not None and not isinstance(override_cont, list):
                return jsonify({"error": "'continuous' must be a list of column names if provided."}), 400

            df_columns = list(map(str, df.columns.tolist()))
            df_col_set = set(df_columns)

            if override_cat is not None or override_cont is not None:
                cat_cols = [str(c) for c in (override_cat or [])]
                cont_cols = [str(c) for c in (override_cont or [])]
            elif stored:
                cat_cols = [str(c) for c in stored.get("categorical", [])]
                cont_cols = [str(c) for c in stored.get("continuous", [])]
            else:
                # Infer: object dtype -> categorical; numeric -> continuous
                cat_cols = [c for c in df_columns if str(
                    df[c].dtype) == 'object']
                cont_cols = [c for c in df_columns if c not in cat_cols]

            # Validate provided/inferred columns exist and are disjoint
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

            overlaps = sorted(set(cat_cols).intersection(set(cont_cols)))
            if overlaps:
                return jsonify({
                    "error": "Columns overlap between 'categorical' and 'continuous'.",
                    "details": {"overlaps": overlaps}
                }), 400

            # Missing values snapshot before filling
            missing_before = df.isna().sum().to_dict()

            # Fill missing values
            # Categorical: mode (first mode value if multiple)
            for col in cat_cols:
                if col in df:
                    mode_series = df[col].mode(dropna=True)
                    if not mode_series.empty:
                        df[col] = df[col].fillna(mode_series.iloc[0])

            # Continuous: mean
            for col in cont_cols:
                if col in df:
                    try:
                        mean_val = pd.to_numeric(
                            df[col], errors='coerce').mean()
                        if pd.notnull(mean_val):
                            df[col] = pd.to_numeric(
                                df[col], errors='coerce').fillna(mean_val)
                    except Exception:
                        # If conversion fails, skip this column
                        pass

            # Drop duplicate rows
            df = df.drop_duplicates()

            # Save cleaned dataset as CSV
            original_base = os.path.splitext(os.path.basename(abs_path))[0]
            cleaned_filename = f"cleaned_{original_base}.csv"
            cleaned_path = os.path.join(UPLOAD_DIR, cleaned_filename)
            FileService.save_dataset(df, cleaned_path, ensure_dir=True)

            rows, cols = df.shape
            return jsonify({
                "message": "Preprocessing complete",
                "missing_values": {k: int(v) for k, v in missing_before.items()},
                "dataset_shape": [int(rows), int(cols)],
                "cleaned_file_path": f"uploads/{cleaned_filename}"
            }), 200

        except FileNotFoundError:
            return jsonify({"error": "File not found."}), 400
        except ValueError as e:
            return jsonify({"error": f"Invalid file format: {str(e)}"}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 400
