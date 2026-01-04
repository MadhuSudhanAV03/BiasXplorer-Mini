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
        Works with selected columns from the working file.

        Input JSON:
        {
          "file_path": "uploads/working_dataset.csv",
          "categorical": ["gender", "region"],
          "selected_columns": ["age", "gender", "region", "income"]  (optional)
        }

        Returns:
        Dictionary mapping column names to imbalance statistics with severity levels.
        """
        try:
            data = request.get_json(silent=True) or {}
            file_path = data.get("file_path")
            categorical = data.get("categorical")
            selected_columns = data.get("selected_columns", [])

            if not file_path:
                return jsonify({"error": "'file_path' is required in JSON body."}), 400

            # Validate path
            abs_path, error = PathValidator.validate_upload_path(
                file_path, BASE_DIR, UPLOAD_DIR)
            if error:
                return jsonify({"error": error}), 400

            # Read full dataset
            df = FileService.read_dataset(abs_path)

            # Filter to selected columns if provided (from memory store)
            if not selected_columns:
                from flask import current_app
                store = current_app.config.get("SELECTED_FEATURES_STORE", {})
                selected_columns = store.get(file_path, [])

            # If selected columns exist, use only those
            if selected_columns:
                available_cols = set(df.columns)
                cols_to_use = [
                    col for col in selected_columns if col in available_cols]
                if cols_to_use:
                    df = df[cols_to_use]

            # Use stored column types if categorical not provided
            if categorical is None:
                from flask import current_app
                store = current_app.config.get("COLUMN_TYPES_STORE", {})
                categorical = store.get(file_path, {}).get("categorical", [])

            if isinstance(categorical, str):
                categorical = [categorical]
            if not isinstance(categorical, list):
                return jsonify({"error": "'categorical' must be a list of column names if provided."}), 400

            # Detect bias only on categorical columns that exist in selected columns
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
          "file_path": "uploads/working_dataset.csv",
          "target_column": "gender",
          "method": "smote" | "oversample" | "undersample" | "reweight",
          "threshold": 0.3  (optional, desired minority/majority ratio for binary classes),
          "categorical_columns": ["col1", "col2"]  (optional, for SMOTE-NC)
        }

        Creates fixing_<file>.csv from working file, applies corrections, returns fixing file path.
        If fixing file exists, deletes it and creates fresh copy.
        """
        try:
            data = request.get_json(silent=True) or {}
            file_path = data.get("file_path")
            target_col = data.get("target_column")
            method = (data.get("method") or "").lower()
            threshold = data.get("threshold")
            categorical_columns = data.get("categorical_columns")
            # Default to True for backwards compatibility
            is_first_fix = data.get("is_first_fix", True)

            if not file_path:
                return jsonify({"error": "'file_path' is required in JSON body."}), 400
            if not target_col:
                return jsonify({"error": "'target_column' is required in JSON body."}), 400
            if not BiasCorrectionService.validate_method(method):
                return jsonify({"error": f"'method' must be one of: {', '.join(BiasCorrectionService.VALID_METHODS)}"}), 400

            # Validate path - should be working file or fixing file from uploads
            abs_path, error = PathValidator.validate_upload_path(
                file_path, BASE_DIR, UPLOAD_DIR)

            if error:
                return jsonify({"error": error}), 400

            # Determine base name and fixing file path
            filename = os.path.basename(abs_path)
            if filename.startswith("working_"):
                base_name = filename[8:]  # Remove "working_" prefix
            elif filename.startswith("fixing_"):
                base_name = filename[7:]  # Remove "fixing_" prefix
            else:
                base_name = filename  # Original file

            fixing_filename = f"fixing_{base_name}"
            fixing_path = os.path.join(UPLOAD_DIR, fixing_filename)
            fixing_rel_path = f"uploads/{fixing_filename}"

            # Logic based on is_first_fix flag
            if is_first_fix:
                # First fix in a batch: Always create fresh fixing file from source
                # Delete existing fixing file if it exists (fresh start)
                if os.path.exists(fixing_path):
                    os.remove(fixing_path)
                    print(
                        f"[FixBias] Deleted existing fixing file for fresh start: {fixing_path}")

                # Create fresh copy from source file
                df = FileService.read_dataset(abs_path)
                FileService.save_dataset(df, fixing_path, ensure_dir=True)
                print(
                    f"[FixBias] Created fresh fixing file from source: {fixing_path}")

                # Read the fixing file for corrections
                df_fixing = FileService.read_dataset(fixing_path)
            else:
                # Subsequent fix in same batch: Use existing fixing file directly
                # The file_path should now be pointing to the fixing file from previous iteration
                if not filename.startswith("fixing_"):
                    # Safety check: if not a fixing file, something went wrong
                    print(
                        f"[FixBias] WARNING: Expected fixing file for subsequent fix, got: {filename}")
                    # Fall back to creating fresh fixing file
                    if os.path.exists(fixing_path):
                        os.remove(fixing_path)
                    df = FileService.read_dataset(abs_path)
                    FileService.save_dataset(df, fixing_path, ensure_dir=True)
                    df_fixing = FileService.read_dataset(fixing_path)
                else:
                    # Use existing fixing file
                    fixing_path = abs_path
                    fixing_rel_path = file_path
                    print(
                        f"[FixBias] Using existing fixing file for sequential fix: {fixing_path}")
                    df_fixing = FileService.read_dataset(fixing_path)

            # Validate target column
            is_valid, error = BiasCorrectionService.validate_target_column(
                df_fixing, target_col)
            if not is_valid:
                return jsonify({"error": error}), 400

            # Get before statistics (from fixing file which is copy of working)
            before_stats = BiasDetectionService.get_class_distribution(
                df_fixing, target_col)

            # Apply correction to fixing file
            df_corrected, metadata = BiasCorrectionService.apply_correction(
                df_fixing, target_col, method, threshold, categorical_columns
            )

            # Get after statistics
            after_stats = BiasDetectionService.get_class_distribution(
                df_corrected, target_col)

            # Save corrected dataset to fixing file (not working file)
            FileService.save_dataset(
                df_corrected, fixing_path, ensure_dir=True)
            print(f"[FixBias] Saved corrected data to: {fixing_path}")

            # Calculate severity for after distribution
            def compute_severity(distribution_dict):
                """Calculate severity based on distribution imbalance."""
                if not distribution_dict:
                    return "N/A"

                values = [v for v in distribution_dict.values()
                          if isinstance(v, (int, float))]
                if len(values) == 0:
                    return "N/A"
                if len(values) == 1:
                    return "Severe"

                max_val = max(values)
                min_val = min(values)
                ratio = min_val / max_val if max_val > 0 else 0

                if ratio >= 0.5:
                    return "Low"
                elif ratio >= 0.2:
                    return "Moderate"
                else:
                    return "Severe"

            # Build response with severity calculation
            response = {
                "message": "Reweighting computed (dataset unchanged)." if method == "reweight"
                else "Bias correction complete.",
                "method": method,
                "before": before_stats,
                "after": {
                    **after_stats,
                    "severity": compute_severity(after_stats.get("distribution", {}))
                },
                "file_path": fixing_rel_path,  # Return fixing file path
                "working_file_path": file_path  # Also return original working path for reference
            }

            # Add class weights if reweighting
            if "class_weights" in metadata:
                response["class_weights"] = metadata["class_weights"]

            # Add categorical columns info if used
            if "categorical_columns" in metadata:
                response["categorical_columns"] = metadata["categorical_columns"]

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

            # Debug logging
            print(f"\n{'='*80}")
            print(f"[VISUALIZATION DEBUG] Column: {target_col}")
            print(f"Before path (received): {before_path}")
            print(f"Before path (absolute): {before_abs}")
            print(f"After path (received): {after_path}")
            print(f"After path (absolute): {after_abs}")
            print(f"Are paths same? {before_abs == after_abs}")
            print(f"Before dataset shape: {df_before.shape}")
            print(f"After dataset shape: {df_after.shape}")

            # Get distributions for debugging
            before_dist = df_before[target_col].value_counts(
                normalize=True).sort_index()
            after_dist = df_after[target_col].value_counts(
                normalize=True).sort_index()
            print(f"Before distribution for '{target_col}':")
            for cls, prop in before_dist.items():
                print(f"  {cls}: {prop:.4f}")
            print(f"After distribution for '{target_col}':")
            for cls, prop in after_dist.items():
                print(f"  {cls}: {prop:.4f}")
            print(f"{'='*80}\n")

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
        Works with selected columns from the working file.

        Input JSON:
        {
            "filename": "uploads/working_dataset.csv",
            "column": "age",
            "selected_columns": ["age", "gender", "income"]  (optional)
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
            selected_columns = data.get("selected_columns", [])

            if not filename or not column:
                abort(400, message="Both 'filename' and 'column' are required")

            # Support both full paths (uploads/file.csv, corrected/file.csv) and just filenames
            if filename.startswith("uploads/") or filename.startswith("corrected/"):
                # Full path provided
                abs_path, error = PathValidator.validate_any_path(
                    filename, BASE_DIR, UPLOAD_DIR, CORRECTED_DIR)
                if error:
                    abort(400, message=error)
            else:
                # Just filename provided, assume it's in uploads
                from utils.validators import FileValidator
                secured, error = FileValidator.validate_filename(filename)
                if error:
                    abort(400, message=error)
                abs_path = os.path.join(UPLOAD_DIR, secured)
                if not os.path.exists(abs_path):
                    abort(
                        404, message=f"File '{secured}' not found in uploads")

            # Read full dataset
            df = FileService.read_dataset(abs_path)

            # Filter to selected columns if provided (from memory store or parameter)
            if not selected_columns:
                from flask import current_app
                store = current_app.config.get("SELECTED_FEATURES_STORE", {})
                # Try to get from store using filename
                selected_columns = store.get(filename, [])

            # If selected columns exist, use only those
            if selected_columns:
                available_cols = set(df.columns)
                cols_to_use = [
                    col for col in selected_columns if col in available_cols]
                if cols_to_use:
                    df = df[cols_to_use]

            # Detect skewness on the filtered dataset
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
            "filename": "uploads/working_dataset.csv" or "uploads/fixing_dataset.csv",
            "columns": ["age", "income"]
        }

        If input is working file, creates fixing file. If input is fixing file, uses it directly.
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

            print(f"[FixSkew] Received filename: {filename}")
            print(f"[FixSkew] Received columns: {columns}")

            # Support both full paths and just filenames
            if filename.startswith("uploads/"):
                abs_path, error = PathValidator.validate_upload_path(
                    filename, BASE_DIR, UPLOAD_DIR)

                if error:
                    # If fixing file not found, try to find the corresponding working file
                    if "File not found" in error and "fixing_" in filename:
                        path_parts = filename.split("/")
                        filename_only = path_parts[-1] if path_parts else filename
                        if filename_only.startswith("fixing_"):
                            # Remove "fixing_" prefix
                            base_name = filename_only[7:]
                            working_filename = f"working_{base_name}"
                            working_path = "/".join(path_parts[:-1] + [working_filename]) if len(
                                path_parts) > 1 else working_filename

                            print(
                                f"[FixSkew] Fixing file not found, trying working file: {working_path}")
                            abs_path, error = PathValidator.validate_upload_path(
                                working_path, BASE_DIR, UPLOAD_DIR)

                            if error:
                                print(
                                    f"[FixSkew] Neither fixing nor working file found")
                                abort(
                                    400, message=f"Neither fixing nor working file found: {filename}")
                    else:
                        print(f"[FixSkew] Path validation error: {error}")
                        abort(400, message=error)
            else:
                # Just filename provided, assume it's in uploads
                from utils.validators import FileValidator
                secured, error = FileValidator.validate_filename(filename)
                if error:
                    abort(400, message=error)
                abs_path = os.path.join(UPLOAD_DIR, secured)
                if not os.path.exists(abs_path):
                    abort(
                        404, message=f"File '{secured}' not found in uploads")

            # Determine output file path
            base_filename = os.path.basename(abs_path)

            # Extract base name without prefix (working_ or fixing_)
            if base_filename.startswith("working_"):
                base_name = base_filename[8:]  # Remove "working_" prefix
            elif base_filename.startswith("fixing_"):
                base_name = base_filename[7:]  # Remove "fixing_" prefix
            else:
                base_name = base_filename

            # Always use fixing_ prefix for the output file
            fixing_filename = f"fixing_{base_name}"
            fixing_path = os.path.join(UPLOAD_DIR, fixing_filename)
            fixing_rel_path = f"uploads/{fixing_filename}"

            # For skewness: Always read from INPUT file and transform all columns at once
            # This ensures each column is transformed independently from original values
            print(f"[FixSkew] Reading input file: {abs_path}")
            df = FileService.read_dataset(abs_path)

            # Apply transformations to all columns in one pass
            df_corrected, transformations = SkewnessCorrectionService.correct_multiple_columns(
                df, columns)

            # Save corrected dataset to fixing file
            FileService.save_dataset(
                df_corrected, fixing_path, ensure_dir=True)
            print(f"[FixSkew] Saved corrected data to: {fixing_path}")

            return jsonify({
                "message": "Skewness correction applied successfully",
                "file_path": fixing_rel_path,  # Return fixing file path
                "working_file_path": filename if base_filename.startswith("working_") else None,
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


@blp.route('/bias/compute-summary')
class ComputeSummary(MethodView):
    def post(self):
        """
        Compute report summary statistics for bias detection and correction results.
        This endpoint consolidates frontend calculations to the backend.

        Input JSON:
        {
            "bias_results": {...},  // Detection results for categorical columns
            "skewness_results": {...},  // Detection results for continuous columns
            "bias_fix_result": {...},  // Fix results from bias correction
            "skewness_fix_result": {...},  // Fix results from skewness correction
            "selected_columns": [...],  // Columns selected in Step 3
            "categorical": [...],  // Categorical column names
            "continuous": [...]  // Continuous column names
        }

        Returns:
        {
            "bias_summary": {...},  // Updated bias summary with severity
            "correction_summary": {
                "corrected_file_path": "...",
                "categorical": {...},  // Per-column categorical fixes
                "continuous": {...},  // Per-column continuous fixes
                "meta": {
                    "categorical": {
                        "total_selected": 5,
                        "needing_fix": 3,
                        "fixed": 2
                    },
                    "continuous": {
                        "total_selected": 4,
                        "needing_fix": 2,
                        "fixed": 2
                    }
                }
            }
        }
        """
        try:
            data = request.get_json(silent=True) or {}

            # Extract input data
            bias_results = data.get("bias_results", {})
            skewness_results = data.get("skewness_results", {})
            bias_fix_result = data.get("bias_fix_result")
            skewness_fix_result = data.get("skewness_fix_result")
            selected_columns = data.get("selected_columns", [])
            categorical = data.get("categorical", [])
            continuous = data.get("continuous", [])

            # Helper: compute severity from distribution
            def compute_severity(distribution_obj):
                if not distribution_obj:
                    return "N/A"

                values = [v for k, v in distribution_obj.items()
                          if k not in ["severity", "note"] and isinstance(v, (int, float))]

                if len(values) == 0:
                    return "N/A"
                if len(values) == 1:
                    return "Severe"

                max_val = max(values)
                min_val = min(values)
                ratio = min_val / max_val if max_val > 0 else 0

                if ratio >= 0.5:
                    return "Low"
                elif ratio >= 0.2:
                    return "Moderate"
                else:
                    return "Severe"

            # Build updated bias summary
            base_bias = dict(bias_results)

            if bias_fix_result:
                bias_cols = bias_fix_result.get("columns", {})
                for col, data in bias_cols.items():
                    after_dist = data.get("after", {}).get("distribution", {})
                    severity = compute_severity(after_dist)
                    entry = {**after_dist, "severity": severity}
                    base_bias[col] = entry

            bias_summary = base_bias if base_bias else None

            # Build correction summary
            categorical_summary = {}
            continuous_summary = {}

            if bias_fix_result:
                bias_cols = bias_fix_result.get("columns", {})
                for col, data in bias_cols.items():
                    categorical_summary[col] = {
                        "method": data.get("method"),
                        "threshold": data.get("threshold"),
                        "before": data.get("before"),
                        "after": data.get("after")
                    }

            if skewness_fix_result:
                transformations = skewness_fix_result.get(
                    "transformations", {})
                for col, info in transformations.items():
                    continuous_summary[col] = {
                        "method": info.get("method"),
                        "original_skewness": info.get("original_skewness"),
                        "new_skewness": info.get("new_skewness"),
                        "error": info.get("error")
                    }

            # Compute counts
            total_selected_bias = len(
                [col for col in selected_columns if col in categorical])
            total_selected_skew = len(
                [col for col in selected_columns if col in continuous])

            needing_fix_bias = len([col for col in categorical
                                   if bias_results.get(col, {}).get("severity") in ["Moderate", "Severe"]])

            needing_fix_skew = len([col for col in continuous
                                   if skewness_results.get(col, {}).get("skewness") is not None
                                   and abs(skewness_results.get(col, {}).get("skewness", 0)) > 0.5])

            # Get corrected file path
            corrected_path = ""
            if skewness_fix_result:
                corrected_path = skewness_fix_result.get("corrected_file_path") or \
                    skewness_fix_result.get("corrected_file") or ""
            if not corrected_path and bias_fix_result:
                corrected_path = bias_fix_result.get("corrected_file_path", "")

            # Build correction summary with timestamp
            import time
            ts = int(time.time() * 1000)

            correction_summary = None
            if categorical_summary or continuous_summary:
                # Add timestamp and path to each column entry
                for col in categorical_summary:
                    categorical_summary[col]["ts"] = ts
                    categorical_summary[col]["corrected_file_path"] = corrected_path or None

                for col in continuous_summary:
                    continuous_summary[col]["ts"] = ts
                    continuous_summary[col]["corrected_file_path"] = corrected_path or None

                correction_summary = {
                    "corrected_file_path": corrected_path,
                    "categorical": categorical_summary,
                    "continuous": continuous_summary,
                    "meta": {
                        "categorical": {
                            "total_selected": total_selected_bias,
                            "needing_fix": needing_fix_bias,
                            "fixed": len(categorical_summary)
                        },
                        "continuous": {
                            "total_selected": total_selected_skew,
                            "needing_fix": needing_fix_skew,
                            "fixed": len(continuous_summary)
                        }
                    }
                }

            return jsonify({
                "bias_summary": bias_summary,
                "correction_summary": correction_summary
            }), 200

        except Exception as e:
            return jsonify({"error": str(e)}), 400
