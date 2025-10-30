from flask import Flask, jsonify, request, send_from_directory
from dotenv import load_dotenv
from flask_smorest import Api
from flask_jwt_extended import JWTManager
from flask_cors import CORS
import os
from werkzeug.utils import secure_filename
import pandas as pd
from imblearn.over_sampling import SMOTE, RandomOverSampler
from imblearn.under_sampling import RandomUnderSampler
from sklearn.utils.class_weight import compute_class_weight 
import io
import base64
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from datetime import datetime


def create_app():
    app = Flask(__name__)
    load_dotenv()

    app.config["PROPAGATE_EXCEPTIONS"] = True
    app.config["API_TITLE"] = "Stores REST API"
    app.config["API_VERSION"] = "v1"
    app.config["OPENAPI_VERSION"] = "3.0.3"
    app.config["OPENAPI_URL_PREFIX"] = "/"
    app.config["OPENAPI_SWAGGER_UI_PATH"] = "/swagger-ui"
    app.config["OPENAPI_SWAGGER_UI_URL"] = "https://cdn.jsdelivr.net/npm/swagger-ui-dist/"

    CORS(app, origins='*')

    api = Api(app)
    # Simple health and root endpoints to aid local testing
    @app.get("/")
    def root():
        return jsonify({
            "name": "BiasXplorer API",
            "status": "ok",
            "docs": "/swagger-ui",
        }), 200

    @app.get("/health")
    def health():
        return jsonify({"status": "healthy"}), 200

    # File upload configuration
    ALLOWED_EXTENSIONS = {"csv", "xls", "xlsx"}
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
    CORRECTED_DIR = os.path.join(BASE_DIR, "corrected")
    REPORTS_DIR = os.path.join(BASE_DIR, "reports")
    # In-memory store for column type selections
    app.config["COLUMN_TYPES_STORE"] = {}

    def allowed_file(filename: str) -> bool:
        return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

    @app.route("/upload", methods=["POST"])
    def upload_file():
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

    @app.route("/preview", methods=["POST"])
    def preview_dataset():
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

    @app.route("/detect_bias", methods=["POST"])
    def detect_bias():
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
                store = app.config.get("COLUMN_TYPES_STORE", {})
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
                dist_str = {str(k): float(round(v, 6)) for k, v in dist.items()}

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

    @app.route("/generate_report", methods=["POST"])
    def generate_report():
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
            write_line("BiasXplorer - Categorical Bias Report", fontsize=16, leading=22)
            write_line(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", fontsize=10, leading=14)
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
                    severity = (stats or {}).get("severity", "N/A") if isinstance(stats, dict) else "N/A"
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
                    write_line(f"[Could not render {title}]", fontsize=10, leading=14)

            if before_chart_b64:
                draw_b64_image("Before distribution", before_chart_b64)
            if after_chart_b64:
                draw_b64_image("After distribution", after_chart_b64)

            c.showPage()
            c.save()

            return jsonify({"report_path": f"reports/{filename}"}), 200

        except Exception as e:
            return jsonify({"error": str(e)}), 400

    @app.route('/reports/<path:filename>', methods=['GET'])
    def serve_report(filename):
        """Serve generated PDF reports from the reports directory."""
        try:
            os.makedirs(REPORTS_DIR, exist_ok=True)
            # send_from_directory safely joins and serves files under REPORTS_DIR
            return send_from_directory(REPORTS_DIR, filename, as_attachment=True)
        except Exception as e:
            return jsonify({"error": str(e)}), 400

    @app.route("/visualize_bias", methods=["POST"])
    def visualize_bias():
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
                    raise ValueError("Unsupported file type. Only .csv, .xls, .xlsx are supported.")

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
                    ax.text(i, v + 0.02, f"{v:.2f}", ha='center', va='bottom', fontsize=8)
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

    @app.route("/fix_bias", methods=["POST"])
    def fix_bias():
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
            is_categorical = (str(y.dtype) in ("object", "category", "bool")) or (nunique <= 20)
            if not is_categorical:
                raise ValueError("Target column is not categorical.")

            # Prepare X and y
            df_reset = df.reset_index(drop=True)
            X = df_reset.drop(columns=[target_col])
            y = y.reset_index(drop=True).astype(str)

            # Before distributions and counts
            before_counts = y.value_counts(dropna=False).to_dict()
            before_dist = y.value_counts(normalize=True, dropna=False).round(6).astype(float).to_dict()
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
                weights = compute_class_weight(class_weight="balanced", classes=classes, y=y)
                class_weights = {str(c): float(w) for c, w in zip(classes, weights)}
                df_reset.to_csv(corrected_path, index=False)
                after_y = y
                after_counts = after_y.value_counts(dropna=False).to_dict()
                after_dist = after_y.value_counts(normalize=True, dropna=False).round(6).astype(float).to_dict()
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
                sampler = RandomOverSampler(sampling_strategy=sampling_strategy, random_state=42)
                X_res, y_res = sampler.fit_resample(X_with_id, y)
                row_ids = X_res["__row_id__"].astype(int).tolist()
                df_res = df_reset.iloc[row_ids].reset_index(drop=True)

            elif method == "undersample":
                sampler = RandomUnderSampler(sampling_strategy=sampling_strategy, random_state=42)
                X_res, y_res = sampler.fit_resample(X_with_id, y)
                row_ids = X_res["__row_id__"].astype(int).tolist()
                df_res = df_reset.iloc[row_ids].reset_index(drop=True)

            elif method == "smote":
                # SMOTE requires numeric feature matrix without identifier column
                # Ensure all non-target features are numeric
                non_numeric_cols = [c for c in X.columns if str(X[c].dtype) in ("object", "category", "bool")]
                if non_numeric_cols:
                    return jsonify({
                        "error": "SMOTE requires all non-target features to be numeric.",
                        "details": {"non_numeric_features": non_numeric_cols}
                    }), 400

                X_numeric = X.apply(pd.to_numeric, errors='coerce')
                # Fill numeric NaNs with column means
                X_numeric = X_numeric.apply(lambda s: s.fillna(s.mean()), axis=0)

                smote = SMOTE(sampling_strategy=sampling_strategy, random_state=42)
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
            after_dist = after_y.value_counts(normalize=True, dropna=False).round(6).astype(float).to_dict()
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
    @app.route("/select_features", methods=["POST"])
    def select_features():
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

            # Normalize path within uploads
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

            df_columns = list(map(str, df.columns.tolist()))
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
            filtered_df.to_csv(selected_path, index=False)

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
    @app.route("/preprocess", methods=["POST"])


    def preprocess_dataset():
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

            store = app.config.get("COLUMN_TYPES_STORE", {})
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
                cat_cols = [c for c in df_columns if str(df[c].dtype) == 'object']
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
                        mean_val = pd.to_numeric(df[col], errors='coerce').mean()
                        if pd.notnull(mean_val):
                            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(mean_val)
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
    @app.route("/set_column_types", methods=["POST"])


    def set_column_types():
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

            # Normalize and validate path: must be under uploads directory
            norm_rel_path = os.path.normpath(file_path)
            if os.path.isabs(norm_rel_path):
                return jsonify({"error": "Absolute paths are not allowed. Use relative path under 'uploads/'."}), 400

            abs_path = os.path.join(BASE_DIR, norm_rel_path)
            if os.path.commonpath([abs_path, UPLOAD_DIR]) != UPLOAD_DIR:
                return jsonify({"error": "Invalid file_path. Must be within the 'uploads/' directory."}), 400

            if not os.path.exists(abs_path):
                return jsonify({"error": f"File not found: {file_path}"}), 400

            # Validate input types and coerce simple strings
            if isinstance(categorical, str):
                categorical = [categorical]
            if isinstance(continuous, str):
                continuous = [continuous]
            if not isinstance(categorical, list) or not all(isinstance(c, (str, int, float)) for c in categorical):
                return jsonify({"error": "'categorical' must be a list of column names."}), 400
            if not isinstance(continuous, list) or not all(isinstance(c, (str, int, float)) for c in continuous):
                return jsonify({"error": "'continuous' must be a list of column names."}), 400

            # Read dataset to validate column existence
            ext = os.path.splitext(abs_path)[1].lower()
            if ext == ".csv":
                df = pd.read_csv(abs_path)
            elif ext in (".xls", ".xlsx"):
                df = pd.read_excel(abs_path)
            else:
                return jsonify({"error": "Unsupported file type. Only .csv, .xls, .xlsx are supported."}), 400

            df_columns = list(map(str, df.columns.tolist()))
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
            store = app.config.get("COLUMN_TYPES_STORE", {})
            store[file_path] = {
                "categorical": cat_cols,
                "continuous": cont_cols,
            }
            app.config["COLUMN_TYPES_STORE"] = store

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

    return app