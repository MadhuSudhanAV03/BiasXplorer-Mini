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
    localStorage.removeItem("dashboard_skewnessResults");
    localStorage.removeItem("dashboard_targetColumn");
    localStorage.removeItem("dashboard_fixMode");
    localStorage.removeItem("dashboard_previousColumns");
    localStorage.removeItem("dashboard_filePath");
    alert("Application data has been cleared!");
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100">
      <header className="border-b border-slate-200 bg-white/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-blue-600 tracking-tight">
                BiasXplorer
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Upload your dataset to get started
              </p>
            </div>
            <nav className="flex items-center gap-4">
              <Link
                to="/dashboard"
                className="text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                to="/report"
                className="text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors"
              >
                Reports
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 gap-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-1">
                  Upload Dataset
                </h2>
                <p className="text-sm text-slate-600">
                  Accepted formats: CSV, XLS, XLSX. We'll validate and store it
                </p>
              </div>
              <button
                onClick={() => {
                  // Clear all dashboard related localStorage items
                  localStorage.removeItem("dashboard_currentStep");
                  localStorage.removeItem("dashboard_columns");
                  localStorage.removeItem("dashboard_selectedColumns");
                  localStorage.removeItem("dashboard_categorical");
                  localStorage.removeItem("dashboard_continuous");
                  localStorage.removeItem("dashboard_selectedFilePath");
                  localStorage.removeItem("dashboard_biasSummary");
                  localStorage.removeItem("dashboard_skewnessResults");
                  localStorage.removeItem("dashboard_targetColumn");
                  localStorage.removeItem("dashboard_fixMode");
                  localStorage.removeItem("dashboard_previousColumns");
                  localStorage.removeItem("dashboard_filePath");
                  alert("Application data has been cleared!");
                }}
                className="px-4 py-2 text-sm bg-red-50 text-red-600 hover:bg-red-100 rounded-md border border-red-200 transition-colors"
              >
                Clear Saved Data
              </button>
            </div>
            <FileUpload onUploadSuccess={handleUploadSuccess} />
          </section>
        </div>
      </main>
    </div>
  );
}
