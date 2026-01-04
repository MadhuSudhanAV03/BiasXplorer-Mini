import { useNavigate, Link } from "react-router-dom";
import FileUpload from "../components/FileUpload";

export default function Upload() {
  const navigate = useNavigate();

  const handleUploadSuccess = (uploadResult) => {
    // uploadResult contains: { originalFilePath, workingFilePath, filePath }
    // Navigate to dashboard with upload result in route state
    navigate("/dashboard", { state: { uploadResult } });
  };

  const clearAllData = () => {
    // Clear all localStorage data
    localStorage.clear();
    alert("Application data has been cleared!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 animate-gradient">
      <header className="border-b border-white/30 glass-effect sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div className="animate-fadeInDown">
              <div className="flex items-center gap-3">
                <div className="text-4xl animate-float">🔍</div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-extrabold text-gradient-blue tracking-tight">
                    BiasXplorer
                  </h1>
                  <p className="text-sm text-slate-600 mt-0.5 font-medium">
                    Discover & Fix Dataset Bias with AI
                  </p>
                </div>
              </div>
            </div>
            <nav className="flex items-center gap-3 animate-fadeInDown">
              <Link
                to="/"
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-white/50 rounded-xl transition-all duration-300"
              >
                🏠 Home
              </Link>
              <Link
                to="/dashboard"
                className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 card-hover-lift"
              >
                📊 Dashboard
              </Link>
              <Link
                to="/report"
                className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 card-hover-lift"
              >
                📄 Reports
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* Back Button */}
        <div className="mb-6 animate-fadeInDown">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
          >
            <span>←</span>
            <span>Back to Home</span>
          </Link>
        </div>

        {/* Hero Section */}
        <div className="text-center mb-12 animate-fadeInUp">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4">
            Upload Your
            <span className="text-gradient-blue"> Dataset</span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Start your bias detection journey by uploading your CSV or Excel
            file. Our system will analyze and help you correct any imbalances.
          </p>
        </div>

        {/* Upload Section */}
        <div className="grid grid-cols-1 gap-6">
          <section className="rounded-3xl border-2 border-white/50 glass-effect p-8 shadow-2xl animate-fadeInUp stagger-1">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">📁</span>
                  <h2 className="text-2xl font-bold text-slate-800">
                    Choose Your File
                  </h2>
                </div>
                <p className="text-sm text-slate-600 ml-12">
                  Supported formats:{" "}
                  <span className="font-semibold">CSV, XLS, XLSX</span> •
                  Maximum size: 50MB
                </p>
              </div>
              <button
                onClick={clearAllData}
                className="px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-red-500 to-pink-500 text-white hover:from-red-600 hover:to-pink-600 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 card-hover-lift flex items-center gap-2"
              >
                <span>🗑️</span>
                <span>Clear All Data</span>
              </button>
            </div>
            <FileUpload onUploadSuccess={handleUploadSuccess} />
          </section>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 animate-fadeInUp stagger-2">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-blue-100">
            <div className="text-3xl mb-3">1️⃣</div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              Upload Dataset
            </h3>
            <p className="text-sm text-slate-600">
              Choose your CSV or Excel file containing the data you want to
              analyze
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-purple-100 stagger-1">
            <div className="text-3xl mb-3">2️⃣</div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              Configure Analysis
            </h3>
            <p className="text-sm text-slate-600">
              Select columns, classify types, and preprocess your data
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-pink-100 stagger-2">
            <div className="text-3xl mb-3">3️⃣</div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              Fix & Export
            </h3>
            <p className="text-sm text-slate-600">
              Apply corrections and download your balanced dataset
            </p>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center animate-fadeInUp stagger-3">
          <p className="text-sm text-slate-500">
            🔒 Your data is processed securely and never shared with third
            parties
          </p>
        </div>
      </main>
    </div>
  );
}
