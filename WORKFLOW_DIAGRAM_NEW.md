# BiasXplorer-Mini - Complete Workflow Diagram (NEW)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BIASXPLORER-MINI WORKFLOW                            │
│                        (Updated: January 4, 2026)                            │
└─────────────────────────────────────────────────────────────────────────────┘

╔═══════════════════════════════════════════════════════════════════════════╗
║ STEP 0: HOMEPAGE & NAVIGATION                                             ║
╠═══════════════════════════════════════════════════════════════════════════╣
║ Route:      / (localhost:5173)                                            ║
║ Component:  Home.jsx                                                       ║
║                                                                            ║
║ FEATURES:                                                                  ║
║   • Welcome page with project overview                                    ║
║   • Feature highlights (Detect Bias, Fix Issues, Visualize Results)      ║
║   • Navigation to Upload, Dashboard, and Reports                          ║
║   • "Get Started Now" button → navigates to /upload                       ║
║   • "Clear All Data" button to reset application state                    ║
║                                                                            ║
║ NAVIGATION OPTIONS:                                                        ║
║   ✅ Upload → /upload (Primary action)                                    ║
║   ✅ Dashboard → /dashboard                                               ║
║   ✅ Reports → /report                                                    ║
╚═══════════════════════════════════════════════════════════════════════════╝
                                    ↓
╔═══════════════════════════════════════════════════════════════════════════╗
║ STEP 1: DATASET UPLOAD                                                    ║
╠═══════════════════════════════════════════════════════════════════════════╣
║ Route:      /upload                                                        ║
║ Component:  Upload.jsx                                                     ║
║ API:        POST /api/upload                                              ║
║                                                                            ║
║ INPUT:                                                                     ║
║   • User uploads: dataset.csv via drag & drop or file picker             ║
║                                                                            ║
║ PROCESSING:                                                                ║
║   • Validate file type (CSV/Excel)                                        ║
║   • Create two copies:                                                    ║
║     - original_<filename>.csv (read-only reference)                       ║
║     - working_<filename>.csv (for all operations)                         ║
║                                                                            ║
║ SERVER STORAGE:                                                            ║
║   📁 backend/uploads/original_<filename>.csv                              ║
║   📁 backend/uploads/working_<filename>.csv                               ║
║                                                                            ║
║ BROWSER STORAGE (localStorage):                                           ║
║   • dashboard_originalFilePath: "uploads/original_<filename>.csv"         ║
║   • dashboard_workingFilePath: "uploads/working_<filename>.csv"           ║
║   • dashboard_filePath: "uploads/working_<filename>.csv" (legacy)         ║
║                                                                            ║
║ OUTPUT → NEXT STEP:                                                        ║
║   ✅ Navigate to /dashboard with upload result                            ║
║   ✅ Files ready for preview and analysis                                 ║
╚═══════════════════════════════════════════════════════════════════════════╝
                                    ↓
╔═══════════════════════════════════════════════════════════════════════════╗
║ STEP 2: DATASET PREVIEW                                                   ║
╠═══════════════════════════════════════════════════════════════════════════╣
╔═══════════════════════════════════════════════════════════════════════════╗
║ STEP 2: DATASET PREVIEW                                                   ║
╠═══════════════════════════════════════════════════════════════════════════╣
║ Component:  DatasetPreview.jsx                                            ║
║ API:        POST /api/preview                                             ║
║                                                                            ║
║ INPUT:                                                                     ║
║   • File: "uploads/working_<filename>.csv"                                ║
║                                                                            ║
║ PROCESSING:                                                                ║
║   • Read first 10 rows                                                    ║
║   • Extract column names                                                  ║
║   • Count missing values per column                                       ║
║                                                                            ║
║ BROWSER STORAGE (localStorage):                                           ║
║   • dashboard_columns: ["col1", "col2", "col3", ...]                      ║
║                                                                            ║
║ OUTPUT → NEXT STEP:                                                        ║
║   ✅ Column names: ["col1", "col2", "col3", ...]                          ║
║   ✅ Preview table with sample data                                       ║
╚═══════════════════════════════════════════════════════════════════════════╝
                                    ↓
╔═══════════════════════════════════════════════════════════════════════════╗
║ STEP 3: TARGET COLUMN SELECTION ⭐                                        ║
╠═══════════════════════════════════════════════════════════════════════════╣
║ Component:  FeatureSelector.jsx                                           ║
║ API:        POST /api/features                                            ║
║                                                                            ║
║ INPUT:                                                                     ║
║   • File: "uploads/dataset.csv" (original uploaded file)                 ║
║   • All columns: ["col1", "col2", "col3", ...]                            ║
║                                                                            ║
║ USER ACTION:                                                               ║
║   • User selects columns to analyze (checkboxes)                          ║
║   • Example: ["age", "gender", "income"]                                  ║
║                                                                            ║
║ API REQUEST:                                                               ║
║   POST /api/features                                                       ║
║   {                                                                        ║
║     "file_path": "uploads/dataset.csv",                                   ║
║     "selected_features": ["age", "gender", "income"]                      ║
║   }                                                                        ║
║                                                                            ║
║ BACKEND PROCESSING:                                                        ║
║   1. Read uploads/dataset.csv                                             ║
║   2. Filter DataFrame: df[["age", "gender", "income"]]                    ║
║   3. Save filtered dataset                                                ║
║                                                                            ║
║ SERVER STORAGE:                                                            ║
║   📁 backend/uploads/selected_dataset.csv                                 ║
║   (Contains ONLY selected columns: age, gender, income)                   ║
║                                                                            ║
║ BROWSER STORAGE (localStorage):                                           ║
║   • dashboard_selectedColumns: ["age", "gender", "income"]                ║
║   • dashboard_selectedFilePath: "uploads/selected_dataset.csv"            ║
║                                                                            ║
║ OUTPUT → NEXT STEP:                                                        ║
║   ✅ File path: "uploads/selected_dataset.csv"                            ║
║   ✅ Selected columns: ["age", "gender", "income"]                        ║
╚═══════════════════════════════════════════════════════════════════════════╝
                                    ↓
╔═══════════════════════════════════════════════════════════════════════════╗
║ STEP 3: COLUMN TYPE CLASSIFICATION ⭐ (MOVED UP)                          ║
╠═══════════════════════════════════════════════════════════════════════════╣
║ Component:  ColumnSelector.jsx                                            ║
║ API:        POST /api/column-types                                        ║
║                                                                            ║
║ INPUT:                                                                     ║
║   • File: "uploads/selected_dataset.csv"                                  ║
║   • Selected columns: ["age", "gender", "income"]                         ║
║                                                                            ║
║ USER ACTION:                                                               ║
║   • Classify each column as Categorical or Continuous                     ║
║   • Example:                                                               ║
║     - Categorical: ["gender"]                                             ║
║     - Continuous: ["age", "income"]                                       ║
║                                                                            ║
║ API REQUEST:                                                               ║
║   POST /api/column-types                                                  ║
║   {                                                                        ║
║     "file_path": "uploads/selected_dataset.csv",                          ║
║     "categorical": ["gender"],                                            ║
║     "continuous": ["age", "income"]                                       ║
║   }                                                                        ║
║                                                                            ║
║ BACKEND PROCESSING:                                                        ║
║   1. Validate columns exist in selected_dataset.csv                       ║
║   2. Store in Flask app.config (in-memory)                                ║
║                                                                            ║
║ SERVER STORAGE:                                                            ║
║   💾 Flask Memory: app.config["COLUMN_TYPES_STORE"]                       ║
║   {                                                                        ║
║     "uploads/selected_dataset.csv": {                                     ║
║       "categorical": ["gender"],                                          ║
║       "continuous": ["age", "income"]                                     ║
║     }                                                                      ║
║   }                                                                        ║
║   ⚠️ Lost on server restart!                                              ║
║                                                                            ║
║ BROWSER STORAGE (localStorage):                                           ║
║   • dashboard_categorical: ["gender"]                                     ║
║   • dashboard_continuous: ["age", "income"]                               ║
║                                                                            ║
║ OUTPUT → NEXT STEP:                                                        ║
║   ✅ File path: "uploads/selected_dataset.csv" (unchanged)                ║
║   ✅ Column types stored                                                  ║
╚═══════════════════════════════════════════════════════════════════════════╝
                                    ↓
╔═══════════════════════════════════════════════════════════════════════════╗
║ STEP 4: DATA PREPROCESSING ⭐ (MOVED DOWN, ENHANCED)                      ║
╠═══════════════════════════════════════════════════════════════════════════╣
║ Component:  Preprocess.jsx                                                ║
║ API:        POST /api/preprocess                                          ║
║                                                                            ║
║ INPUT:                                                                     ║
║   • File: "uploads/selected_dataset.csv"                                  ║
║   • Selected columns: ["age", "gender", "income"]                         ║
║                                                                            ║
║ API REQUEST: ⭐ NEW PARAMETER                                              ║
║   POST /api/preprocess                                                    ║
║   {                                                                        ║
║     "file_path": "uploads/selected_dataset.csv",                          ║
║     "selected_columns": ["age", "gender", "income"]  ✨ NEW!             ║
║   }                                                                        ║
║                                                                            ║
║ BACKEND PROCESSING:                                                        ║
║   1. Read uploads/selected_dataset.csv (all columns)                      ║
║   2. Count missing values IN SELECTED COLUMNS ONLY:                       ║
║      missing = df[["age", "gender", "income"]].isna().sum()              ║
║   3. Drop rows with NaN IN SELECTED COLUMNS ONLY:                         ║
║      df = df.dropna(subset=["age", "gender", "income"])                  ║
║   4. Drop duplicates CONSIDERING SELECTED COLUMNS ONLY:                   ║
║      df = df.drop_duplicates(subset=["age", "gender", "income"])         ║
║   5. Save ENTIRE DataFrame (cleaned based on selected columns)            ║
║                                                                            ║
║ EXAMPLE:                                                                   ║
║   Original: 1000 rows, 10 columns                                         ║
║   Selected: 3 columns (age, gender, income)                               ║
║   NaN in "age": 50 rows → REMOVED                                         ║
║   NaN in "other_column": NOT considered                                   ║
║   Result: 950 rows, 10 columns (but cleaned for age/gender/income)       ║
║                                                                            ║
║ SERVER STORAGE:                                                            ║
║   📁 backend/uploads/cleaned_selected_dataset.csv                         ║
║   (All columns, but rows cleaned based on selected columns)               ║
║                                                                            ║
║ API RESPONSE: ⭐ NEW FIELD                                                 ║
║   {                                                                        ║
║     "message": "Preprocessing complete",                                  ║
║     "selected_columns_cleaned": ["age", "gender", "income"],  ✨ NEW!    ║
║     "missing_values": {"age": 50, "gender": 0, "income": 10},            ║
║     "rows_before": 1000,                                                  ║
║     "rows_with_na_removed": 50,                                           ║
║     "duplicates_removed": 5,                                              ║
║     "rows_after": 945,                                                    ║
║     "dataset_shape": [945, 10],                                           ║
║     "cleaned_file_path": "uploads/cleaned_selected_dataset.csv"           ║
║   }                                                                        ║
║                                                                            ║
║ BROWSER STORAGE (localStorage):                                           ║
║   • dashboard_cleanedFilePath: "uploads/cleaned_selected_dataset.csv"     ║
║                                                                            ║
║ OUTPUT → NEXT STEP:                                                        ║
║   ✅ File path: "uploads/cleaned_selected_dataset.csv"                    ║
║   ✅ Dataset is now clean and ready for analysis                          ║
╚═══════════════════════════════════════════════════════════════════════════╝
                                    ↓
╔═══════════════════════════════════════════════════════════════════════════╗
║ STEP 5: BIAS DETECTION                                                    ║
╠═══════════════════════════════════════════════════════════════════════════╣
║ Component:  BiasDetection.jsx                                             ║
║ API:        POST /api/bias/detect (categorical)                           ║
║             POST /api/skewness/detect (continuous)                        ║
║                                                                            ║
║ INPUT:                                                                     ║
║   • File: "uploads/cleaned_selected_dataset.csv"                          ║
║   • Categorical columns: ["gender"]                                       ║
║   • Continuous columns: ["age", "income"]                                 ║
║                                                                            ║
║ PROCESSING:                                                                ║
║   • Detect class imbalance in categorical columns                         ║
║   • Detect skewness in continuous columns                                 ║
║                                                                            ║
║ BROWSER STORAGE:                                                           ║
║   • dashboard_biasResults: {...}                                          ║
║   • dashboard_skewnessResults: {...}                                      ║
║                                                                            ║
║ OUTPUT → NEXT STEP:                                                        ║
║   ✅ Bias detection results with severity levels                          ║
╚═══════════════════════════════════════════════════════════════════════════╝
                                    ↓
╔═══════════════════════════════════════════════════════════════════════════╗
║ STEP 6: BIAS FIX                                                           ║
╠═══════════════════════════════════════════════════════════════════════════╣
║ Component:  UnifiedBiasFix.jsx                                            ║
║ API:        POST /api/bias/fix (categorical)                              ║
║             POST /api/skewness/fix (continuous)                           ║
║                                                                            ║
║ INPUT:                                                                     ║
║   • File: "uploads/cleaned_selected_dataset.csv"                          ║
║   • Bias results from Step 5                                              ║
║                                                                            ║
║ PROCESSING:                                                                ║
║   • Apply correction methods (SMOTE, reweight, transformations)           ║
║                                                                            ║
║ SERVER STORAGE:                                                            ║
║   📁 backend/corrected/corrected_..._<timestamp>.csv                      ║
║                                                                            ║
║ BROWSER STORAGE:                                                           ║
║   • dashboard_correctedFilePath: "corrected/..."                          ║
║                                                                            ║
║ OUTPUT → NEXT STEP:                                                        ║
║   ✅ Corrected dataset                                                    ║
╚═══════════════════════════════════════════════════════════════════════════╝
                                    ↓
╔═══════════════════════════════════════════════════════════════════════════╗
║ STEP 7: VISUALIZATION                                                      ║
╠═══════════════════════════════════════════════════════════════════════════╣
║ Component:  Visualization.jsx                                             ║
║ API:        POST /api/bias/visualize                                      ║
║             POST /api/skewness/visualize                                  ║
║                                                                            ║
║ INPUT:                                                                     ║
║   • Before: "uploads/cleaned_selected_dataset.csv"                        ║
║   • After: "corrected/corrected_..._<timestamp>.csv"                      ║
║                                                                            ║
║ OUTPUT:                                                                    ║
║   • Before/After charts (Plotly)                                          ║
║   • PDF report generation                                                 ║
╚═══════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────┐
│                           FILE PROGRESSION SUMMARY                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Step 1: uploads/dataset.csv                   (Original upload)            │
│            ↓                                                                 │
│  Step 2: uploads/selected_dataset.csv          (Selected columns only)      │
│            ↓                                                                 │
│  Step 3: uploads/selected_dataset.csv          (No change, types stored)    │
│            ↓                                                                 │
│  Step 4: uploads/cleaned_selected_dataset.csv  (Cleaned selected columns)   │
│            ↓                                                                 │
│  Step 5: uploads/cleaned_selected_dataset.csv  (Detection)                  │
│            ↓                                                                 │
│  Step 6: corrected/corrected_..._<ts>.csv      (Fixed bias)                 │
│            ↓                                                                 │
│  Step 7: Visualizations + PDF Report                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         KEY IMPROVEMENTS (NEW WORKFLOW)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ✅ Column selection happens BEFORE preprocessing                           │
│  ✅ Preprocessing operates ONLY on selected columns                         │
│  ✅ More efficient (doesn't clean unused columns)                           │
│  ✅ Better user control (pick what to analyze first)                        │
│  ✅ Smaller intermediate files (selected columns only)                      │
│  ✅ Type classification informs preprocessing                               │
│  ✅ Logical flow: Select → Classify → Clean → Detect → Fix                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```
