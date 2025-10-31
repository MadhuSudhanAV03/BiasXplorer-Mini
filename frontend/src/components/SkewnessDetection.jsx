import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import Spinner from "./Spinner";

const PREVIEW_URL = "http://localhost:5000/preview";
const DETECT_SKEW_URL = "http://localhost:5000/detect_skew";

export default function SkewnessDetection({ uploadedFilename }) {
  const location = useLocation();
  const initialFilename = location.state?.filePath || uploadedFilename || "";
  const [filename, setFilename] = useState(initialFilename);
  const [columns, setColumns] = useState([]);
  const [selectedColumn, setSelectedColumn] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  // Fetch columns when filename changes
  useEffect(() => {
    if (!filename) {
      setColumns([]);
      setSelectedColumn("");
      return;
    }

    const fetchColumns = async () => {
      setLoadingColumns(true);
      setError("");
      setColumns([]);
      setSelectedColumn("");
      try {
        // Call preview endpoint with POST request
        // filename can be either "uploads/dataset.csv" or just "dataset.csv"
        const filePath = filename.startsWith("uploads/")
          ? filename
          : `uploads/${filename}`;

        const res = await axios.post(
          PREVIEW_URL,
          { file_path: filePath },
          { headers: { "Content-Type": "application/json" } }
        );

        if (res.data && res.data.columns) {
          setColumns(res.data.columns);
        } else if (
          res.data &&
          res.data.preview &&
          res.data.preview.length > 0
        ) {
          // Fallback: derive columns from first row if columns array not present
          const firstRow = res.data.preview[0];
          setColumns(Object.keys(firstRow));
        }
      } catch (err) {
        const msg =
          err?.response?.data?.error ||
          err.message ||
          "Failed to fetch columns";
        setError(msg);
      } finally {
        setLoadingColumns(false);
      }
    };

    fetchColumns();
  }, [filename]);

  const handleDetectSkewness = async () => {
    setError("");
    setResult(null);

    if (!filename) {
      setError("Please enter a filename");
      return;
    }

    if (!selectedColumn) {
      setError("Please select a column");
      return;
    }

    try {
      setLoading(true);

      // Extract just the filename from path (e.g., "uploads/dataset.csv" -> "dataset.csv")
      const filenameOnly = filename.includes("/")
        ? filename.split("/").pop()
        : filename;

      const res = await axios.post(
        DETECT_SKEW_URL,
        { filename: filenameOnly, column: selectedColumn },
        { headers: { "Content-Type": "application/json" } }
      );
      setResult(res.data);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err.message ||
        "Failed to detect skewness";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const getSkewnessInterpretation = (skewness) => {
    if (skewness === null || skewness === undefined) {
      return { label: "N/A", color: "text-gray-500" };
    }
    if (skewness > 0.5) {
      return { label: "Right-skewed (positive)", color: "text-orange-600" };
    }
    if (skewness < -0.5) {
      return { label: "Left-skewed (negative)", color: "text-blue-600" };
    }
    return { label: "Approximately symmetric", color: "text-green-600" };
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100">
      {/* Header with Navigation */}
      <header className="border-b border-slate-200 bg-white/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-blue-600 tracking-tight">
                Skewness Detection
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Analyze the statistical skewness of numeric columns
              </p>
            </div>
            <nav className="flex items-center gap-4">
              <Link
                to="/"
                className="text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors"
              >
                Home
              </Link>
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

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Analyze Column Skewness
          </h2>
          <p className="text-gray-600 mb-6 text-sm">
            Select a dataset and column to compute its statistical skewness.
          </p>

          {/* Filename Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filename
            </label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="e.g., dataset.csv"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Column Dropdown */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Column to Analyze
            </label>
            {loadingColumns ? (
              <div className="flex items-center justify-center py-4">
                <Spinner />
                <span className="ml-2 text-gray-600">Loading columns...</span>
              </div>
            ) : (
              <select
                value={selectedColumn}
                onChange={(e) => setSelectedColumn(e.target.value)}
                disabled={columns.length === 0}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">-- Select a column --</option>
                {columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Detect Button */}
          <button
            onClick={handleDetectSkewness}
            disabled={loading || !filename || !selectedColumn}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {loading ? (
              <>
                <Spinner />
                <span className="ml-2">Detecting...</span>
              </>
            ) : (
              "Detect Skewness"
            )}
          </button>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="mt-6 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Results
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">Column:</span>
                  <span className="text-gray-900 font-semibold">
                    {result.column}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">
                    Non-null values:
                  </span>
                  <span className="text-gray-900 font-semibold">
                    {result.n_nonnull}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">Skewness:</span>
                  <span className="text-gray-900 font-bold text-lg">
                    {result.skewness !== null
                      ? result.skewness.toFixed(4)
                      : "N/A"}
                  </span>
                </div>

                <div className="pt-3 border-t border-blue-200">
                  <span className="text-gray-700 font-medium">
                    Interpretation:
                  </span>
                  <p
                    className={`mt-1 text-lg font-semibold ${
                      getSkewnessInterpretation(result.skewness).color
                    }`}
                  >
                    {getSkewnessInterpretation(result.skewness).label}
                  </p>
                </div>
              </div>

              <div className="mt-4 text-xs text-gray-500 bg-white p-3 rounded">
                <p>
                  <strong>Note:</strong> Skewness measures the asymmetry of the
                  distribution.
                </p>
                <ul className="mt-1 ml-4 list-disc">
                  <li>Positive skew (&gt; 0.5): Tail extends to the right</li>
                  <li>Negative skew (&lt; -0.5): Tail extends to the left</li>
                  <li>
                    Symmetric (-0.5 to 0.5): Relatively balanced distribution
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
