"""Path validation utilities for secure file operations."""
import os


class PathValidator:
    """Validates and normalizes file paths to prevent security issues."""

    @staticmethod
    def validate_upload_path(file_path: str, base_dir: str, upload_dir: str) -> tuple[str, str | None]:
        """
        Validate that a file path is within the uploads directory.

        Args:
            file_path: Relative file path from request
            base_dir: Base directory of the application
            upload_dir: Upload directory path

        Returns:
            Tuple of (absolute_path, error_message)
            If error_message is None, the path is valid
        """
        if not file_path:
            return "", "'file_path' is required"

        # Normalize and validate path: must be relative
        norm_rel_path = os.path.normpath(file_path)
        if os.path.isabs(norm_rel_path):
            return "", "Absolute paths are not allowed. Use relative path under 'uploads/'"

        abs_path = os.path.join(base_dir, norm_rel_path)

        # Normalize paths for comparison (important on Windows)
        abs_path_norm = os.path.normpath(os.path.abspath(abs_path))
        upload_dir_norm = os.path.normpath(os.path.abspath(upload_dir))

        # Ensure resolved path is inside the UPLOAD_DIR to prevent path traversal
        if not abs_path_norm.startswith(upload_dir_norm):
            return "", "Invalid file_path. Must be within the 'uploads/' directory"

        if not os.path.exists(abs_path):
            return "", f"File not found: {file_path}"

        return abs_path, None

    @staticmethod
    def validate_any_path(file_path: str, base_dir: str, upload_dir: str, corrected_dir: str) -> tuple[str, str | None]:
        """
        Validate path that can be in either uploads/ or corrected/ directory.

        Args:
            file_path: Relative file path from request
            base_dir: Base directory of the application
            upload_dir: Upload directory path
            corrected_dir: Corrected directory path

        Returns:
            Tuple of (absolute_path, error_message)
        """
        if not file_path:
            return "", "File path is required"

        norm_rel = os.path.normpath(file_path)
        if os.path.isabs(norm_rel):
            return "", "Absolute paths are not allowed. Use relative paths under 'uploads/' or 'corrected/'"

        abs_p = os.path.join(base_dir, norm_rel)

        # Determine base directory by prefix
        path_parts = norm_rel.split(os.sep)
        if path_parts[0] == "uploads":
            allowed_base = upload_dir
        elif path_parts[0] == "corrected":
            allowed_base = corrected_dir
        else:
            return "", "Path must start with 'uploads/' or 'corrected/'"

        # Validate path is within base directory
        try:
            abs_p_norm = os.path.normpath(os.path.abspath(abs_p))
            base_norm = os.path.normpath(os.path.abspath(allowed_base))
            if not abs_p_norm.startswith(base_norm):
                return "", "Invalid path; must stay within its base directory"
        except Exception:
            return "", "Invalid path provided"

        if not os.path.exists(abs_p):
            return "", f"File not found: {file_path}"

        return abs_p, None
