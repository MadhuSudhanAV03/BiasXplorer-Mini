import { useNavigate, Link } from "react-router-dom";
import FileUpload from "../components/FileUpload";

export default function Home() {
  const navigate = useNavigate();

  const handleUploadSuccess = (filePath) => {
    // Navigate to dashboard with filePath in route state
    navigate("/dashboard", { state: { filePath } });
  };

  const clearAllData = () => {
    // Clear all dashboard related localStorage items
    localStorage.removeItem("dashboard_currentStep");
    localStorage.removeItem("dashboard_columns");
    localStorage.removeItem("dashboard_selectedColumns");
    localStorage.removeItem("dashboard_categorical");
    localStorage.removeItem("dashboard_continuous");
    localStorage.removeItem("dashboard_selectedFilePath");
    localStorage.removeItem("dashboard_biasSummary");
    localStorage.removeItem("dashboard_biasResults");
    localStorage.removeItem("dashboard_skewnessResults");
    localStorage.removeItem("dashboard_targetColumn");
    localStorage.removeItem("dashboard_filePath");
    localStorage.removeItem("dashboard_cleanedFilePath");
    localStorage.removeItem("dashboard_correctedFilePath");
    localStorage.removeItem("dashboard_beforeFixFilePath");
    localStorage.removeItem("dashboard_visualizationKey");
    localStorage.removeItem("dashboard_fixedCategoricalColumns");
    localStorage.removeItem("dashboard_fixedContinuousColumns");
    localStorage.removeItem("dashboard_biasFixResult");
    localStorage.removeItem("dashboard_skewnessFixResult");
    localStorage.removeItem("dashboard_biasSelectedColumns");
    localStorage.removeItem("dashboard_skewnessSelectedColumns");
    // Also clear report-related persisted data so the Report page refreshes
    localStorage.removeItem("dashboard_reportBiasSummary");
    localStorage.removeItem("dashboard_reportCorrectionSummary");
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
        {/* Hero Section */}
        <div className="text-center mb-12 animate-fadeInUp">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4">
            Transform Your Data with
            <span className="text-gradient-blue"> Confidence</span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Detect and correct bias in your datasets using advanced machine
            learning techniques. Upload your data and let us handle the rest.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 animate-fadeInUp stagger-2">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-blue-100 card-hover-lift">
            <div className="text-4xl mb-3">🎯</div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              Detect Bias
            </h3>
            <p className="text-sm text-slate-600">
              Automatically identify class imbalance and skewness in your
              datasets
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-purple-100 card-hover-lift stagger-1">
            <div className="text-4xl mb-3">⚡</div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              Fix Issues
            </h3>
            <p className="text-sm text-slate-600">
              Apply SMOTE, reweighting, and other techniques to balance your
              data
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-pink-100 card-hover-lift stagger-2">
            <div className="text-4xl mb-3">📊</div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              Visualize Results
            </h3>
            <p className="text-sm text-slate-600">
              Generate comprehensive reports with beautiful charts and insights
            </p>
          </div>
        </div>

        {/* Upload Section */}
        <div className="grid grid-cols-1 gap-6">
          <section className="rounded-3xl border-2 border-white/50 glass-effect p-8 shadow-2xl animate-fadeInUp stagger-3">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">📁</span>
                  <h2 className="text-2xl font-bold text-slate-800">
                    Upload Your Dataset
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

        {/* Footer Info */}
        <div className="mt-12 text-center animate-fadeInUp stagger-4">
          <p className="text-sm text-slate-500">
            🔒 Your data is processed securely and never shared with third
            parties
          </p>
        </div>
      </main>
    </div>
  );
}
