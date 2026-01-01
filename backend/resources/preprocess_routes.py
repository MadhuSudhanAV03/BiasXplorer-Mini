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
        """Preprocess the dataset: handle missing values and duplicates with column-specific strategies.
        Input JSON:
        {
          "file_path": "uploads/selected_filename.csv",
          "selected_columns": ["age", "gender", "income"],
          "fill_strategies": {
            "age": "mean",      // Options: "remove", "mean", "median", "mode"
            "gender": "mode",   // For categorical: "remove" or "mode"
            "income": "remove"
          }
        }

        Processing steps:
        1. Count missing values per column
        2. Apply fill strategy for each column:
           - "remove": Drop rows with NaN in this column
           - "mean": Fill with mean (continuous only)
           - "median": Fill with median (continuous only)
           - "mode": Fill with mode (works for both categorical and continuous)
        3. Drop duplicate rows considering selected columns
        4. Save cleaned CSV as uploads/cleaned_<original_basename>.csv

        Returns JSON summary with statistics.
        """
        try:
            data = request.get_json(silent=True) or {}
            file_path = data.get("file_path")
            selected_columns = data.get("selected_columns", [])
            fill_strategies = data.get("fill_strategies", {})

            if not file_path:
                return jsonify({"error": "'file_path' is required in JSON body."}), 400

            # Validate path
            abs_path, error = PathValidator.validate_upload_path(
                file_path, BASE_DIR, UPLOAD_DIR)
            if error:
                return jsonify({"error": error}), 400

            # Read dataset
            df = FileService.read_dataset(abs_path)

            # Determine columns to clean
            if selected_columns and len(selected_columns) > 0:
                # Validate selected columns exist
                df_columns = set(df.columns)
                selected_set = set(selected_columns)
                missing_cols = selected_set - df_columns
                if missing_cols:
                    return jsonify({
                        "error": "Some selected columns not found in dataset.",
                        "details": {"missing_columns": list(missing_cols)}
                    }), 400
                columns_to_clean = selected_columns
            else:
                # If no selected columns provided, clean all columns
                columns_to_clean = df.columns.tolist()

            # Count missing values before cleaning
            missing_before = df[columns_to_clean].isna().sum().to_dict()
            rows_before = len(df)

            # Track fill actions and rows removed per column
            fill_actions = {}
            total_rows_removed = 0

            # Process columns SEQUENTIALLY - each operation updates df for next column
            for col in columns_to_clean:
                # Default to keep (do nothing)
                strategy = fill_strategies.get(col, "keep")
                rows_before_col = len(df)

                if strategy == "keep":
                    # Do nothing - keep missing values as is
                    missing_count = df[col].isna().sum()
                    fill_actions[col] = f"Kept {missing_count} missing values unchanged"

                elif strategy == "remove":
                    # Drop rows with NaN in THIS column, changes propagate to next iterations
                    df = df.dropna(subset=[col])
                    rows_removed_this_col = rows_before_col - len(df)
                    total_rows_removed += rows_removed_this_col
                    fill_actions[col] = f"Removed {rows_removed_this_col} rows with NaN"

                elif strategy == "mean":
                    if df[col].dtype in ['float64', 'float32', 'int64', 'int32']:
                        # Recalculate mean based on current df state (after previous operations)
                        mean_val = df[col].mean()
                        filled_count = df[col].isna().sum()
                        df[col].fillna(mean_val, inplace=True)
                        fill_actions[col] = f"Filled {filled_count} values with mean ({mean_val:.2f})"
                    else:
                        # Fallback to mode for non-numeric
                        mode_val = df[col].mode(
                        )[0] if not df[col].mode().empty else None
                        if mode_val is not None:
                            filled_count = df[col].isna().sum()
                            df[col].fillna(mode_val, inplace=True)
                            fill_actions[col] = f"Filled {filled_count} values with mode ({mode_val})"
                        else:
                            fill_actions[col] = "No valid mode found, values unchanged"

                elif strategy == "median":
                    if df[col].dtype in ['float64', 'float32', 'int64', 'int32']:
                        # Recalculate median based on current df state
                        median_val = df[col].median()
                        filled_count = df[col].isna().sum()
                        df[col].fillna(median_val, inplace=True)
                        fill_actions[
                            col] = f"Filled {filled_count} values with median ({median_val:.2f})"
                    else:
                        # Fallback to mode for non-numeric
                        mode_val = df[col].mode(
                        )[0] if not df[col].mode().empty else None
                        if mode_val is not None:
                            filled_count = df[col].isna().sum()
                            df[col].fillna(mode_val, inplace=True)
                            fill_actions[col] = f"Filled {filled_count} values with mode ({mode_val})"
                        else:
                            fill_actions[col] = "No valid mode found, values unchanged"

                elif strategy == "mode":
                    # Recalculate mode based on current df state
                    mode_val = df[col].mode(
                    )[0] if not df[col].mode().empty else None
                    if mode_val is not None:
                        filled_count = df[col].isna().sum()
                        df[col].fillna(mode_val, inplace=True)
                        fill_actions[col] = f"Filled {filled_count} values with mode ({mode_val})"
                    else:
                        fill_actions[col] = "No valid mode found, values unchanged"

            rows_after_dropna = len(df)

            # Drop duplicate rows considering SELECTED columns only
            # This happens AFTER all column-specific operations
            rows_before_dedup = len(df)
            df = df.drop_duplicates(subset=columns_to_clean)
            rows_after = len(df)
            duplicates_removed = rows_before_dedup - rows_after

            # Save back to the SAME working file (in-place modification)
            # No separate cleaned_ file is created
            FileService.save_dataset(df, abs_path, ensure_dir=True)

            rows, cols = df.shape

            return jsonify({
                "message": "Preprocessing complete (working file modified in-place, sequential per column)",
                "selected_columns_cleaned": columns_to_clean,
                "fill_actions": fill_actions,
                "missing_values": {k: int(v) for k, v in missing_before.items() if v > 0},
                "rows_before": int(rows_before),
                "rows_with_na_removed": int(total_rows_removed),
                "duplicates_removed": int(duplicates_removed),
                "rows_after": int(rows_after),
                "dataset_shape": [int(rows), int(cols)],
                "file_path": file_path  # Return same file path - modified in-place
            }), 200

        except FileNotFoundError:
            return jsonify({"error": "File not found."}), 400
        except ValueError as e:
            return jsonify({"error": f"Invalid file format: {str(e)}"}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 400
