import matplotlib.pyplot as plt
from flask import request, jsonify
from flask.views import MethodView
from flask_smorest import Blueprint
import os
import pandas as pd
from flask import current_app
from sklearn.utils.class_weight import compute_class_weight
from imblearn.over_sampling import SMOTE, RandomOverSampler
from imblearn.under_sampling import RandomUnderSampler
import io
import base64
import matplotlib
matplotlib.use("Agg")

ALLOWED_EXTENSIONS = {"csv", "xls", "xlsx"}
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
CORRECTED_DIR = os.path.join(BASE_DIR, "corrected")
blp = Blueprint("Bias", __name__,
                description="Detecting and fixing bias")


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

            if not file_path:
                return jsonify({"error": "'file_path' is required in JSON body."}), 400

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
