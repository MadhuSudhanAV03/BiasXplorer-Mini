from utils.data_stats import compute_skewness
from sklearn.utils.class_weight import compute_class_weight
from imblearn.under_sampling import RandomUnderSampler
from imblearn.over_sampling import RandomOverSampler, SMOTE
from werkzeug.utils import secure_filename
from flask_smorest import Blueprint, abort
from flask.views import MethodView
from flask import request, jsonify, current_app
import matplotlib.pyplot as plt
import seaborn as sns
import os
import base64
import io
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')


blp = Blueprint("bias", __name__,
                description="Bias detection and correction operations")

ALLOWED_EXTENSIONS = {"csv", "xls", "xlsx"}
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORRECTED_DIR = os.path.join(BASE_DIR, "corrected")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")


@blp.route('/detect_bias')
class DetectBias(MethodView):
    def post(self):
        """Detect class imbalance for given categorical columns.
        Input JSON:
        {
          "file_path": "uploads/selected_dataset.csv",
          "categorical": ["gender", "region"]
        }
        For each categorical column, computes normalized value counts, minority/majority ratio,
        assigns severity (Low/Moderate/Severe), and returns a JSON mapping per column.
        """
        try:
            data = request.get_json(silent=True) or {}
            file_path = data.get("file_path")
            categorical = data.get("categorical")

            print(
                f"[DEBUG] detect_bias received - file_path: {file_path}, categorical: {categorical}")

            if not file_path:
                return jsonify({"error": "'file_path' is required in JSON body."}), 400

            # Normalize and validate path within uploads
            norm_rel_path = os.path.normpath(file_path)
            if os.path.isabs(norm_rel_path):
                return jsonify({"error": "Absolute paths are not allowed. Use relative path under 'uploads/'."}), 400

            abs_path = os.path.join(BASE_DIR, norm_rel_path)
            print(
                f"[DEBUG] Checking path - abs_path: {abs_path}, UPLOAD_DIR: {UPLOAD_DIR}")

            # Normalize paths for comparison (important on Windows)
            abs_path_norm = os.path.normpath(os.path.abspath(abs_path))
            upload_dir_norm = os.path.normpath(os.path.abspath(UPLOAD_DIR))

            print(
                f"[DEBUG] Normalized - abs_path_norm: {abs_path_norm}, upload_dir_norm: {upload_dir_norm}")

            if not abs_path_norm.startswith(upload_dir_norm):
                return jsonify({"error": "Invalid file_path. Must be within the 'uploads/' directory."}), 400

            if not os.path.exists(abs_path):
                return jsonify({"error": f"File not found: {file_path}"}), 400

            print(f"[DEBUG] File exists, reading dataset...")

            # Read dataset
            ext = os.path.splitext(abs_path)[1].lower()
            if ext == ".csv":
                df = pd.read_csv(abs_path)
            elif ext in (".xls", ".xlsx"):
                df = pd.read_excel(abs_path)
            else:
                return jsonify({"error": "Unsupported file type. Only .csv, .xls, .xlsx are supported."}), 400

            # Determine categorical columns: use input, else fallback to store
            if categorical is None:
                store = current_app.config.get("COLUMN_TYPES_STORE", {})
                categorical = store.get(file_path, {}).get("categorical", [])

            if isinstance(categorical, str):
                categorical = [categorical]
            if not isinstance(categorical, list):
                return jsonify({"error": "'categorical' must be a list of column names if provided."}), 400

            # Prepare response per column
            result = {}
            df_columns = list(map(str, df.columns.tolist()))
            df_col_set = set(df_columns)

            for col in [str(c) for c in categorical]:
                col_entry = {}
                if col not in df_col_set:
                    # Column not present: graceful entry
                    col_entry["severity"] = "N/A"
                    col_entry["note"] = "Column not found"
                    result[col] = col_entry
                    continue

                series = df[col].dropna()
                if series.empty:
                    col_entry["severity"] = "N/A"
                    col_entry["note"] = "No data"
                    result[col] = col_entry
                    continue

                # Compute normalized distribution
                dist = series.value_counts(normalize=True).to_dict()
                # Normalize keys to strings and round floats for readability
                dist_str = {str(k): float(round(v, 6))
                            for k, v in dist.items()}

                if len(dist_str) == 1:
                    # Single class present -> maximum imbalance
                    ratio = 0.0
                else:
                    majority = max(dist_str.values())
                    minority = min(dist_str.values())
                    ratio = (minority / majority) if majority > 0 else 0.0

                if ratio >= 0.5:
                    severity = "Low"
                elif ratio >= 0.2:
                    severity = "Moderate"
                else:
                    severity = "Severe"

                col_entry.update(dist_str)
                col_entry["severity"] = severity
                result[col] = col_entry

            return jsonify(result), 200

        except FileNotFoundError:
            return jsonify({"error": "File not found."}), 400
        except ValueError as e:
            return jsonify({"error": f"Invalid file format: {str(e)}"}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 400


@blp.route("/fix_bias")
class FixBias(MethodView):
    def post(self):
        """Handle categorical imbalance correction using imbalanced-learn samplers.
        Input JSON:
        {
          "file_path": "uploads/selected_dataset.csv",
          "target_column": "gender",
          "method": "smote" | "oversample" | "undersample" | "reweight",
          "threshold": 0.3  # optional, desired minority/majority ratio for sampling (binary only)
        }
        Saves corrected dataset to corrected/corrected_dataset.csv
        Returns before/after class distributions and sample counts.
        """
        try:
            data = request.get_json(silent=True) or {}
            file_path = data.get("file_path")
            target_col = data.get("target_column")
            method = (data.get("method") or "").lower()
            threshold = data.get("threshold")

            if not file_path:
                return jsonify({"error": "'file_path' is required in JSON body."}), 400
            if not target_col:
                return jsonify({"error": "'target_column' is required in JSON body."}), 400
            if method not in {"smote", "oversample", "undersample", "reweight"}:
                return jsonify({"error": "'method' must be one of: smote, oversample, undersample, reweight."}), 400

            # Normalize and validate path within uploads
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

            if target_col not in df.columns:
                return jsonify({"error": f"Target column '{target_col}' not found in dataset."}), 400

            # Validate target is categorical
            y = df[target_col]
            nunique = y.nunique(dropna=True)
            is_categorical = (str(y.dtype) in (
                "object", "category", "bool")) or (nunique <= 20)
            if not is_categorical:
                raise ValueError("Target column is not categorical.")

            # Prepare X and y
            df_reset = df.reset_index(drop=True)
            X = df_reset.drop(columns=[target_col])
            y = y.reset_index(drop=True).astype(str)

            # Before distributions and counts
            before_counts = y.value_counts(dropna=False).to_dict()
            before_dist = y.value_counts(normalize=True, dropna=False).round(
                6).astype(float).to_dict()
            before_total = int(len(y))

            # Determine sampling_strategy from threshold (binary only), else 'auto'
            sampling_strategy = 'auto'
            if isinstance(threshold, (int, float)):
                try:
                    thr = float(threshold)
                    if 0 < thr <= 1 and nunique == 2:
                        sampling_strategy = thr
                except Exception:
                    pass

            os.makedirs(CORRECTED_DIR, exist_ok=True)
            corrected_filename = "corrected_dataset.csv"
            corrected_path = os.path.join(CORRECTED_DIR, corrected_filename)

            if method == "reweight":
                # Compute class weights and save original dataset unchanged
                classes = sorted(y.unique().tolist())
                weights = compute_class_weight(
                    class_weight="balanced", classes=classes, y=y)
                class_weights = {str(c): float(w)
                                 for c, w in zip(classes, weights)}
                df_reset.to_csv(corrected_path, index=False)
                after_y = y
                after_counts = after_y.value_counts(dropna=False).to_dict()
                after_dist = after_y.value_counts(
                    normalize=True, dropna=False).round(6).astype(float).to_dict()
                after_total = int(len(after_y))
                return jsonify({
                    "message": "Reweighting computed (dataset unchanged).",
                    "method": method,
                    "class_weights": class_weights,
                    "before": {"counts": before_counts, "distribution": before_dist, "total": before_total},
                    "after": {"counts": after_counts, "distribution": after_dist, "total": after_total},
                    "corrected_file_path": f"corrected/{corrected_filename}"
                }), 200

            # For sampling-based methods, we need to retain row indices to reconstruct the resampled dataset
            X_with_id = X.copy()
            X_with_id["__row_id__"] = X_with_id.index

            if method == "oversample":
                sampler = RandomOverSampler(
                    sampling_strategy=sampling_strategy, random_state=42)
                X_res, y_res = sampler.fit_resample(X_with_id, y)
                row_ids = X_res["__row_id__"].astype(int).tolist()
                df_res = df_reset.iloc[row_ids].reset_index(drop=True)

            elif method == "undersample":
                sampler = RandomUnderSampler(
                    sampling_strategy=sampling_strategy, random_state=42)
                X_res, y_res = sampler.fit_resample(X_with_id, y)
                row_ids = X_res["__row_id__"].astype(int).tolist()
                df_res = df_reset.iloc[row_ids].reset_index(drop=True)

            elif method == "smote":
                # SMOTE requires numeric feature matrix without identifier column
                # Ensure all non-target features are numeric
                non_numeric_cols = [c for c in X.columns if str(
                    X[c].dtype) in ("object", "category", "bool")]
                if non_numeric_cols:
                    return jsonify({
                        "error": "SMOTE requires all non-target features to be numeric.",
                        "details": {"non_numeric_features": non_numeric_cols}
                    }), 400

                X_numeric = X.apply(pd.to_numeric, errors='coerce')
                # Fill numeric NaNs with column means
                X_numeric = X_numeric.apply(
                    lambda s: s.fillna(s.mean()), axis=0)

                smote = SMOTE(
                    sampling_strategy=sampling_strategy, random_state=42)
                X_res_num, y_res = smote.fit_resample(X_numeric, y)

                # Reconstruct a DataFrame with numeric features and target; non-numeric features are dropped by design here
                df_res = pd.DataFrame(X_res_num, columns=X_numeric.columns)
                df_res[target_col] = y_res.values

            else:
                return jsonify({"error": "Unsupported method."}), 400

            # Save corrected dataset
            df_res.to_csv(corrected_path, index=False)

            # After distributions and counts
            after_y = df_res[target_col].astype(str)
            after_counts = after_y.value_counts(dropna=False).to_dict()
            after_dist = after_y.value_counts(
                normalize=True, dropna=False).round(6).astype(float).to_dict()
            after_total = int(len(after_y))

            return jsonify({
                "message": "Bias correction complete.",
                "method": method,
                "before": {"counts": before_counts, "distribution": before_dist, "total": before_total},
                "after": {"counts": after_counts, "distribution": after_dist, "total": after_total},
                "corrected_file_path": f"corrected/{corrected_filename}"
            }), 200

        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except FileNotFoundError:
            return jsonify({"error": "File not found."}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 400


@blp.route('/visualize_bias')
class VisualizeBias(MethodView):
    def post(self):
        """Create bar plots (base64 PNG) of class distributions before and after correction.
        Input JSON:
        {
          "before_path": "uploads/selected_dataset.csv",
          "after_path": "corrected/corrected_dataset.csv",
          "target_column": "gender"
        }
        Returns {"before_chart": "<b64>", "after_chart": "<b64>"}
        """
        try:
            data = request.get_json(silent=True) or {}
            before_path = data.get("before_path")
            after_path = data.get("after_path")
            target_col = data.get("target_column")

            if not before_path or not after_path or not target_col:
                return jsonify({"error": "'before_path', 'after_path', and 'target_column' are required."}), 400

            # Resolve and validate before_path (must be under uploads/)
            def resolve_and_validate(path: str):
                norm_rel = os.path.normpath(path)
                if os.path.isabs(norm_rel):
                    return None, "Absolute paths are not allowed. Use relative paths under 'uploads/' or 'corrected/'."
                abs_p = os.path.join(BASE_DIR, norm_rel)
                # Decide base dir by prefix
                if norm_rel.split(os.sep)[0] == "uploads":
                    base = UPLOAD_DIR
                elif norm_rel.split(os.sep)[0] == "corrected":
                    base = CORRECTED_DIR
                else:
                    return None, "Path must start with 'uploads/' or 'corrected/'."
                try:
                    if os.path.commonpath([abs_p, base]) != base:
                        return None, "Invalid path; must stay within its base directory."
                except Exception:
                    return None, "Invalid path provided."
                if not os.path.exists(abs_p):
                    return None, f"File not found: {path}"
                return abs_p, None

            before_abs, err = resolve_and_validate(before_path)
            if err:
                return jsonify({"error": err}), 400
            after_abs, err = resolve_and_validate(after_path)
            if err:
                return jsonify({"error": err}), 400

            # Read datasets
            def read_any(p: str):
                ext = os.path.splitext(p)[1].lower()
                if ext == ".csv":
                    return pd.read_csv(p)
                elif ext in (".xls", ".xlsx"):
                    return pd.read_excel(p)
                else:
                    raise ValueError(
                        "Unsupported file type. Only .csv, .xls, .xlsx are supported.")

            df_before = read_any(before_abs)
            df_after = read_any(after_abs)

            if target_col not in df_before.columns:
                return jsonify({"error": f"Target column '{target_col}' not found in before dataset."}), 400
            if target_col not in df_after.columns:
                return jsonify({"error": f"Target column '{target_col}' not found in after dataset."}), 400

            s_before = df_before[target_col].dropna()
            s_after = df_after[target_col].dropna()
            if s_before.empty:
                return jsonify({"error": "No data in target column for before dataset."}), 400
            if s_after.empty:
                return jsonify({"error": "No data in target column for after dataset."}), 400

            dist_before = s_before.value_counts(normalize=True).sort_index()
            dist_after = s_after.value_counts(normalize=True).sort_index()

            # Helper to plot a distribution series -> base64 png
            def plot_to_base64(title: str, series: pd.Series) -> str:
                fig, ax = plt.subplots(figsize=(6, 4))
                series.plot(kind='bar', ax=ax, color="#4C78A8")
                ax.set_title(title)
                ax.set_ylabel("Proportion")
                ax.set_xlabel("Class")
                ax.set_ylim(0, 1)
                for i, v in enumerate(series.values):
                    ax.text(i, v + 0.02, f"{v:.2f}",
                            ha='center', va='bottom', fontsize=8)
                fig.tight_layout()
                buf = io.BytesIO()
                fig.savefig(buf, format='png', dpi=150)
                plt.close(fig)
                buf.seek(0)
                b64 = base64.b64encode(buf.read()).decode('ascii')
                return b64

            before_b64 = plot_to_base64(f"Before: {target_col}", dist_before)
            after_b64 = plot_to_base64(f"After: {target_col}", dist_after)

            return jsonify({
                "before_chart": before_b64,
                "after_chart": after_b64
            }), 200

        except FileNotFoundError:
            return jsonify({"error": "File not found."}), 400
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 400


@blp.route("/detect_skew")
class DetectSkew(MethodView):
    @blp.response(200, description="Skewness computed successfully")
    def post(self):
        """
        Detect skewness in a specific column of an uploaded dataset.

        Computes the statistical skewness of a numeric column using scipy.stats.skew.
        Non-numeric values are coerced to NaN and dropped before computation.

        **Request Body (JSON):**
        - `filename` (string, required): Name of the uploaded file (must exist in uploads/ directory)
        - `column` (string, required): Column name to analyze

        **Example Request:**
        ```json
        {
            "filename": "dataset.csv",
            "column": "age"
        }
        ```

        **Response (200 OK):**
        ```json
        {
            "column": "age",
            "skewness": 0.4521,
            "n_nonnull": 150,
            "message": "ok"
        }
        ```

        **Response Fields:**
        - `column` (string): The analyzed column name
        - `skewness` (float|null): Computed skewness value, or null if series is empty
        - `n_nonnull` (integer): Number of non-null values in the original column
        - `message` (string): Status message ("ok" on success)

        **Error Responses:**
        - `400 Bad Request`: Missing required fields, invalid filename, or insufficient data (< 2 numeric values)
        - `404 Not Found`: File or column not found
        - `500 Internal Server Error`: File read error or computation failure
        """
        try:
            data = request.get_json()

            if not data:
                abort(400, message="Request body must be JSON")

            filename = data.get("filename")
            column = data.get("column")

            print(
                f"[DEBUG] detect_skew received - filename: {filename}, column: {column}")

            if not filename or not column:
                abort(400, message="Both 'filename' and 'column' are required")

            # Secure the filename
            secure_name = secure_filename(filename)
            if not secure_name:
                abort(400, message="Invalid filename")

            # Build full file path
            file_path = os.path.join(UPLOAD_DIR, secure_name)

            # Validate path to prevent directory traversal
            if not os.path.abspath(file_path).startswith(os.path.abspath(UPLOAD_DIR)):
                abort(400, message="Invalid file path")

            # Check if file exists
            if not os.path.exists(file_path):
                abort(404, message=f"File '{secure_name}' not found")

            # Load the dataset based on file extension
            file_ext = os.path.splitext(secure_name)[1].lower()

            try:
                if file_ext == '.csv':
                    df = pd.read_csv(file_path)
                elif file_ext in ['.xls', '.xlsx']:
                    df = pd.read_excel(file_path)
                else:
                    abort(400, message=f"Unsupported file type: {file_ext}")
            except Exception as e:
                abort(500, message=f"Error reading file: {str(e)}")

            # Check if column exists
            if column not in df.columns:
                abort(
                    404, message=f"Column '{column}' not found in dataset. Available columns: {list(df.columns)}")

            # Get the series
            series = df[column]

            # Count non-null values before conversion
            n_nonnull = series.notna().sum()

            # Compute skewness
            try:
                skewness = compute_skewness(series)

                return jsonify({
                    "column": column,
                    "skewness": skewness,
                    "n_nonnull": int(n_nonnull),
                    "message": "ok"
                }), 200

            except ValueError as e:
                # Insufficient data error
                abort(400, message=str(e))
            except Exception as e:
                abort(500, message=f"Error computing skewness: {str(e)}")

        except Exception as e:
            if hasattr(e, 'code'):  # Already an abort error
                raise
            abort(500, message=f"Unexpected error: {str(e)}")


@blp.route("/fix_skew")
class FixSkew(MethodView):
    @blp.response(200, description="Skewness correction applied successfully")
    def post(self):
        """
        Fix skewness in continuous columns by applying appropriate transformations.

        Applies different transformations based on skewness severity:
        - Small positive skew (0.5 to 1): Square root
        - Medium positive skew (1 to 2): Log transformation
        - Small negative skew (-1 to -0.5): Squared power
        - Medium negative skew (-2 to -1): Cubed power
        - Severe skew (2 to 3 or -3 to -2): Yeo-Johnson
        - Extreme skew (>3 or <-3): Quantile Transformer

        **Request Body (JSON):**
        - `filename` (string, required): Name of the uploaded file
        - `columns` (array, required): List of continuous column names to fix

        **Example Request:**
        ```json
        {
            "filename": "dataset.csv",
            "columns": ["age", "income"]
        }
        ```

        **Response (200 OK):**
        ```json
        {
            "message": "Skewness correction applied successfully",
            "corrected_file": "corrected/corrected_dataset.csv",
            "transformations": {
                "age": {
                    "original_skewness": 2.5,
                    "new_skewness": 0.3,
                    "method": "Yeo-Johnson"
                },
                "income": {
                    "original_skewness": 5.2,
                    "new_skewness": 0.1,
                    "method": "Quantile Transformer"
                }
            }
        }
        ```
        """
        from utils.continuous_data.skew import handle_skew
        from utils.data_stats import compute_skewness

        try:
            data = request.get_json()

            if not data:
                abort(400, message="Request body must be JSON")

            filename = data.get("filename")
            columns = data.get("columns")

            print(
                f"[DEBUG] fix_skew received - filename: {filename}, columns: {columns}")

            if not filename:
                abort(400, message="'filename' is required")

            if not columns or not isinstance(columns, list):
                abort(400, message="'columns' must be a non-empty list")

            # Secure the filename
            secure_name = secure_filename(filename)
            if not secure_name:
                abort(400, message="Invalid filename")

            # Build full file path
            file_path = os.path.join(UPLOAD_DIR, secure_name)

            # Validate path to prevent directory traversal
            if not os.path.abspath(file_path).startswith(os.path.abspath(UPLOAD_DIR)):
                abort(400, message="Invalid file path")

            # Check if file exists
            if not os.path.exists(file_path):
                abort(404, message=f"File '{secure_name}' not found")

            # Load the dataset based on file extension
            file_ext = os.path.splitext(secure_name)[1].lower()

            try:
                if file_ext == '.csv':
                    df = pd.read_csv(file_path)
                elif file_ext in ['.xls', '.xlsx']:
                    df = pd.read_excel(file_path)
                else:
                    abort(400, message=f"Unsupported file type: {file_ext}")
            except Exception as e:
                abort(500, message=f"Error reading file: {str(e)}")

            # Track transformations applied
            transformations = {}

            # Apply skewness correction to each column
            for col in columns:
                if col not in df.columns:
                    transformations[col] = {
                        "error": "Column not found",
                        "original_skewness": None,
                        "new_skewness": None,
                        "method": None
                    }
                    continue

                try:
                    # Compute original skewness
                    original_series = df[col].copy()
                    original_skewness = compute_skewness(original_series)

                    if original_skewness is None:
                        transformations[col] = {
                            "error": "Unable to compute skewness",
                            "original_skewness": None,
                            "new_skewness": None,
                            "method": None
                        }
                        continue

                    # Determine transformation method based on skewness
                    if abs(original_skewness) <= 0.5:
                        method = "None (already symmetric)"
                        new_skewness = original_skewness
                    else:
                        # Apply transformation
                        if original_skewness > 0.5 and original_skewness <= 1:
                            method = "Square Root"
                        elif original_skewness > 1 and original_skewness <= 2:
                            method = "Log Transformation"
                        elif original_skewness < -0.5 and original_skewness >= -1:
                            method = "Squared Power"
                        elif original_skewness < -1 and original_skewness >= -2:
                            method = "Cubed Power"
                        elif (original_skewness > 2 and original_skewness <= 3) or (original_skewness < -2 and original_skewness >= -3):
                            method = "Yeo-Johnson"
                        else:
                            method = "Quantile Transformer"

                        # Apply the transformation
                        df = handle_skew(df, col, original_skewness)

                        # Compute new skewness
                        new_skewness = compute_skewness(df[col])

                    transformations[col] = {
                        "original_skewness": float(original_skewness),
                        "new_skewness": float(new_skewness) if new_skewness is not None else None,
                        "method": method
                    }

                except Exception as e:
                    transformations[col] = {
                        "error": str(e),
                        "original_skewness": None,
                        "new_skewness": None,
                        "method": None
                    }

            # Save corrected dataset
            os.makedirs(CORRECTED_DIR, exist_ok=True)
            corrected_filename = "corrected_dataset.csv"
            corrected_path = os.path.join(CORRECTED_DIR, corrected_filename)

            df.to_csv(corrected_path, index=False)

            return jsonify({
                "message": "Skewness correction applied successfully",
                "corrected_file": f"corrected/{corrected_filename}",
                "transformations": transformations
            }), 200

        except Exception as e:
            if hasattr(e, 'code'):  # Already an abort error
                raise
            abort(500, message=f"Unexpected error: {str(e)}")


@blp.route("/visualize_skew")
class VisualizeSkew(MethodView):
    @blp.response(200, description="Skewness visualization generated successfully")
    def post(self):
        """
        Create distribution plots (histograms + KDE) for continuous columns before and after skewness correction.

        **Request Body (JSON):**
        - `before_path` (string, required): Path to original dataset
        - `after_path` (string, required): Path to corrected dataset
        - `columns` (array, required): List of continuous column names to visualize

        **Response:** Returns base64-encoded histogram plots with KDE overlays
        """
        from utils.data_stats import compute_skewness

        try:
            data = request.get_json()

            if not data:
                abort(400, message="Request body must be JSON")

            before_path = data.get("before_path")
            after_path = data.get("after_path")
            columns = data.get("columns")

            print(
                f"[DEBUG] visualize_skew - before: {before_path}, after: {after_path}, columns: {columns}")

            if not before_path or not after_path:
                abort(400, message="'before_path' and 'after_path' are required")

            if not columns or not isinstance(columns, list):
                abort(400, message="'columns' must be a non-empty list")

            # Resolve and validate paths
            def resolve_and_validate(path: str):
                norm_rel = os.path.normpath(path)
                if os.path.isabs(norm_rel):
                    return None, "Absolute paths are not allowed"

                abs_p = os.path.join(BASE_DIR, norm_rel)

                # Determine base directory
                path_parts = norm_rel.split(os.sep)
                if path_parts[0] == "uploads":
                    base = UPLOAD_DIR
                elif path_parts[0] == "corrected":
                    base = CORRECTED_DIR
                else:
                    return None, "Path must start with 'uploads/' or 'corrected/'"

                # Validate path is within base directory
                try:
                    abs_p_norm = os.path.normpath(os.path.abspath(abs_p))
                    base_norm = os.path.normpath(os.path.abspath(base))
                    if not abs_p_norm.startswith(base_norm):
                        return None, "Invalid path"
                except Exception:
                    return None, "Invalid path"

                if not os.path.exists(abs_p):
                    return None, f"File not found: {path}"

                return abs_p, None

            before_abs, err = resolve_and_validate(before_path)
            if err:
                abort(400, message=f"Before path error: {err}")

            after_abs, err = resolve_and_validate(after_path)
            if err:
                abort(400, message=f"After path error: {err}")

            # Read datasets
            def read_any(p: str):
                ext = os.path.splitext(p)[1].lower()
                if ext == ".csv":
                    return pd.read_csv(p)
                elif ext in (".xls", ".xlsx"):
                    return pd.read_excel(p)
                else:
                    raise ValueError("Unsupported file type")

            df_before = read_any(before_abs)
            df_after = read_any(after_abs)

            # Generate charts for each column
            charts = {}

            for col in columns:
                if col not in df_before.columns:
                    charts[col] = {
                        "error": f"Column '{col}' not found in before dataset"}
                    continue

                if col not in df_after.columns:
                    charts[col] = {
                        "error": f"Column '{col}' not found in after dataset"}
                    continue

                try:
                    # Get data
                    series_before = df_before[col].dropna()
                    series_after = df_after[col].dropna()

                    if series_before.empty or series_after.empty:
                        charts[col] = {"error": "No data available"}
                        continue

                    # Convert to numeric
                    series_before = pd.to_numeric(
                        series_before, errors='coerce').dropna()
                    series_after = pd.to_numeric(
                        series_after, errors='coerce').dropna()

                    if len(series_before) < 2 or len(series_after) < 2:
                        charts[col] = {"error": "Insufficient data"}
                        continue

                    # Compute skewness
                    before_skew = compute_skewness(series_before)
                    after_skew = compute_skewness(series_after)

                    # Create histogram plots with KDE using seaborn
                    def plot_distribution(title: str, series: pd.Series, skew_val) -> str:
                        fig, ax = plt.subplots(figsize=(7, 5))

                        # Seaborn histplot with KDE overlay
                        sns.histplot(
                            x=series,
                            bins=30,
                            kde=True,
                            color='#4C78A8',
                            edgecolor='black',
                            alpha=0.7,
                            stat='density',
                            ax=ax,
                            line_kws={'linewidth': 2, 'color': 'red'}
                        )

                        ax.set_title(
                            f"{title}\nSkewness: {skew_val:.3f}" if skew_val is not None else title, fontsize=12, fontweight='bold')
                        ax.set_xlabel("Value", fontsize=10)
                        ax.set_ylabel("Density", fontsize=10)
                        ax.grid(alpha=0.3)

                        fig.tight_layout()
                        buf = io.BytesIO()
                        fig.savefig(buf, format='png', dpi=120)
                        plt.close(fig)
                        buf.seek(0)
                        b64 = base64.b64encode(buf.read()).decode('ascii')
                        return b64

                    before_chart = plot_distribution(
                        f"Before: {col}", series_before, before_skew)
                    after_chart = plot_distribution(
                        f"After: {col}", series_after, after_skew)

                    charts[col] = {
                        "before_chart": before_chart,
                        "after_chart": after_chart,
                        "before_skewness": float(before_skew) if before_skew is not None else None,
                        "after_skewness": float(after_skew) if after_skew is not None else None
                    }

                except Exception as e:
                    charts[col] = {"error": str(e)}

            return jsonify({"charts": charts}), 200

        except Exception as e:
            if hasattr(e, 'code'):
                raise
            abort(500, message=f"Unexpected error: {str(e)}")
