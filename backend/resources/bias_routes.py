"""Refactored bias detection and correction routes using service layer."""
import os
from flask import request, jsonify
from flask.views import MethodView
from flask_smorest import Blueprint, abort

from services import (
    FileService,
    BiasDetectionService,
    BiasCorrectionService,
    SkewnessDetectionService,
    SkewnessCorrectionService,
    VisualizationService
)
from utils.validators import PathValidator

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
CORRECTED_DIR = os.path.join(BASE_DIR, "corrected")

blp = Blueprint("bias", __name__, url_prefix="/api",
                description="Bias detection and correction operations")


@blp.route('/bias/detect')
class DetectBias(MethodView):
    def post(self):
        """
        Detect class imbalance for given categorical columns.

        Input JSON:
        {
          "file_path": "uploads/selected_dataset.csv",
          "categorical": ["gender", "region"]
        }

        Returns:
        Dictionary mapping column names to imbalance statistics with severity levels.
        """
        try:
            data = request.get_json(silent=True) or {}
            file_path = data.get("file_path")
            categorical = data.get("categorical")

            if not file_path:
                return jsonify({"error": "'file_path' is required in JSON body."}), 400

            # Validate path
            abs_path, error = PathValidator.validate_upload_path(
                file_path, BASE_DIR, UPLOAD_DIR)
            if error:
                return jsonify({"error": error}), 400

            # Read dataset
            df = FileService.read_dataset(abs_path)

            # Use stored column types if categorical not provided
            if categorical is None:
                from flask import current_app
                store = current_app.config.get("COLUMN_TYPES_STORE", {})
                categorical = store.get(file_path, {}).get("categorical", [])

            if isinstance(categorical, str):
                categorical = [categorical]
            if not isinstance(categorical, list):
                return jsonify({"error": "'categorical' must be a list of column names if provided."}), 400

            # Detect bias
            result = BiasDetectionService.detect_imbalance(df, categorical)

            return jsonify(result), 200

        except FileNotFoundError:
            return jsonify({"error": "File not found."}), 400
        except ValueError as e:
            return jsonify({"error": f"Invalid file format: {str(e)}"}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 400


@blp.route("/bias/fix")
class FixBias(MethodView):
    def post(self):
        """
        Handle categorical imbalance correction.

        Input JSON:
        {
          "file_path": "uploads/selected_dataset.csv",
          "target_column": "gender",
          "method": "smote" | "oversample" | "undersample" | "reweight",
          "threshold": 0.3  (optional, desired minority/majority ratio for binary classes)
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
            if not BiasCorrectionService.validate_method(method):
                return jsonify({"error": f"'method' must be one of: {', '.join(BiasCorrectionService.VALID_METHODS)}"}), 400

            # Validate path
            abs_path, error = PathValidator.validate_upload_path(
                file_path, BASE_DIR, UPLOAD_DIR)
            if error:
                return jsonify({"error": error}), 400

            # Read dataset
            df = FileService.read_dataset(abs_path)

            # Validate target column
            is_valid, error = BiasCorrectionService.validate_target_column(
                df, target_col)
            if not is_valid:
                return jsonify({"error": error}), 400

            # Get before statistics
            before_stats = BiasDetectionService.get_class_distribution(
                df, target_col)

            # Apply correction
            df_corrected, metadata = BiasCorrectionService.apply_correction(
                df, target_col, method, threshold
            )

            # Get after statistics
            after_stats = BiasDetectionService.get_class_distribution(
                df_corrected, target_col)

            # Save corrected dataset
            corrected_filename = "corrected_dataset.csv"
            corrected_path = os.path.join(CORRECTED_DIR, corrected_filename)
            FileService.save_dataset(
                df_corrected, corrected_path, ensure_dir=True)

            # Build response
            response = {
                "message": "Reweighting computed (dataset unchanged)." if method == "reweight"
                else "Bias correction complete.",
                "method": method,
                "before": before_stats,
                "after": after_stats,
                "corrected_file_path": f"corrected/{corrected_filename}"
            }

            # Add class weights if reweighting
            if "class_weights" in metadata:
                response["class_weights"] = metadata["class_weights"]

            return jsonify(response), 200

        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except FileNotFoundError:
            return jsonify({"error": "File not found."}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 400


@blp.route('/bias/visualize')
class VisualizeBias(MethodView):
    def post(self):
        """
        Create bar plots (base64 PNG) of class distributions before and after correction.

        Input JSON:
        {
          "before_path": "uploads/selected_dataset.csv",
          "after_path": "corrected/corrected_dataset.csv",
          "target_column": "gender"
        }

        Returns:
        {"before_chart": "<base64>", "after_chart": "<base64>"}
        """
        try:
            data = request.get_json(silent=True) or {}
            before_path = data.get("before_path")
            after_path = data.get("after_path")
            target_col = data.get("target_column")

            if not before_path or not after_path or not target_col:
                return jsonify({"error": "'before_path', 'after_path', and 'target_column' are required."}), 400

            # Validate paths
            before_abs, error = PathValidator.validate_any_path(
                before_path, BASE_DIR, UPLOAD_DIR, CORRECTED_DIR)
            if error:
                return jsonify({"error": f"Before path: {error}"}), 400

            after_abs, error = PathValidator.validate_any_path(
                after_path, BASE_DIR, UPLOAD_DIR, CORRECTED_DIR)
            if error:
                return jsonify({"error": f"After path: {error}"}), 400

            # Read datasets
            df_before = FileService.read_dataset(before_abs)
            df_after = FileService.read_dataset(after_abs)

            # Validate target column exists
            if target_col not in df_before.columns:
                return jsonify({"error": f"Target column '{target_col}' not found in before dataset."}), 400
            if target_col not in df_after.columns:
                return jsonify({"error": f"Target column '{target_col}' not found in after dataset."}), 400

            # Generate visualizations
            charts = VisualizationService.visualize_categorical_bias(
                df_before, df_after, target_col)

            return jsonify(charts), 200

        except FileNotFoundError:
            return jsonify({"error": "File not found."}), 400
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 400


@blp.route("/skewness/detect")
class DetectSkew(MethodView):
    @blp.response(200, description="Skewness computed successfully")
    def post(self):
        """
        Detect skewness in a specific column of an uploaded dataset.

        Input JSON:
        {
            "filename": "dataset.csv",
            "column": "age"
        }

        Returns:
        {
            "column": "age",
            "skewness": 0.4521,
            "n_nonnull": 150,
            "message": "ok"
        }
        """
        try:
            data = request.get_json()
            if not data:
                abort(400, message="Request body must be JSON")

            filename = data.get("filename")
            column = data.get("column")

            if not filename or not column:
                abort(400, message="Both 'filename' and 'column' are required")

            # Validate filename
            from utils.validators import FileValidator
            secured, error = FileValidator.validate_filename(filename)
            if error:
                abort(400, message=error)

            # Build and validate path
            file_path = os.path.join(UPLOAD_DIR, secured)
            if not os.path.abspath(file_path).startswith(os.path.abspath(UPLOAD_DIR)):
                abort(400, message="Invalid file path")
            if not os.path.exists(file_path):
                abort(404, message=f"File '{secured}' not found")

            # Read dataset
            df = FileService.read_dataset(file_path)

            # Detect skewness
            result = SkewnessDetectionService.detect_skewness(df, column)

            return jsonify(result), 200

        except ValueError as e:
            abort(400, message=str(e))
        except Exception as e:
            if hasattr(e, 'code'):
                raise
            abort(500, message=f"Unexpected error: {str(e)}")


@blp.route("/skewness/fix")
class FixSkew(MethodView):
    @blp.response(200, description="Skewness correction applied successfully")
    def post(self):
        """
        Fix skewness in continuous columns by applying appropriate transformations.

        Input JSON:
        {
            "filename": "dataset.csv",
            "columns": ["age", "income"]
        }

        Returns transformation results including before/after skewness and methods applied.
        """
        try:
            data = request.get_json()
            if not data:
                abort(400, message="Request body must be JSON")

            filename = data.get("filename")
            columns = data.get("columns")

            if not filename:
                abort(400, message="'filename' is required")
            if not columns or not isinstance(columns, list):
                abort(400, message="'columns' must be a non-empty list")

            # Validate filename
            from utils.validators import FileValidator
            secured, error = FileValidator.validate_filename(filename)
            if error:
                abort(400, message=error)

            # Build and validate path
            file_path = os.path.join(UPLOAD_DIR, secured)
            if not os.path.abspath(file_path).startswith(os.path.abspath(UPLOAD_DIR)):
                abort(400, message="Invalid file path")
            if not os.path.exists(file_path):
                abort(404, message=f"File '{secured}' not found")

            # Read dataset
            df = FileService.read_dataset(file_path)

            # Apply skewness corrections
            df_corrected, transformations = SkewnessCorrectionService.correct_multiple_columns(
                df, columns)

            # Save corrected dataset
            corrected_filename = "corrected_dataset.csv"
            corrected_path = os.path.join(CORRECTED_DIR, corrected_filename)
            FileService.save_dataset(
                df_corrected, corrected_path, ensure_dir=True)

            return jsonify({
                "message": "Skewness correction applied successfully",
                "corrected_file": f"corrected/{corrected_filename}",
                "transformations": transformations
            }), 200

        except Exception as e:
            if hasattr(e, 'code'):
                raise
            abort(500, message=f"Unexpected error: {str(e)}")


@blp.route("/skewness/visualize")
class VisualizeSkew(MethodView):
    @blp.response(200, description="Skewness visualization generated successfully")
    def post(self):
        """
        Create distribution plots (histograms + KDE) for continuous columns before and after skewness correction.

        Input JSON:
        {
            "before_path": "uploads/dataset.csv",
            "after_path": "corrected/corrected_dataset.csv",
            "columns": ["age", "income"]
        }

        Returns base64-encoded histogram plots with KDE overlays for each column.
        """
        try:
            data = request.get_json()
            if not data:
                abort(400, message="Request body must be JSON")

            before_path = data.get("before_path")
            after_path = data.get("after_path")
            columns = data.get("columns")

            if not before_path or not after_path:
                abort(400, message="'before_path' and 'after_path' are required")
            if not columns or not isinstance(columns, list):
                abort(400, message="'columns' must be a non-empty list")

            # Validate paths
            before_abs, error = PathValidator.validate_any_path(
                before_path, BASE_DIR, UPLOAD_DIR, CORRECTED_DIR)
            if error:
                abort(400, message=f"Before path error: {error}")

            after_abs, error = PathValidator.validate_any_path(
                after_path, BASE_DIR, UPLOAD_DIR, CORRECTED_DIR)
            if error:
                abort(400, message=f"After path error: {error}")

            # Read datasets
            df_before = FileService.read_dataset(before_abs)
            df_after = FileService.read_dataset(after_abs)

            # Generate visualizations
            charts = VisualizationService.visualize_skewness(
                df_before, df_after, columns)

            return jsonify({"charts": charts}), 200

        except Exception as e:
            if hasattr(e, 'code'):
                raise
            abort(500, message=f"Unexpected error: {str(e)}")
