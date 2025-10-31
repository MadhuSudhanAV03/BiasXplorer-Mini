from flask import request, jsonify
from flask.views import MethodView
from flask_smorest import Blueprint
import os
import pandas as pd
from flask import current_app

ALLOWED_EXTENSIONS = {"csv", "xls", "xlsx"}
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

blp = Blueprint("Preprocess", __name__,
                description="Preprocessing endpoints")


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

            # Validate path under uploads
            norm_rel_path = os.path.normpath(file_path)
            if os.path.isabs(norm_rel_path):
                return jsonify({"error": "Absolute paths are not allowed. Use relative path under 'uploads/'."}), 400

            abs_path = os.path.join(BASE_DIR, norm_rel_path)
            if os.path.commonpath([abs_path, UPLOAD_DIR]) != UPLOAD_DIR:
                return jsonify({"error": "Invalid file_path. Must be within the 'uploads/' directory."}), 400

            if not os.path.exists(abs_path):
                return jsonify({"error": f"File not found: {file_path}"}), 400

            # Read dataset
            ext = os.path.splitext(abs_path)[1].lower()
            if ext == ".csv":
                df = pd.read_csv(abs_path)
            elif ext in (".xls", ".xlsx"):
                df = pd.read_excel(abs_path)
            else:
                return jsonify({"error": "Unsupported file type. Only .csv, .xls, .xlsx are supported."}), 400

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
            df.to_csv(cleaned_path, index=False)

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
