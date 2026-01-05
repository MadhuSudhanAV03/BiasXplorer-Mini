"""File handling service for reading and writing datasets."""
import os
import pandas as pd


class FileService:
    """Handles file I/O operations for datasets."""

    @staticmethod
    def read_dataset(filepath: str) -> pd.DataFrame:
        """
        Read a dataset from CSV or Excel file.

        Args:
            filepath: Absolute path to the file

        Returns:
            pandas DataFrame

        Raises:
            ValueError: If file type is unsupported
            FileNotFoundError: If file doesn't exist
        """
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"File not found: {filepath}")

        ext = os.path.splitext(filepath)[1].lower()

        if ext == ".csv":
            return pd.read_csv(filepath, sep=None, engine='python')
        elif ext in (".xls", ".xlsx"):
            return pd.read_excel(filepath)
        else:
            raise ValueError(
                f"Unsupported file type: {ext}. Only .csv, .xls, .xlsx are supported")

    @staticmethod
    def save_dataset(df: pd.DataFrame, filepath: str, ensure_dir: bool = True) -> None:
        """
        Save a DataFrame to CSV file.

        Args:
            df: DataFrame to save
            filepath: Absolute path where to save
            ensure_dir: Create directory if it doesn't exist
        """
        if ensure_dir:
            os.makedirs(os.path.dirname(filepath), exist_ok=True)

        df.to_csv(filepath, index=False)

    @staticmethod
    def get_preview(df: pd.DataFrame, rows: int = 10) -> dict:
        """
        Get preview of DataFrame as JSON-serializable dict.

        Args:
            df: DataFrame to preview
            rows: Number of rows to include

        Returns:
            Dict with 'columns' and 'preview' keys
        """
        import numpy as np

        head_df = df.head(rows)
        # Replace NaN/NaT with None for JSON compatibility
        clean_df = head_df.replace({np.nan: None, pd.NaT: None})
        columns = list(map(str, clean_df.columns.tolist()))
        preview_records = clean_df.to_dict(orient="records")

        return {
            "columns": columns,
            "preview": preview_records
        }

    @staticmethod
    def get_columns(df: pd.DataFrame) -> list[str]:
        """Get list of column names from DataFrame."""
        return list(map(str, df.columns.tolist()))
