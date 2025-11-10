# BiasXplorer-Mini: Complete Project Explanation

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Project Structure](#project-structure)
3. [Technology Stack](#technology-stack)
4. [Backend Architecture](#backend-architecture)
5. [Frontend Architecture](#frontend-architecture)
6. [Complete Flow](#complete-flow)
7. [File-by-File Breakdown](#file-by-file-breakdown)
8. [Data Flow Diagram](#data-flow-diagram)

---

## 🎯 Project Overview

**BiasXplorer-Mini** is a full-stack web application designed to detect and correct bias in datasets. It handles two types of bias:

1. **Categorical Bias**: Class imbalance in categorical columns (e.g., gender: 90% male, 10% female)
2. **Continuous Skewness**: Distribution skewness in numerical columns (e.g., right-skewed income data)

### Key Features:
- Upload CSV/Excel files
- Automatic data preprocessing (remove NaN, duplicates)
- Column type classification (categorical vs continuous)
- Bias detection with severity levels (Low/Moderate/Severe)
- Multiple correction methods (SMOTE, transformations, etc.)
- Interactive visualizations (before/after charts)
- PDF report generation
- Downloadable corrected datasets

---

## 📁 Project Structure

```
BiasXplorer-Mini/
├── backend/                      # Flask API server
│   ├── app.py                    # Main Flask application entry point
│   ├── requirements.txt          # Python dependencies
│   ├── .flaskenv                 # Flask environment variables
│   │
│   ├── resources/                # API route handlers (Blueprints)
│   │   ├── upload_routes.py      # File upload & preview
│   │   ├── preprocess_routes.py  # Data cleaning
│   │   ├── select_routes.py      # Column selection
│   │   ├── bias_routes.py        # Bias detection & correction
│   │   └── report_routes.py      # Visualization & reporting
│   │
│   ├── services/                 # Business logic layer
│   │   ├── file_service.py       # File read/write operations
│   │   ├── bias_detection_service.py      # Detect categorical bias
│   │   ├── bias_correction_service.py     # Fix categorical bias
│   │   ├── skewness_detection_service.py  # Detect continuous skewness
│   │   ├── skewness_correction_service.py # Fix continuous skewness
│   │   └── visualization_service.py        # Generate charts
│   │
│   ├── utils/                    # Helper utilities
│   │   ├── data_stats.py         # Statistical calculations
│   │   ├── validators/           # Input validation
│   │   │   ├── file_validator.py  # Validate filenames
│   │   │   └── path_validator.py  # Validate file paths
│   │   └── transformers/         # Data transformation logic
│   │       ├── categorical.py     # SMOTE, over/undersample
│   │       └── continuous.py      # Log, sqrt, Box-Cox transforms
│   │
│   ├── uploads/                  # Uploaded & processed files
│   └── corrected/                # Corrected datasets

├── frontend/                     # React application
│   ├── src/
│   │   ├── main.jsx              # React entry point
│   │   ├── App.jsx               # Router configuration
│   │   ├── index.css             # Global styles (Tailwind)
│   │   │
│   │   ├── pages/                # Main page components
│   │   │   ├── Home.jsx          # Landing page
│   │   │   ├── Dashboard.jsx     # 7-step workflow orchestrator
│   │   │   └── ReportPage.jsx    # Final report with charts & downloads
│   │   │
│   │   ├── components/           # Reusable UI components
│   │   │   ├── FileUpload.jsx               # File upload interface
│   │   │   ├── DatasetPreview.jsx           # Show data table
│   │   │   ├── Preprocess.jsx               # Cleaning interface
│   │   │   ├── ColumnSelector.jsx           # Select target column
│   │   │   ├── FeatureSelector.jsx          # Classify column types
│   │   │   ├── BiasDetection.jsx            # Show bias results
│   │   │   ├── UnifiedBiasFix.jsx           # Combined fix interface
│   │   │   ├── BiasFixSandbox.jsx           # Categorical correction
│   │   │   ├── SkewnessFixSandbox.jsx       # Continuous correction
│   │   │   ├── Visualization.jsx            # Chart display
│   │   │   ├── ReportGenerator.jsx          # PDF generation
│   │   │   ├── CategoricalColumnsModal.jsx  # Column type modal
│   │   │   └── Spinner.jsx                  # Loading indicator
│   │   │
│   │   └── hooks/
│   │       └── usePersistedState.js  # Local storage state management
│   │
│   ├── package.json              # Node dependencies
│   ├── vite.config.js            # Vite configuration
│   └── index.html                # HTML template

├── report/                       # LaTeX report files
└── README.md                     # Project documentation
```

---

## 🛠 Technology Stack

### Backend:
- **Flask**: Python web framework
- **Flask-Smorest**: REST API with OpenAPI/Swagger docs
- **Flask-CORS**: Cross-origin resource sharing
- **pandas**: Data manipulation
- **scikit-learn**: Machine learning algorithms
- **imbalanced-learn**: SMOTE and sampling techniques
- **scipy**: Statistical functions and Box-Cox transformation
- **plotly**: Chart generation
- **reportlab**: PDF generation (legacy)

### Frontend:
- **React.js 19**: UI library
- **React Router**: Navigation
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Styling framework
- **Axios**: HTTP client for API calls
- **Plotly.js**: Interactive charts
- **html2pdf.js**: PDF generation from HTML

### Data Formats:
- CSV and Excel (.xlsx, .xls) file support
- JSON for API communication

---

## 🔧 Backend Architecture

### 1. **app.py** - Main Application Factory

```python
from flask import Flask
from flask_smorest import Api
from flask_cors import CORS

# Import route blueprints
from resources.upload_routes import blp as UploadBlueprint
from resources.preprocess_routes import blp as PreprocessBlueprint
from resources.bias_routes import blp as BiasBlueprint
from resources.select_routes import blp as SelectBlueprint
from resources.report_routes import blp as ReportBlueprint

def create_app():
    app = Flask(__name__)
    
    # Enable CORS for frontend (localhost:5173)
    CORS(app, resources={r"/*": {"origins": ["http://localhost:5173"]}})
    
    # Initialize API with Swagger docs
    api = Api(app)
    
    # Register all blueprints (route modules)
    api.register_blueprint(UploadBlueprint)
    api.register_blueprint(PreprocessBlueprint)
    api.register_blueprint(BiasBlueprint)
    api.register_blueprint(SelectBlueprint)
    api.register_blueprint(ReportBlueprint)
    
    return app

if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)
```

**What it does:**
- Creates Flask application instance
- Configures CORS to allow frontend requests
- Registers all API route blueprints
- Enables Swagger UI at `/swagger-ui` for API documentation
- Runs on port 5000

---

### 2. **resources/** - API Route Handlers (Blueprints)

Each blueprint handles specific API endpoints:

#### **upload_routes.py**

**Endpoints:**
- `POST /api/upload` - Upload CSV/Excel file
- `POST /api/preview` - Preview first 10 rows

**Flow:**
```
Client uploads file
  ↓
Validate filename (security check)
  ↓
Save to uploads/ directory
  ↓
Return file path: "uploads/filename.csv"
```

**Key Functions:**
```python
@blp.route("/upload")
class UploadFile(MethodView):
    def post(self):
        # 1. Check if 'file' exists in request
        # 2. Validate filename (no ../, remove special chars)
        # 3. Save to uploads/ directory
        # 4. Return relative path
```

---

#### **preprocess_routes.py**

**Endpoint:** `POST /api/preprocess`

**Input:**
```json
{
  "file_path": "uploads/dataset.csv"
}
```

**Processing Steps:**
1. Read CSV/Excel file into pandas DataFrame
2. Count missing values (NaN) per column
3. Drop rows with ANY NaN values
4. Drop duplicate rows
5. Save cleaned file as `uploads/cleaned_dataset.csv`

**Output:**
```json
{
  "message": "Preprocessing complete",
  "missing_values": {"age": 5, "income": 2},
  "rows_before": 1000,
  "rows_with_na_removed": 7,
  "duplicates_removed": 3,
  "rows_after": 990,
  "dataset_shape": [990, 10],
  "cleaned_file_path": "uploads/cleaned_dataset.csv"
}
```

---

#### **select_routes.py**

**Endpoint:** `POST /api/select`

**Purpose:** Create a subset of the dataset with only selected columns

**Input:**
```json
{
  "file_path": "uploads/cleaned_dataset.csv",
  "selected_columns": ["age", "gender", "income"]
}
```

**Processing:**
1. Read dataset
2. Extract only specified columns
3. Save as `uploads/selected_cleaned_dataset.csv`

**Output:**
```json
{
  "message": "Selection complete",
  "selected_file_path": "uploads/selected_cleaned_dataset.csv",
  "shape": [990, 3]
}
```

---

#### **bias_routes.py** - Core Bias Detection & Correction

**Main Endpoints:**

##### 1. `POST /api/bias/detect` - Detect Categorical Bias

**Input:**
```json
{
  "file_path": "uploads/selected_dataset.csv",
  "categorical": ["gender", "region"]
}
```

**Processing (BiasDetectionService):**
```python
For each categorical column:
  1. Calculate class distribution (value_counts)
  2. Compute imbalance ratio = min_class / max_class
  3. Assign severity:
     - ratio >= 0.5  → "Low"
     - ratio >= 0.2  → "Moderate"
     - ratio < 0.2   → "Severe"
```

**Output:**
```json
{
  "gender": {
    "Male": 0.85,
    "Female": 0.15,
    "severity": "Severe"
  },
  "region": {
    "North": 0.40,
    "South": 0.35,
    "East": 0.25,
    "severity": "Moderate"
  }
}
```

---

##### 2. `POST /api/bias/fix` - Fix Categorical Bias

**Input:**
```json
{
  "file_path": "uploads/selected_dataset.csv",
  "target_column": "gender",
  "method": "smote",
  "threshold": 0.5,
  "categorical_columns": ["region", "job_type"]
}
```

**Methods Available:**
- **smote**: Synthetic Minority Over-sampling (creates synthetic samples)
- **oversample**: Random oversampling (duplicates minority samples)
- **undersample**: Random undersampling (removes majority samples)
- **reweight**: Assigns sample weights (doesn't change data)

**Processing Flow:**
```
1. Load dataset
2. Separate features (X) and target (y)
3. Apply SMOTE or SMOTE-NC (if categorical columns provided)
4. Generate synthetic samples
5. Combine X and y back into DataFrame
6. Save corrected file with timestamp
7. Generate before/after statistics
```

**Output:**
```json
{
  "message": "Bias correction completed",
  "method": "smote",
  "threshold": 0.5,
  "before": {
    "Male": {"count": 850, "percentage": 0.85},
    "Female": {"count": 150, "percentage": 0.15},
    "total": 1000
  },
  "after": {
    "Male": {"count": 850, "percentage": 0.50},
    "Female": {"count": 850, "percentage": 0.50},
    "total": 1700
  },
  "corrected_file_path": "corrected/corrected_dataset_gender_1699876543.csv"
}
```

---

##### 3. `POST /api/skew/detect` - Detect Continuous Skewness

**Input:**
```json
{
  "file_path": "uploads/selected_dataset.csv",
  "continuous": ["age", "income", "score"]
}
```

**Processing (SkewnessDetectionService):**
```python
For each continuous column:
  1. Calculate skewness coefficient using scipy.stats.skew()
  2. Classify:
     - skewness < -0.5  → "Left skew"
     - skewness > 0.5   → "Right skew"
     - otherwise        → "Approximately normal"
```

**Output:**
```json
{
  "age": {
    "skewness": 0.15,
    "classification": "Approximately normal"
  },
  "income": {
    "skewness": 2.5,
    "classification": "Right skew"
  },
  "score": {
    "skewness": -0.8,
    "classification": "Left skew"
  }
}
```

---

##### 4. `POST /api/skew/fix` - Fix Continuous Skewness

**Input:**
```json
{
  "file_path": "uploads/selected_dataset.csv",
  "column": "income",
  "method": "log"
}
```

**Methods Available:**
- **log**: Log transformation (log(x + 1))
- **sqrt**: Square root transformation
- **boxcox**: Box-Cox transformation (optimizes lambda parameter)

**Processing (SkewnessCorrectionService):**
```python
if method == "log":
    transformed = np.log1p(data)  # log(x + 1)
elif method == "sqrt":
    transformed = np.sqrt(data)
elif method == "boxcox":
    transformed, lambda_param = boxcox(data)
```

**Output:**
```json
{
  "message": "Skewness correction applied",
  "column": "income",
  "method": "log",
  "original_skewness": 2.5,
  "new_skewness": 0.3,
  "corrected_file_path": "corrected/corrected_dataset_income_1699876789.csv"
}
```

---

#### **report_routes.py**

**Endpoint:** `POST /api/visualize`

**Purpose:** Generate before/after charts for bias corrections

**Input:**
```json
{
  "categorical_corrections": {
    "gender": {
      "corrected_file_path": "corrected/corrected_gender.csv"
    }
  },
  "continuous_corrections": {
    "income": {
      "corrected_file_path": "corrected/corrected_income.csv"
    }
  }
}
```

**Processing (VisualizationService):**
```python
For each correction:
  1. Read original file
  2. Read corrected file
  3. Generate Plotly charts:
     - Categorical: Bar charts (class distribution)
     - Continuous: Histograms (distribution curves)
  4. Return chart data as JSON
```

**Output:**
```json
{
  "categorical": {
    "gender": {
      "before_chart": {...plotly_data...},
      "after_chart": {...plotly_data...}
    }
  },
  "continuous": {
    "income": {
      "before_chart": {...plotly_data...},
      "after_chart": {...plotly_data...}
    }
  }
}
```

---

### 3. **services/** - Business Logic Layer

#### **file_service.py**

**Key Methods:**
```python
class FileService:
    @staticmethod
    def read_dataset(file_path):
        """Read CSV or Excel file into pandas DataFrame"""
        
    @staticmethod
    def save_dataset(df, file_path):
        """Save DataFrame as CSV"""
        
    @staticmethod
    def get_preview(df, rows=10):
        """Return first N rows as JSON"""
```

---

#### **bias_detection_service.py**

**Key Methods:**
```python
class BiasDetectionService:
    @staticmethod
    def detect_imbalance(df, categorical_columns):
        """Calculate class distribution and severity"""
        result = {}
        for col in categorical_columns:
            dist = df[col].value_counts(normalize=True)
            ratio = min(dist) / max(dist)
            severity = "Low" if ratio >= 0.5 else "Moderate" if ratio >= 0.2 else "Severe"
            result[col] = {**dist.to_dict(), "severity": severity}
        return result
```

---

#### **bias_correction_service.py**

**Key Methods:**
```python
from imblearn.over_sampling import SMOTE, SMOTENC
from imblearn.under_sampling import RandomUnderSampler

class BiasCorrectionService:
    @staticmethod
    def apply_correction(df, target_col, method, threshold, categorical_columns):
        X = df.drop(columns=[target_col])
        y = df[target_col]
        
        if method == "smote":
            if categorical_columns:
                # Use SMOTE-NC for mixed data
                cat_indices = [X.columns.get_loc(c) for c in categorical_columns]
                sampler = SMOTENC(categorical_features=cat_indices, sampling_strategy=threshold)
            else:
                sampler = SMOTE(sampling_strategy=threshold)
            X_resampled, y_resampled = sampler.fit_resample(X, y)
        
        elif method == "oversample":
            # Duplicate minority samples
            ...
        
        elif method == "undersample":
            # Remove majority samples
            ...
        
        # Combine back into DataFrame
        df_corrected = pd.concat([X_resampled, y_resampled], axis=1)
        return df_corrected, metadata
```

---

#### **skewness_correction_service.py**

**Key Methods:**
```python
from scipy.stats import boxcox
import numpy as np

class SkewnessCorrectionService:
    @staticmethod
    def apply_transformation(df, column, method):
        data = df[column]
        
        if method == "log":
            transformed = np.log1p(data)  # Handles zero values
        
        elif method == "sqrt":
            transformed = np.sqrt(data)
        
        elif method == "boxcox":
            transformed, lambda_param = boxcox(data)
        
        df[column] = transformed
        return df, new_skewness
```

---

#### **visualization_service.py**

**Key Methods:**
```python
import plotly.graph_objects as go

class VisualizationService:
    @staticmethod
    def create_categorical_chart(df, column):
        """Create bar chart for categorical data"""
        counts = df[column].value_counts()
        fig = go.Figure(data=[go.Bar(x=counts.index, y=counts.values)])
        return fig.to_dict()
    
    @staticmethod
    def create_continuous_chart(df, column):
        """Create histogram for continuous data"""
        fig = go.Figure(data=[go.Histogram(x=df[column])])
        return fig.to_dict()
```

---

### 4. **utils/** - Helper Utilities

#### **validators/file_validator.py**

**Purpose:** Security validation for uploaded filenames

```python
class FileValidator:
    ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls'}
    
    @staticmethod
    def validate_filename(filename):
        # Remove path traversal attacks (../)
        # Check file extension
        # Sanitize special characters
        if ".." in filename:
            return None, "Invalid filename"
        ext = filename.rsplit('.', 1)[1].lower()
        if ext not in FileValidator.ALLOWED_EXTENSIONS:
            return None, "File type not allowed"
        return filename, None
```

---

#### **validators/path_validator.py**

**Purpose:** Prevent path traversal attacks

```python
class PathValidator:
    @staticmethod
    def validate_upload_path(file_path, base_dir, upload_dir):
        # Convert relative path to absolute
        # Check if path is within allowed directory
        abs_path = os.path.join(base_dir, file_path)
        if not abs_path.startswith(upload_dir):
            return None, "Invalid file path"
        if not os.path.exists(abs_path):
            return None, "File not found"
        return abs_path, None
```

---

#### **transformers/categorical.py**

**Purpose:** Implements SMOTE and sampling algorithms

```python
from imblearn.over_sampling import SMOTE, SMOTENC

class CategoricalTransformer:
    @staticmethod
    def apply_smote(X, y, categorical_indices=None):
        if categorical_indices:
            sampler = SMOTENC(categorical_features=categorical_indices)
        else:
            sampler = SMOTE()
        X_resampled, y_resampled = sampler.fit_resample(X, y)
        return X_resampled, y_resampled
```

---

#### **transformers/continuous.py**

**Purpose:** Implements skewness transformations

```python
from scipy.stats import boxcox
import numpy as np

class ContinuousTransformer:
    @staticmethod
    def apply_log(data):
        return np.log1p(data)
    
    @staticmethod
    def apply_sqrt(data):
        return np.sqrt(data)
    
    @staticmethod
    def apply_boxcox(data):
        transformed, lambda_param = boxcox(data)
        return transformed, lambda_param
```

---

## 🎨 Frontend Architecture

### 1. **main.jsx** - React Entry Point

```jsx
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'  // Tailwind CSS

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
```

**What it does:**
- Mounts React application to `<div id="root">` in index.html
- Imports global Tailwind CSS styles

---

### 2. **App.jsx** - Router Configuration

```jsx
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import ReportPage from "./pages/ReportPage";

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/dashboard", element: <Dashboard /> },
  { path: "/report", element: <ReportPage /> }
]);

export default function App() {
  return <RouterProvider router={router} />;
}
```

**Routes:**
- `/` → Home page (file upload)
- `/dashboard` → 7-step workflow
- `/report` → Final report with charts

---

### 3. **pages/Home.jsx** - Landing Page

**Purpose:** Initial file upload

```jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import FileUpload from "../components/FileUpload";

export default function Home() {
  const [uploadedPath, setUploadedPath] = useState("");
  const navigate = useNavigate();

  const handleUploadSuccess = (filePath) => {
    setUploadedPath(filePath);
    navigate("/dashboard", { state: { filePath } });
  };

  return (
    <div>
      <h1>BiasXplorer-Mini</h1>
      <FileUpload onUploadSuccess={handleUploadSuccess} />
    </div>
  );
}
```

**Flow:**
1. User uploads file via FileUpload component
2. On success, navigate to /dashboard with file path

---

### 4. **pages/Dashboard.jsx** - Main Workflow Orchestrator

**Purpose:** Manages 7-step bias detection and correction workflow

**State Management:**
```jsx
const [currentStep, setCurrentStep] = useState(1);
const [filePath, setFilePath] = useState("");
const [columns, setColumns] = useState([]);
const [selectedColumns, setSelectedColumns] = useState([]);
const [categorical, setCategorical] = useState([]);
const [continuous, setContinuous] = useState([]);
const [biasResults, setBiasResults] = useState({});
const [skewnessResults, setSkewnessResults] = useState({});
const [correctedFilePath, setCorrectedFilePath] = useState("");
```

**7 Steps:**

#### **Step 1: Dataset Preview**
```jsx
<DatasetPreview 
  filePath={filePath}
  onColumnsLoaded={(cols) => setColumns(cols)}
  onNext={() => setCurrentStep(2)}
/>
```
- Shows first 10 rows of uploaded file
- Extracts column names

---

#### **Step 2: Data Preprocessing**
```jsx
<Preprocess
  filePath={filePath}
  onPreprocessComplete={(cleanedPath) => {
    setFilePath(cleanedPath);
    setCurrentStep(3);
  }}
/>
```
- Calls `POST /api/preprocess`
- Removes NaN and duplicates
- Updates file path to cleaned version

---

#### **Step 3: Target Column Selection**
```jsx
<ColumnSelector
  columns={columns}
  selectedColumns={selectedColumns}
  onSelectColumns={(selected) => {
    setSelectedColumns(selected);
    setCurrentStep(4);
  }}
/>
```
- User selects which columns to analyze
- Calls `POST /api/select` to create subset
- Updates file path to selected version

---

#### **Step 4: Column Type Classification**
```jsx
<FeatureSelector
  columns={selectedColumns}
  onClassify={(cat, cont) => {
    setCategorical(cat);
    setContinuous(cont);
    setCurrentStep(5);
  }}
/>
```
- User classifies columns as categorical or continuous
- Stores classifications for next steps

---

#### **Step 5: Bias Detection**
```jsx
<BiasDetection
  filePath={filePath}
  categorical={categorical}
  continuous={continuous}
  onDetectionComplete={(biasRes, skewRes) => {
    setBiasResults(biasRes);
    setSkewnessResults(skewRes);
    setCurrentStep(6);
  }}
/>
```
- Calls `POST /api/bias/detect` for categorical
- Calls `POST /api/skew/detect` for continuous
- Shows severity levels and distributions

---

#### **Step 6: Bias Fix**
```jsx
<UnifiedBiasFix
  filePath={filePath}
  categorical={categorical}
  continuous={continuous}
  biasResults={biasResults}
  skewnessResults={skewnessResults}
  onFixComplete={(correctedPath) => {
    setCorrectedFilePath(correctedPath);
    setCurrentStep(7);
  }}
/>
```
- User selects correction methods
- Applies fixes one column at a time
- Updates file path after each fix

---

#### **Step 7: Visualization**
```jsx
<Visualization
  corrections={allCorrections}
  onVisualizationComplete={(vizData) => {
    navigate("/report", { state: { vizData, corrections } });
  }}
/>
```
- Calls `POST /api/visualize`
- Generates before/after charts
- Navigates to report page

---

### 5. **pages/ReportPage.jsx** - Final Report

**Purpose:** Display comprehensive report with charts and download options

**Features:**
1. **Bias Summary**: Shows counts of Low/Moderate/Severe bias
2. **Correction Summary**: Lists all corrections applied
3. **Visualizations**: Interactive Plotly charts (before/after)
4. **Categorical Corrections Table**: Detailed table with method, threshold, before/after counts
5. **Continuous Corrections Table**: Skewness values and transformation methods
6. **PDF Download**: Generate downloadable report
7. **CSV Download**: Download corrected dataset

**Key Functions:**
```jsx
const downloadPDF = async () => {
  // Use html2pdf.js to convert HTML to PDF
  const element = document.getElementById('report-content');
  html2pdf().from(element).save('bias-report.pdf');
};

const downloadCorrectedCSV = async () => {
  // Download the final corrected CSV file
  const response = await axios.get(`/api/download/${correctedFilePath}`);
  // Trigger browser download
};
```

---

### 6. **Components** - Reusable UI Elements

#### **FileUpload.jsx**
```jsx
const handleFileChange = (e) => {
  const file = e.target.files[0];
  const formData = new FormData();
  formData.append('file', file);
  
  axios.post('/api/upload', formData)
    .then(response => {
      onUploadSuccess(response.data.file_path);
    });
};
```

---

#### **DatasetPreview.jsx**
```jsx
useEffect(() => {
  axios.post('/api/preview', { file_path: filePath })
    .then(response => {
      setPreviewData(response.data.rows);
      setColumns(response.data.columns);
    });
}, [filePath]);
```

---

#### **Preprocess.jsx**
```jsx
const handlePreprocess = () => {
  axios.post('/api/preprocess', { file_path: filePath })
    .then(response => {
      setStats(response.data);
      onPreprocessComplete(response.data.cleaned_file_path);
    });
};
```

---

#### **BiasDetection.jsx**
```jsx
const detectBias = () => {
  // Categorical bias
  axios.post('/api/bias/detect', { 
    file_path: filePath,
    categorical: categorical
  })
    .then(response => setBiasResults(response.data));
  
  // Continuous skewness
  axios.post('/api/skew/detect', {
    file_path: filePath,
    continuous: continuous
  })
    .then(response => setSkewnessResults(response.data));
};
```

---

#### **BiasFixSandbox.jsx** (Categorical)
```jsx
const applyFix = () => {
  axios.post('/api/bias/fix', {
    file_path: filePath,
    target_column: selectedColumn,
    method: selectedMethod,
    threshold: threshold,
    categorical_columns: otherCategorical
  })
    .then(response => {
      setBeforeAfter(response.data);
      onFixComplete(response.data.corrected_file_path);
    });
};
```

---

#### **SkewnessFixSandbox.jsx** (Continuous)
```jsx
const applyFix = () => {
  axios.post('/api/skew/fix', {
    file_path: filePath,
    column: selectedColumn,
    method: selectedMethod
  })
    .then(response => {
      setSkewnessBefore(response.data.original_skewness);
      setSkewnessAfter(response.data.new_skewness);
      onFixComplete(response.data.corrected_file_path);
    });
};
```

---

#### **Visualization.jsx**
```jsx
import Plot from 'react-plotly.js';

const Visualization = ({ chartData }) => {
  return (
    <Plot
      data={chartData.data}
      layout={chartData.layout}
      config={{ responsive: true }}
    />
  );
};
```

---

### 7. **hooks/usePersistedState.js**

**Purpose:** Save state to localStorage to persist across page refreshes

```jsx
export function usePersistedState(key, defaultValue) {
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState];
}
```

**Usage:**
```jsx
const [filePath, setFilePath] = usePersistedState("dashboard_filePath", "");
// State persists even after page refresh!
```

---

## 🔄 Complete Data Flow

### **Scenario: User fixes gender bias using SMOTE**

#### **1. Upload File**
```
User (Browser)
  ↓ Selects file
FileUpload.jsx
  ↓ FormData with file
POST /api/upload
  ↓
upload_routes.py
  ↓ Validate & save
uploads/dataset.csv
  ↓ Return path
Home.jsx
  ↓ Navigate
Dashboard.jsx (Step 1)
```

---

#### **2. Preview Dataset**
```
Dashboard.jsx (Step 1)
  ↓
DatasetPreview.jsx
  ↓ POST /api/preview {"file_path": "uploads/dataset.csv"}
preprocess_routes.py
  ↓
FileService.read_dataset()
  ↓ pandas.read_csv()
DataFrame
  ↓ df.head(10)
JSON with rows and columns
  ↓
DatasetPreview.jsx
  ↓ Display table
User sees data
```

---

#### **3. Preprocess Data**
```
Dashboard.jsx (Step 2)
  ↓
Preprocess.jsx
  ↓ POST /api/preprocess {"file_path": "uploads/dataset.csv"}
preprocess_routes.py
  ↓
FileService.read_dataset()
  ↓
DataFrame.dropna() → Remove NaN
  ↓
DataFrame.drop_duplicates() → Remove duplicates
  ↓
FileService.save_dataset() → uploads/cleaned_dataset.csv
  ↓ Return stats
Preprocess.jsx
  ↓ Show stats
Dashboard.jsx updates filePath to "uploads/cleaned_dataset.csv"
```

---

#### **4. Select Columns**
```
Dashboard.jsx (Step 3)
  ↓
ColumnSelector.jsx
  ↓ User selects: ["age", "gender", "income"]
  ↓ POST /api/select
select_routes.py
  ↓
DataFrame[selected_columns]
  ↓ Save subset
uploads/selected_cleaned_dataset.csv
  ↓
Dashboard.jsx updates filePath
```

---

#### **5. Classify Column Types**
```
Dashboard.jsx (Step 4)
  ↓
FeatureSelector.jsx
  ↓ User marks:
    categorical = ["gender"]
    continuous = ["age", "income"]
  ↓
Dashboard.jsx stores classifications
```

---

#### **6. Detect Bias**
```
Dashboard.jsx (Step 5)
  ↓
BiasDetection.jsx
  ↓ POST /api/bias/detect
    {
      "file_path": "uploads/selected_cleaned_dataset.csv",
      "categorical": ["gender"]
    }
  ↓
bias_routes.py → BiasDetectionService
  ↓
For "gender" column:
  1. value_counts(normalize=True)
     → {"Male": 0.85, "Female": 0.15}
  2. ratio = 0.15 / 0.85 = 0.176
  3. severity = "Severe" (< 0.2)
  ↓
Return: {
  "gender": {
    "Male": 0.85,
    "Female": 0.15,
    "severity": "Severe"
  }
}
  ↓
BiasDetection.jsx displays red badge "Severe"
  ↓
Dashboard.jsx stores biasResults
```

---

#### **7. Fix Gender Bias**
```
Dashboard.jsx (Step 6)
  ↓
UnifiedBiasFix.jsx → BiasFixSandbox.jsx
  ↓ User selects:
    - Column: "gender"
    - Method: "smote"
    - Threshold: 0.5
  ↓ POST /api/bias/fix
    {
      "file_path": "uploads/selected_cleaned_dataset.csv",
      "target_column": "gender",
      "method": "smote",
      "threshold": 0.5,
      "categorical_columns": []
    }
  ↓
bias_routes.py → BiasCorrectionService
  ↓
1. Load DataFrame (1000 rows)
2. X = df.drop(columns=["gender"])
   y = df["gender"]
   
3. Apply SMOTE:
   from imblearn.over_sampling import SMOTE
   sampler = SMOTE(sampling_strategy=0.5)
   X_resampled, y_resampled = sampler.fit_resample(X, y)
   
4. SMOTE creates synthetic "Female" samples:
   Before: Male=850, Female=150
   After:  Male=850, Female=425 (added 275 synthetic)
   
5. Combine back into DataFrame (1275 rows)

6. Save: corrected/corrected_selected_cleaned_dataset_gender_1699876543.csv

7. Calculate statistics:
   before = {"Male": 850, "Female": 150}
   after = {"Male": 850, "Female": 425}
  ↓
Return: {
  "message": "Bias correction completed",
  "method": "smote",
  "before": {...},
  "after": {...},
  "corrected_file_path": "corrected/..."
}
  ↓
BiasFixSandbox.jsx shows before/after table
  ↓
Dashboard.jsx updates correctedFilePath
```

---

#### **8. Generate Visualizations**
```
Dashboard.jsx (Step 7)
  ↓
Visualization.jsx
  ↓ POST /api/visualize
    {
      "categorical_corrections": {
        "gender": {
          "original_file_path": "uploads/selected_cleaned_dataset.csv",
          "corrected_file_path": "corrected/corrected_...csv"
        }
      }
    }
  ↓
report_routes.py → VisualizationService
  ↓
1. Load original file
   gender_counts_before = {"Male": 850, "Female": 150}

2. Load corrected file
   gender_counts_after = {"Male": 850, "Female": 425}

3. Generate Plotly charts:
   
   before_chart = {
     "data": [{
       "type": "bar",
       "x": ["Male", "Female"],
       "y": [850, 150],
       "marker": {"color": "oklch(0.55 0.15 250)"}
     }],
     "layout": {
       "title": "Gender Distribution - Before",
       "xaxis": {"title": "Class"},
       "yaxis": {"title": "Count"}
     }
   }
   
   after_chart = {
     "data": [{
       "type": "bar",
       "x": ["Male", "Female"],
       "y": [850, 425],
       "marker": {"color": "oklch(0.65 0.15 150)"}
     }],
     "layout": {
       "title": "Gender Distribution - After",
       "xaxis": {"title": "Class"},
       "yaxis": {"title": "Count"}
     }
   }
  ↓
Return: {
  "categorical": {
    "gender": {
      "before_chart": {...},
      "after_chart": {...}
    }
  }
}
  ↓
Visualization.jsx renders Plotly charts
  ↓
User clicks "Go to Report"
  ↓
Navigate to /report with visualizations data
```

---

#### **9. View Report**
```
ReportPage.jsx
  ↓ Receives visualizations from navigation state
  ↓
Display Report:
  - Bias Summary
    • Columns fixed: 1 (gender)
    • Total columns selected: 3
    • Categorical:
      - Severe: 1 (gender)
  
  - Correction Summary
    • Categorical:
      - Total selected: 1
      - Needing fix: 1
      - Fixed: 1
  
  - Categorical Corrections Table
    ┌────────┬────────┬───────────┬──────────────┬─────────────┬──────────────┬─────────────┐
    │ Column │ Method │ Threshold │ Before Total │ After Total │ Before Ratio │ After Ratio │
    ├────────┼────────┼───────────┼──────────────┼─────────────┼──────────────┼─────────────┤
    │ gender │ smote  │ 0.5       │ 1000         │ 1275        │ 0.176        │ 0.5         │
    └────────┴────────┴───────────┴──────────────┴─────────────┴──────────────┴─────────────┘
  
  - Visualizations
    [Before Bar Chart: Male=850, Female=150]
    [After Bar Chart: Male=850, Female=425]
  
  - Download Buttons
    [Download PDF Report]
    [Download Corrected CSV]
```

---

#### **10. Download Corrected Dataset**
```
User clicks "Download CSV"
  ↓
ReportPage.jsx
  ↓ Create download link
const link = document.createElement('a');
link.href = `/api/download/corrected/corrected_...csv`;
link.download = 'corrected_dataset.csv';
link.click();
  ↓
Browser downloads file from backend
  ↓
User receives: corrected_dataset.csv (1275 rows, balanced gender)
```

---

## 📊 Key Algorithms Explained

### **1. SMOTE (Synthetic Minority Over-sampling Technique)**

**Purpose:** Generate synthetic samples for minority class

**Algorithm:**
```python
For each minority sample:
  1. Find K nearest neighbors (default K=5) from same class
  2. Randomly select one neighbor
  3. Create synthetic sample along line between original and neighbor:
     synthetic = original + λ × (neighbor - original)
     where λ is random value between 0 and 1

Repeat until desired class balance achieved
```

**Example:**
```
Original data:
  Male: 850 samples
  Female: 150 samples

After SMOTE (target ratio 0.5):
  Male: 850 samples
  Female: 425 samples (150 original + 275 synthetic)
```

**Why it works:**
- Synthetic samples are similar to real data (interpolated)
- Increases minority class without exact duplication
- Helps ML models learn minority patterns better

---

### **2. SMOTE-NC (SMOTE for Numerical and Categorical)**

**Purpose:** SMOTE for datasets with mixed data types

**Algorithm:**
```python
For categorical columns:
  1. Use mode (most common value) of K neighbors
  2. Synthetic sample gets this mode value

For numerical columns:
  1. Use standard SMOTE interpolation
  2. synthetic = original + λ × (neighbor - original)
```

**Example:**
```
Original minority sample:
  age=25, gender=Female, region=North

K=5 neighbors:
  age=[24, 26, 23, 27, 25], gender=[F,F,F,F,F], region=[N,N,S,N,N]

Synthetic sample:
  age = 25 + 0.3 × (24 - 25) = 24.7  ← Interpolated
  gender = Female                     ← Mode of neighbors
  region = North                      ← Mode of neighbors
```

---

### **3. Box-Cox Transformation**

**Purpose:** Find optimal transformation to make data more normal

**Algorithm:**
```python
For λ (lambda) values from -5 to 5:
  if λ = 0:
    transformed = log(x)
  else:
    transformed = (x^λ - 1) / λ
  
  Calculate log-likelihood of transformed data
  
Select λ with highest log-likelihood
```

**Example:**
```
Original income data (right-skewed):
  [10000, 15000, 20000, 50000, 100000]
  skewness = 2.5

Optimal λ = 0.2

Transformed:
  [(10000^0.2 - 1) / 0.2, ...]
  ≈ [3.98, 4.43, 4.75, 6.46, 7.94]
  skewness = 0.3
```

---

## 🔐 Security Features

### **1. Path Traversal Protection**
```python
# Prevents: ../../../etc/passwd
if ".." in file_path:
    return error

abs_path = os.path.abspath(file_path)
if not abs_path.startswith(UPLOAD_DIR):
    return error
```

---

### **2. File Type Validation**
```python
ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls'}

ext = filename.rsplit('.', 1)[1].lower()
if ext not in ALLOWED_EXTENSIONS:
    return error
```

---

### **3. Filename Sanitization**
```python
import re

# Remove special characters
filename = re.sub(r'[^a-zA-Z0-9._-]', '', filename)
```

---

### **4. CORS Configuration**
```python
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5173"],  # Only allow frontend
        "methods": ["GET", "POST", "PUT", "DELETE"]
    }
})
```

---

## 🎯 Error Handling

### **Backend Error Patterns**
```python
try:
    # Operation
    df = FileService.read_dataset(path)
except FileNotFoundError:
    return jsonify({"error": "File not found"}), 404
except ValueError as e:
    return jsonify({"error": f"Invalid data: {str(e)}"}), 400
except Exception as e:
    return jsonify({"error": str(e)}), 500
```

---

### **Frontend Error Patterns**
```jsx
axios.post('/api/endpoint', data)
  .then(response => {
    // Success
  })
  .catch(error => {
    if (error.response) {
      // Server returned error
      alert(error.response.data.error);
    } else {
      // Network error
      alert("Network error");
    }
  });
```

---

## 📈 Performance Optimizations

### **1. Persistent State (Frontend)**
- Uses localStorage to cache workflow state
- User can refresh page without losing progress
- Implemented via `usePersistedState` hook

### **2. Lazy Loading (Frontend)**
- React Router code-splitting
- Components load only when needed

### **3. Efficient Data Processing (Backend)**
- pandas vectorized operations (fast)
- Avoid loops where possible
- Use `.to_dict()` for JSON serialization

### **4. Visualization Optimization**
- Use plotly.js-dist-min (minified version)
- Reduces bundle size from 3.5MB → 1.2MB
- Faster initial page load

---

## 🧪 Testing Scenarios

### **Test Case 1: Gender Bias**
```
Input: gender column [Male: 850, Female: 150]
Method: SMOTE, threshold=0.5
Expected: [Male: 850, Female: 425]
```

### **Test Case 2: Multi-class Bias**
```
Input: region [North: 400, South: 300, East: 200, West: 100]
Method: SMOTE, threshold=0.8
Expected: Bring all classes closer to 400
```

### **Test Case 3: Right-skewed Income**
```
Input: income [10k, 15k, 20k, 50k, 100k, 200k]
Skewness: 2.5
Method: log transformation
Expected: Skewness ≈ 0.3
```

---

## 🚀 Deployment Considerations

### **Backend Deployment:**
```bash
# Production server
gunicorn -w 4 -b 0.0.0.0:5000 app:app

# Environment variables
export FLASK_ENV=production
export UPLOAD_DIR=/var/uploads
```

### **Frontend Deployment:**
```bash
# Build for production
npm run build

# Deploy to static hosting (Netlify, Vercel, etc.)
# Build output: dist/
```

### **Docker Setup:**
```dockerfile
# Backend Dockerfile
FROM python:3.11
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]

# Frontend Dockerfile
FROM node:18
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "run", "preview"]
```

---

## 📚 Key Dependencies Explained

### **Backend:**
- **Flask**: Web framework
- **pandas**: Data manipulation (like Excel in Python)
- **scikit-learn**: Machine learning library
- **imbalanced-learn**: SMOTE implementation
- **scipy**: Statistical functions (Box-Cox, skewness)
- **plotly**: Chart generation

### **Frontend:**
- **React**: UI library (component-based)
- **React Router**: Page navigation
- **Axios**: HTTP client (talks to backend)
- **Plotly.js**: Interactive charts
- **Tailwind CSS**: Utility-first styling
- **html2pdf.js**: Convert HTML to PDF

---

## 🎓 Learning Points

### **1. Full-Stack Architecture**
- Frontend (React) and Backend (Flask) separation
- RESTful API design
- JSON for data exchange

### **2. Data Science Pipeline**
- Upload → Clean → Analyze → Correct → Report
- Industry-standard workflow

### **3. Real-World Problem Solving**
- Class imbalance affects ML model fairness
- Skewed data affects statistical analysis
- Automated solutions save time

### **4. Modern Web Development**
- React hooks (useState, useEffect)
- Component reusability
- State management
- Responsive design (Tailwind)

### **5. Python Data Science Stack**
- pandas for data manipulation
- scikit-learn for ML
- scipy for statistics
- plotly for visualization

---

## 🔗 System Integration Map

```
User Browser
    ↓ HTTP
React App (localhost:5173)
    ↓ Axios (JSON)
Flask API (localhost:5000)
    ↓
┌─────────────┬──────────────┬───────────────┐
│  Services   │  Validators  │ Transformers  │
├─────────────┼──────────────┼───────────────┤
│ File        │ Path         │ SMOTE         │
│ Detection   │ File         │ Transforms    │
│ Correction  │              │               │
│ Viz         │              │               │
└─────────────┴──────────────┴───────────────┘
    ↓
File System
    ├── uploads/
    └── corrected/
```

---

This comprehensive explanation covers every aspect of the BiasXplorer-Mini project. Each file, function, and flow is documented with examples and code snippets. Use this as a complete reference for understanding, explaining, or extending the project!
