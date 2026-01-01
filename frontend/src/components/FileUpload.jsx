import { useCallback, useRef, useState } from "react";
import axios from "axios";
import Spinner from "./Spinner";

const ALLOWED_EXTENSIONS = ["csv", "xls", "xlsx"]; // lowercase
const UPLOAD_URL = "http://localhost:5000/api/upload";

export default function FileUpload({ onUploadSuccess, className = "" }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    type: "success",
    message: "",
  });
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

      // Backend now returns: original_file_path, working_file_path, and file_path (working)
      const uploadResult = {
        originalFilePath: res?.data?.original_file_path,
        workingFilePath: res?.data?.working_file_path || res?.data?.file_path,
        filePath: res?.data?.file_path, // For backward compatibility
      };

      if (uploadResult.workingFilePath) {
        onUploadSuccess?.(uploadResult);
        showToast(
          "success",
          "File uploaded successfully. Working copy created."
        );
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
        className={`relative border-3 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
          isDragging
            ? "border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 scale-105 shadow-2xl animate-pulseGlow"
            : "border-slate-300 bg-gradient-to-br from-white to-slate-50 hover:border-blue-400 hover:shadow-xl"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="flex flex-col items-center gap-5">
          {/* Icon */}
          <div className="text-7xl transition-all duration-300">
            {isDragging ? "📥" : "📂"}
          </div>

          {/* Text */}
          <div>
            <div className="text-xl font-bold text-slate-800 mb-2">
              {isDragging ? "Drop your file here!" : "Drag & Drop Your Dataset"}
            </div>
            <div className="text-sm text-slate-500">
              or click the button below to browse
            </div>
          </div>

          {/* Supported formats */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
              📄 CSV
            </span>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
              📊 XLS
            </span>
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
              📈 XLSX
            </span>
          </div>

          {/* Upload Button */}
          <button
            type="button"
            className="relative inline-flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-4 text-white font-bold text-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl transition-all duration-300 button-ripple min-w-[220px]"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <span>⏳</span>
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <span>📤</span>
                <span>Choose File</span>
              </>
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xls,.xlsx"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Decorative elements */}
        {!isUploading && (
          <>
            <div className="absolute top-4 left-4 w-20 h-20 bg-blue-200/30 rounded-full blur-2xl"></div>
            <div className="absolute bottom-4 right-4 w-32 h-32 bg-purple-200/30 rounded-full blur-3xl"></div>
          </>
        )}
      </div>

      {/* Toast */}
      {toast.visible && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-2xl px-6 py-4 shadow-2xl animate-slideInRight ${
            toast.type === "success"
              ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
              : "bg-gradient-to-r from-red-500 to-pink-500 text-white"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {toast.type === "success" ? "✅" : "❌"}
            </span>
            <span className="font-semibold">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
