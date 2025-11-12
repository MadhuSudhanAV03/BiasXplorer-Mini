# Frontend to Backend API Request Mapping
## Complete Guide: Where Frontend Sends Requests to Backend

---

## 📋 Summary Table

| # | Component/Page | API Endpoint | Method | Purpose |
|---|----------------|--------------|--------|---------|
| 1 | FileUpload.jsx | `/api/upload` | POST | Upload CSV/Excel files |
| 2 | DatasetPreview.jsx | `/api/preview` | POST | Preview dataset columns and rows |
| 3 | Preprocess.jsx | `/api/preprocess` | POST | Clean dataset (handle missing values) |
| 4 | ColumnSelector.jsx | `/api/column-types` | POST | Save column types (categorical/continuous) |
| 5 | FeatureSelector.jsx | `/api/features` | POST | Select features for analysis |
| 6 | BiasDetection.jsx | `/api/bias/detect` | POST | Detect bias in categorical columns |
| 7 | BiasDetection.jsx | `/api/skewness/detect` | POST | Detect skewness in continuous columns |
| 8 | BiasFixSandbox.jsx | `/api/bias/fix` | POST | Fix categorical bias (SMOTE, oversample, etc.) |
| 9 | SkewnessDetection.jsx | `/api/preview` | POST | Fetch columns for skewness analysis |
| 10 | SkewnessDetection.jsx | `/api/skewness/detect` | POST | Detect skewness in selected column |
| 11 | SkewnessFixSandbox.jsx | `/api/skewness/fix` | POST | Fix skewness (log, sqrt, Box-Cox, etc.) |
| 12 | Visualization.jsx | `/api/bias/visualize` | POST | Generate categorical bias charts |
| 13 | Visualization.jsx | `/api/skewness/visualize` | POST | Generate continuous skewness charts |
| 14 | ReportGenerator.jsx | `/api/reports/generate` | POST | Generate PDF report |
| 15 | ReportGenerator.jsx | `/<report_path>` | GET | Download generated PDF report |
| 16 | ReportPage.jsx | `/api/bias/visualize` | POST | Fetch categorical visualizations |
| 17 | ReportPage.jsx | `/api/skewness/visualize` | POST | Fetch continuous visualizations |
| 18 | ReportPage.jsx | `/api/corrected/download/<filename>` | GET | Download corrected CSV dataset |

---

## 📂 Detailed Breakdown by Component

### 1. **FileUpload.jsx** (Step 1: Upload)

**Location:** `frontend/src/components/FileUpload.jsx`

```javascript
// Line 6
const UPLOAD_URL = "http://localhost:5000/api/upload";

// Line 39-42
const res = await axios.post(UPLOAD_URL, formData, {
  headers: { "Content-Type": "multipart/form-data" },
  withCredentials: false,
});
```

**Purpose:** Upload CSV/Excel files to backend  
**Request Body:** FormData with `file` field  
**Response:** `{ file_path: "uploads/filename.csv" }`  
**Backend Handler:** `backend/resources/upload_routes.py`

---

### 2. **DatasetPreview.jsx** (Step 2: Preview)

**Location:** `frontend/src/components/DatasetPreview.jsx`

```javascript
// Line 5
const PREVIEW_URL = "http://localhost:5000/api/preview";

// Line 22-26
const res = await axios.post(
  PREVIEW_URL,
  { file_path: filePath },
  { headers: { "Content-Type": "application/json" } }
);
```

**Purpose:** Get column names and preview rows from uploaded dataset  
**Request Body:** `{ file_path: "uploads/filename.csv" }`  
**Response:** `{ columns: [...], preview: [...] }`  
**Backend Handler:** `backend/resources/select_routes.py`

---

### 3. **Preprocess.jsx** (Step 3: Preprocess)

**Location:** `frontend/src/components/Preprocess.jsx`
 
```javascript
// Line 5
const PREPROCESS_URL = "http://localhost:5000/api/preprocess";

// Line 35-38
const res = await axios.post(
  PREPROCESS_URL,
  { file_path: filePath },
  { headers: { "Content-Type": "application/json" } }
);
```

**Purpose:** Clean dataset by handling missing values  
**Request Body:** `{ file_path: "uploads/filename.csv" }`  
**Response:** `{ cleaned_file_path: "uploads/cleaned_filename.csv", missing_values: {...}, dataset_shape: [...] }`  
**Backend Handler:** `backend/resources/preprocess_routes.py`

---

### 4. **ColumnSelector.jsx** (Step 4: Classify Columns)

**Location:** `frontend/src/components/ColumnSelector.jsx`

```javascript
// Line 5
const SET_TYPES_URL = "http://localhost:5000/api/column-types";

// Line 73-75
const res = await axios.post(SET_TYPES_URL, payload, {
  headers: { "Content-Type": "application/json" },
});
```

**Purpose:** Save column classifications (categorical vs continuous)  
**Request Body:** 
```json
{
  "file_path": "uploads/cleaned_filename.csv",
  "categorical": ["gender", "country"],
  "continuous": ["age", "income"]
}
```
**Response:** `{ message: "Column types saved" }`  
**Backend Handler:** `backend/resources/select_routes.py`

---

### 5. **FeatureSelector.jsx** (Step 5: Select Features)

**Location:** `frontend/src/components/FeatureSelector.jsx`

```javascript
// Line 5
const SELECT_URL = "http://localhost:5000/api/features";

// Line 58-60
const res = await axios.post(SELECT_URL, payload, {
  headers: { "Content-Type": "application/json" },
});
```

**Purpose:** Select which features/columns to analyze  
**Request Body:** 
```json
{
  "file_path": "uploads/cleaned_filename.csv",
  "selected_features": ["gender", "age", "income"]
}
```
**Response:** `{ message: "Features selected", selected_file_path: "uploads/selected_cleaned_filename.csv" }`  
**Backend Handler:** `backend/resources/select_routes.py`

---

### 6. **BiasDetection.jsx** (Step 6: Detect - Categorical)

**Location:** `frontend/src/components/BiasDetection.jsx`

```javascript
// Line 5
const DETECT_BIAS_URL = "http://localhost:5000/api/bias/detect";

// Line 164-167
const res = await axios.post(
  DETECT_BIAS_URL,
  { file_path: filePath, categorical: [column] },
  { headers: { "Content-Type": "application/json" } }
);
```

**Purpose:** Detect bias in categorical columns  
**Request Body:** 
```json
{
  "file_path": "uploads/selected_cleaned_filename.csv",
  "categorical": ["gender"]
}
```
**Response:** 
```json
{
  "gender": {
    "Male": 0.75,
    "Female": 0.25,
    "severity": "Severe",
    "note": "High imbalance detected"
  }
}
```
**Backend Handler:** `backend/resources/bias_routes.py`

---

### 7. **BiasDetection.jsx** (Step 6: Detect - Continuous)

**Location:** `frontend/src/components/BiasDetection.jsx`

```javascript
// Line 6
const DETECT_SKEW_URL = "http://localhost:5000/api/skewness/detect";

// Line 183-186
const res = await axios.post(
  DETECT_SKEW_URL,
  { filename: filenameOnly, column },
  { headers: { "Content-Type": "application/json" } }
);
```

**Purpose:** Detect skewness in continuous columns  
**Request Body:** 
```json
{
  "filename": "selected_cleaned_filename.csv",
  "column": "age"
}
```
**Response:** 
```json
{
  "skewness": 1.45,
  "interpretation": "Right-skewed (positive)",
  "recommended_method": "Log Transformation"
}
```
**Backend Handler:** `backend/resources/bias_routes.py` (skewness detection)

---

### 8. **BiasFixSandbox.jsx** (Step 7: Fix - Categorical)

**Location:** `frontend/src/components/BiasFixSandbox.jsx`

```javascript
// Line 6
const FIX_URL = "http://localhost:5000/api/bias/fix";

// Line 229-231
const res = await axios.post(FIX_URL, payload, {
  headers: { "Content-Type": "application/json" },
});
```

**Purpose:** Fix categorical bias using SMOTE/oversample/undersample  
**Request Body:** 
```json
{
  "file_path": "uploads/selected_cleaned_filename.csv",
  "target_column": "gender",
  "method": "smote",
  "threshold": 0.5,
  "categorical_columns": ["country", "education"]
}
```
**Response:** 
```json
{
  "corrected_file_path": "corrected/corrected_filename_gender_123456.csv",
  "before": { "Male": 750, "Female": 250 },
  "after": { "Male": 750, "Female": 750 },
  "method": "smote"
}
```
**Backend Handler:** `backend/resources/bias_routes.py`

---

### 9. **SkewnessDetection.jsx** (Standalone - Preview Columns)

**Location:** `frontend/src/components/SkewnessDetection.jsx`

```javascript
// Line 6
const PREVIEW_URL = "http://localhost:5000/api/preview";

// Line 40-43
const res = await axios.post(
  PREVIEW_URL,
  { file_path: filePath },
  { headers: { "Content-Type": "application/json" } }
);
```

**Purpose:** Fetch columns for skewness analysis (same as DatasetPreview)  
**Request Body:** `{ file_path: "uploads/filename.csv" }`  
**Response:** `{ columns: [...], preview: [...] }`  
**Backend Handler:** `backend/resources/select_routes.py`

---

### 10. **SkewnessDetection.jsx** (Standalone - Detect Skewness)

**Location:** `frontend/src/components/SkewnessDetection.jsx`

```javascript
// Line 7
const DETECT_SKEW_URL = "http://localhost:5000/api/skewness/detect";

// Line 93-96
const res = await axios.post(
  DETECT_SKEW_URL,
  { filename: filenameOnly, column: selectedColumn },
  { headers: { "Content-Type": "application/json" } }
);
```

**Purpose:** Detect skewness in a specific column  
**Request Body:** `{ filename: "filename.csv", column: "age" }`  
**Response:** `{ skewness: 1.45, interpretation: "...", recommended_method: "..." }`  
**Backend Handler:** `backend/resources/bias_routes.py`

---

### 11. **SkewnessFixSandbox.jsx** (Step 7: Fix - Continuous)

**Location:** `frontend/src/components/SkewnessFixSandbox.jsx`

```javascript
// Line 5
const FIX_SKEW_URL = "http://localhost:5000/api/skewness/fix";

// Line 118-120
const res = await axios.post(FIX_SKEW_URL, payload, {
  headers: { "Content-Type": "application/json" },
});
```

**Purpose:** Fix skewness using transformations (log, sqrt, Box-Cox, etc.)  
**Request Body:** 
```json
{
  "filename": "selected_cleaned_filename.csv",
  "columns": ["age", "income"]
}
```
**Response:** 
```json
{
  "corrected_file_path": "corrected/corrected_filename_skew_123456.csv",
  "transformations_applied": {
    "age": "log",
    "income": "box-cox"
  },
  "before_skewness": { "age": 1.45, "income": 2.31 },
  "after_skewness": { "age": 0.12, "income": 0.08 }
}
```
**Backend Handler:** `backend/resources/bias_routes.py`

---

### 12. **Visualization.jsx** (Charts - Categorical)

**Location:** `frontend/src/components/Visualization.jsx`

```javascript
// Line 7
const VIS_BIAS_URL = "http://localhost:5000/api/bias/visualize";

// Line 70-76
const res = await axios.post(
  VIS_BIAS_URL,
  {
    before_path: beforePath,
    after_path: afterPath,
    target_column: col,
  },
  { headers: { "Content-Type": "application/json" } }
);
```

**Purpose:** Generate Plotly charts for categorical bias (before/after)  
**Request Body:** 
```json
{
  "before_path": "uploads/selected_cleaned_filename.csv",
  "after_path": "corrected/corrected_filename_gender_123456.csv",
  "target_column": "gender"
}
```
**Response:** 
```json
{
  "before_chart": "{...plotly JSON...}",
  "after_chart": "{...plotly JSON...}"
}
```
**Backend Handler:** `backend/resources/bias_routes.py`

---

### 13. **Visualization.jsx** (Charts - Continuous)

**Location:** `frontend/src/components/Visualization.jsx`

```javascript
// Line 8
const VIS_SKEW_URL = "http://localhost:5000/api/skewness/visualize";

// Line 168-174
const res = await axios.post(
  VIS_SKEW_URL,
  {
    before_path: beforePath,
    after_path: afterPath,
    columns: continuous,
  },
  { headers: { "Content-Type": "application/json" } }
);
```

**Purpose:** Generate Plotly charts for continuous skewness (before/after)  
**Request Body:** 
```json
{
  "before_path": "uploads/selected_cleaned_filename.csv",
  "after_path": "corrected/corrected_filename_skew_123456.csv",
  "columns": ["age", "income"]
}
```
**Response:** 
```json
{
  "charts": {
    "age": {
      "before_chart": "{...plotly JSON...}",
      "after_chart": "{...plotly JSON...}",
      "before_skewness": 1.45,
      "after_skewness": 0.12
    }
  }
}
```
**Backend Handler:** `backend/resources/bias_routes.py`

---

### 14. **ReportGenerator.jsx** (Generate PDF Report)

**Location:** `frontend/src/components/ReportGenerator.jsx`

```javascript
// Line 9
const REPORT_URL = "http://localhost:5000/api/reports/generate";

// Line 58-60
const res = await axios.post(REPORT_URL, payload, {
  headers: { "Content-Type": "application/json" },
});
```

**Purpose:** Generate PDF report with bias summary and visualizations  
**Request Body:** 
```json
{
  "bias_summary": { "gender": { "Male": 0.75, "Female": 0.25, "severity": "Severe" } },
  "correction_summary": { "before": {...}, "after": {...}, "method": "smote" },
  "visualizations": { "before_chart": "...", "after_chart": "..." }
}
```
**Response:** `{ report_path: "reports/report_123456.pdf" }`  
**Backend Handler:** `backend/resources/report_routes.py`

---

### 15. **ReportGenerator.jsx** (Download PDF Report)

**Location:** `frontend/src/components/ReportGenerator.jsx`

```javascript
// Line 82
const url = `http://localhost:5000/${relative}`;
const fileRes = await axios.get(url, { responseType: "blob" });
```

**Purpose:** Download generated PDF report  
**Request:** `GET http://localhost:5000/reports/report_123456.pdf`  
**Response:** Binary PDF blob  
**Backend Handler:** Flask static file serving

---

### 16. **ReportPage.jsx** (Fetch Categorical Visualizations)

**Location:** `frontend/src/pages/ReportPage.jsx`

```javascript
// Line 475 (inside useEffect)
const res = await axios.post(
  "http://localhost:5000/api/bias/visualize",
  { before_path: beforePath, after_path: afterPath, target_column: col },
  { headers: { "Content-Type": "application/json" } }
);
```

**Purpose:** Fetch categorical bias charts for report page display  
**Request Body:** Same as Visualization.jsx categorical  
**Response:** `{ before_chart: "...", after_chart: "..." }`  
**Backend Handler:** `backend/resources/bias_routes.py`

---

### 17. **ReportPage.jsx** (Fetch Continuous Visualizations)

**Location:** `frontend/src/pages/ReportPage.jsx`

```javascript
// Line 475 (inside useEffect)
const res = await axios.post(
  "http://localhost:5000/api/skewness/visualize",
  { before_path: beforePath, after_path: afterPath, columns: contCols },
  { headers: { "Content-Type": "application/json" } }
);
```

**Purpose:** Fetch continuous skewness charts for report page display  
**Request Body:** Same as Visualization.jsx continuous  
**Response:** `{ charts: { "age": {...}, "income": {...} } }`  
**Backend Handler:** `backend/resources/bias_routes.py`

---

### 18. **ReportPage.jsx** (Download Corrected Dataset)

**Location:** `frontend/src/pages/ReportPage.jsx`

```javascript
// Line 630
const url = `http://localhost:5000/api/corrected/download/${encodeURIComponent(filename)}`;
const res = await axios.get(url, { responseType: "blob" });
```

**Purpose:** Download corrected CSV dataset  
**Request:** `GET http://localhost:5000/api/corrected/download/corrected_filename_gender_123456.csv`  
**Response:** Binary CSV blob  
**Backend Handler:** `backend/resources/bias_routes.py` (download endpoint)

---

## 🔄 Complete User Journey API Flow

### 7-Step Workflow API Sequence:

```
1. UPLOAD (FileUpload.jsx)
   ↓ POST /api/upload
   → Returns: file_path

2. PREVIEW (DatasetPreview.jsx)
   ↓ POST /api/preview
   → Returns: columns, preview rows

3. PREPROCESS (Preprocess.jsx)
   ↓ POST /api/preprocess
   → Returns: cleaned_file_path

4. SELECT COLUMNS (ColumnSelector.jsx)
   ↓ POST /api/column-types
   → Returns: confirmation

5. SELECT FEATURES (FeatureSelector.jsx)
   ↓ POST /api/features
   → Returns: selected_file_path

6. DETECT BIAS (BiasDetection.jsx)
   ↓ POST /api/bias/detect (categorical)
   ↓ POST /api/skewness/detect (continuous)
   → Returns: bias/skewness results

7. FIX BIAS (BiasFixSandbox.jsx / SkewnessFixSandbox.jsx)
   ↓ POST /api/bias/fix (categorical)
   ↓ POST /api/skewness/fix (continuous)
   → Returns: corrected_file_path, before/after stats

8. VISUALIZE (Visualization.jsx / ReportPage.jsx)
   ↓ POST /api/bias/visualize
   ↓ POST /api/skewness/visualize
   → Returns: Plotly chart JSONs

9. DOWNLOAD (ReportPage.jsx)
   ↓ GET /api/corrected/download/<filename>
   → Returns: CSV blob
```

---

## 📊 API Endpoint Summary

### Upload & Preview
- `POST /api/upload` - Upload dataset file
- `POST /api/preview` - Get columns and preview rows

### Preprocessing & Selection
- `POST /api/preprocess` - Clean dataset (missing values)
- `POST /api/column-types` - Save column classifications
- `POST /api/features` - Select features for analysis

### Bias Detection
- `POST /api/bias/detect` - Detect categorical bias
- `POST /api/skewness/detect` - Detect continuous skewness

### Bias Correction
- `POST /api/bias/fix` - Fix categorical bias
- `POST /api/skewness/fix` - Fix continuous skewness

### Visualization
- `POST /api/bias/visualize` - Generate categorical charts
- `POST /api/skewness/visualize` - Generate continuous charts

### Reports & Downloads
- `POST /api/reports/generate` - Generate PDF report
- `GET /reports/<filename>.pdf` - Download PDF report
- `GET /api/corrected/download/<filename>` - Download corrected CSV

---

## 🛠️ Backend Route Handlers

| Route File | Endpoints Handled |
|------------|-------------------|
| `upload_routes.py` | `/api/upload` |
| `select_routes.py` | `/api/preview`, `/api/column-types`, `/api/features` |
| `preprocess_routes.py` | `/api/preprocess` |
| `bias_routes.py` | `/api/bias/detect`, `/api/bias/fix`, `/api/bias/visualize`, `/api/skewness/detect`, `/api/skewness/fix`, `/api/skewness/visualize`, `/api/corrected/download/<filename>` |
| `report_routes.py` | `/api/reports/generate` |

---

## 📝 Notes

1. **Base URL:** All requests go to `http://localhost:5000`
2. **Content-Type:** Most use `application/json` except file upload (`multipart/form-data`)
3. **Response Type:** Most return JSON, except downloads return `blob`
4. **File Paths:** 
   - Uploaded files: `uploads/<filename>`
   - Cleaned files: `uploads/cleaned_<filename>`
   - Selected files: `uploads/selected_cleaned_<filename>`
   - Corrected files: `corrected/corrected_<filename>_<column>_<timestamp>`
5. **Error Handling:** All components check `err?.response?.data?.error` for backend error messages

---

**Document Generated:** November 10, 2025  
**Project:** BiasXplorer-Mini  
**Total API Endpoints:** 18 unique request patterns across 10 frontend components
