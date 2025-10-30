import { useCallback, useRef, useState } from "react";
import axios from "axios";
import Spinner from "./Spinner";

const ALLOWED_EXTENSIONS = ["csv", "xls", "xlsx"]; // lowercase
const UPLOAD_URL = "http://localhost:5000/upload"; // Flask route (not under /api)

export default function FileUpload({ onUploadSuccess, className = "" }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState({ visible: false, type: "success", message: "" });
  const fileInputRef = useRef(null);

  const showToast = useCallback((type, message) => {
    setToast({ visible: true, type, message });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  }, []);

  const validateFile = (file) => {
    if (!file) return false;
    const ext = file.name.split(".").pop().toLowerCase();
    return ALLOWED_EXTENSIONS.includes(ext);
  };

  const uploadFile = async (file) => {
    if (!validateFile(file)) {
      showToast("error", "Invalid file type. Only CSV, XLS, XLSX are allowed.");
      return;
    }
    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post(UPLOAD_URL, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: false,
      });

      const filePath = res?.data?.file_path;
      if (filePath) {
        onUploadSuccess?.(filePath);
        showToast("success", "File uploaded successfully.");
      } else {
        showToast("error", "Upload succeeded but no file path returned.");
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || "Upload failed";
      showToast("error", `Upload error: ${msg}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
    // reset input value to allow selecting the same file again
    e.target.value = "";
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-150 ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-slate-300"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="text-slate-600">Drag & drop your dataset here</div>
          <div className="text-xs text-slate-500">Accepted: .csv, .xls, .xlsx</div>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? "Uploading..." : "Choose File"}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xls,.xlsx"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {isUploading && (
        <div className="mt-3">
          <Spinner text="Uploading..." />
        </div>
      )}

      {/* Toast */}
      {toast.visible && (
        <div
          className={`fixed bottom-4 right-4 z-50 rounded-md px-4 py-3 shadow-lg ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
