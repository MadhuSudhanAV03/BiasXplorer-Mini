"""File validation utilities."""
import os
from werkzeug.utils import secure_filename

ALLOWED_EXTENSIONS = {"csv", "xls", "xlsx"}


class FileValidator:
    """Validates file uploads and types."""

    @staticmethod
    def allowed_file(filename: str) -> bool:
        """Check if file extension is allowed."""
        return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

    @staticmethod
    def validate_filename(filename: str) -> tuple[str, str | None]:
        """
        Validate and secure a filename.
        
        Returns:
            Tuple of (secure_filename, error_message)
        """
        if not filename:
            return "", "No filename provided"

        secured = secure_filename(filename)
        if not secured:
            return "", "Invalid filename"

        if not FileValidator.allowed_file(secured):
            return "", "Invalid file type. Only CSV, XLS, XLSX are allowed"

        return secured, None

    @staticmethod
    def get_file_extension(filepath: str) -> str:
        """Get lowercase file extension."""
        return os.path.splitext(filepath)[1].lower()
