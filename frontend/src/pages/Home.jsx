import { useNavigate, Link } from "react-router-dom";
import FileUpload from "../components/FileUpload";

export default function Home() {
  const navigate = useNavigate();

  const handleUploadSuccess = (filePath) => {
    // Navigate to dashboard with filePath in route state
    navigate("/dashboard", { state: { filePath } });
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
            <h2 className="text-lg font-semibold text-slate-800 mb-3">
              Upload Dataset
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              Accepted formats: CSV, XLS, XLSX. We’ll validate and store it
              securely for analysis.
            </p>
            <FileUpload onUploadSuccess={handleUploadSuccess} />
          </section>
        </div>
      </main>
    </div>
  );
}
