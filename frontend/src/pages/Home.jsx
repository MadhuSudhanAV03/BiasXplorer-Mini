import { useNavigate, Link } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate("/upload");
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
                to="/upload"
                className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 card-hover-lift"
              >
                📤 Upload
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

        {/* CTA Section */}
        <div className="text-center animate-fadeInUp stagger-3">
          <div className="rounded-3xl border-2 border-white/50 glass-effect p-12 shadow-2xl">
            <div className="max-w-2xl mx-auto">
              <h3 className="text-3xl font-bold text-slate-800 mb-4">
                Ready to Get Started?
              </h3>
              <p className="text-slate-600 mb-8">
                Upload your dataset and begin analyzing bias with our powerful
                tools. It only takes a few clicks to get comprehensive insights.
              </p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <button
                  onClick={handleGetStarted}
                  className="px-8 py-4 text-lg font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 card-hover-lift flex items-center gap-3"
                >
                  <span className="text-2xl">🚀</span>
                  <span>Get Started Now</span>
                </button>
                <button
                  onClick={clearAllData}
                  className="px-6 py-4 text-base font-semibold bg-gradient-to-r from-red-500 to-pink-500 text-white hover:from-red-600 hover:to-pink-600 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 card-hover-lift flex items-center gap-2"
                >
                  <span>🗑️</span>
                  <span>Clear All Data</span>
                </button>
              </div>
            </div>
          </div>
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
