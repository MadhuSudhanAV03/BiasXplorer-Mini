# 🔄 Migration Guide: Old Code → New Modular Code

## **How to Use the New Services**

### **1. File Operations**

**❌ OLD WAY:**
```python
# Repeated everywhere
ext = os.path.splitext(filepath)[1].lower()
if ext == ".csv":
    df = pd.read_csv(filepath)
elif ext in (".xls", ".xlsx"):
    df = pd.read_excel(filepath)

# Saving
df.to_csv(output_path, index=False)
```

**✅ NEW WAY:**
```python
from services import FileService

# Reading (handles CSV/Excel automatically)
df = FileService.read_dataset(filepath)

# Saving
FileService.save_dataset(df, output_path, ensure_dir=True)

# Preview
preview_data = FileService.get_preview(df, rows=10)

# Get columns
columns = FileService.get_columns(df)
```

---

### **2. Path Validation**

**❌ OLD WAY:**
```python
# Repeated validation logic
norm_rel_path = os.path.normpath(file_path)
if os.path.isabs(norm_rel_path):
    return error("Absolute paths not allowed")

abs_path = os.path.join(BASE_DIR, norm_rel_path)
if os.path.commonpath([abs_path, UPLOAD_DIR]) != UPLOAD_DIR:
    return error("Invalid path")

if not os.path.exists(abs_path):
    return error("File not found")
```

**✅ NEW WAY:**
```python
from utils.validators import PathValidator

# For uploads directory
abs_path, error = PathValidator.validate_upload_path(
    file_path, BASE_DIR, UPLOAD_DIR
)
if error:
    return jsonify({"error": error}), 400

# For uploads or corrected directory
abs_path, error = PathValidator.validate_any_path(
    file_path, BASE_DIR, UPLOAD_DIR, CORRECTED_DIR
)
if error:
    return jsonify({"error": error}), 400
```

---

### **3. Bias Detection**

**❌ OLD WAY:**
```python
# 80+ lines of logic in route handler
result = {}
for col in categorical:
    series = df[col].dropna()
    dist = series.value_counts(normalize=True).to_dict()
    # ... more logic
    ratio = (minority / majority) if majority > 0 else 0.0
    # ... severity calculation
    result[col] = {...}
```

**✅ NEW WAY:**
```python
from services import BiasDetectionService

# One line!
result = BiasDetectionService.detect_imbalance(df, categorical_columns)

# Get class distribution for a column
stats = BiasDetectionService.get_class_distribution(df, target_col)
# Returns: {"counts": {...}, "distribution": {...}, "total": 1000}
```

---

### **4. Bias Correction**

**❌ OLD WAY:**
```python
# Complex logic with multiple if/elif branches
if method == "smote":
    # 30 lines of SMOTE logic
    X_numeric = X.apply(pd.to_numeric, errors='coerce')
    # ...
elif method == "oversample":
    # 25 lines of oversampling logic
    # ...
elif method == "undersample":
    # 25 lines of undersampling logic
    # ...
```

**✅ NEW WAY:**
```python
from services import BiasCorrectionService

# Validate method
if not BiasCorrectionService.validate_method(method):
    return error("Invalid method")

# Validate target column
is_valid, error = BiasCorrectionService.validate_target_column(df, target_col)
if not is_valid:
    return error

# Apply correction (one line!)
df_corrected, metadata = BiasCorrectionService.apply_correction(
    df, target_col, method, threshold
)
```

---

### **5. Skewness Detection**

**❌ OLD WAY:**
```python
# Logic scattered in route handler
series = df[column]
n_nonnull = series.notna().sum()
numeric_series = pd.to_numeric(series, errors='coerce')
clean_series = numeric_series.dropna()
skewness = skew(clean_series)
```

**✅ NEW WAY:**
```python
from services import SkewnessDetectionService

# Detect skewness
result = SkewnessDetectionService.detect_skewness(df, column)
# Returns: {"column": "age", "skewness": 0.45, "n_nonnull": 150, "message": "ok"}

# Interpret skewness
interpretation = SkewnessDetectionService.interpret_skewness(skewness)
# Returns: {"label": "Symmetric", "severity": "low", "description": "..."}
```

---

### **6. Skewness Correction**

**❌ OLD WAY:**
```python
# Scattered transformation logic
transformations = {}
for col in columns:
    original_skew = compute_skewness(df[col])
    if original_skew > 0.5 and original_skew <= 1:
        df[col] = np.sqrt(df[col])
    elif original_skew > 1 and original_skew <= 2:
        df[col] = np.log1p(df[col])
    # ... many more conditions
    transformations[col] = {...}
```

**✅ NEW WAY:**
```python
from services import SkewnessCorrectionService

# Correct multiple columns (one line!)
df_corrected, transformations = SkewnessCorrectionService.correct_multiple_columns(
    df, columns
)
# Returns: (corrected_df, {"age": {...}, "income": {...}})

# Correct single column
result = SkewnessCorrectionService.correct_column(df, column)
```

---

### **7. Visualization**

**❌ OLD WAY:**
```python
# Matplotlib code in route handlers
fig, ax = plt.subplots(figsize=(6, 4))
dist.plot(kind='bar', ax=ax, color="#4C78A8")
ax.set_title(title)
# ... more plotting code
buf = io.BytesIO()
fig.savefig(buf, format='png', dpi=150)
b64 = base64.b64encode(buf.read()).decode('ascii')
```

**✅ NEW WAY:**
```python
from services import VisualizationService

# Categorical charts
charts = VisualizationService.visualize_categorical_bias(
    df_before, df_after, target_col
)
# Returns: {"before_chart": "<base64>", "after_chart": "<base64>"}

# Continuous charts
charts = VisualizationService.visualize_skewness(
    df_before, df_after, columns
)
# Returns: {"age": {"before_chart": "...", "after_chart": "...", ...}}
```

---

### **8. Transformations (For Custom Logic)**

**✅ Categorical Transformations:**
```python
from utils.transformers import CategoricalTransformer

# Oversample
df_resampled = CategoricalTransformer.oversample(df, target_col)

# Undersample
df_resampled = CategoricalTransformer.undersample(df, target_col)

# SMOTE
df_resampled = CategoricalTransformer.smote(df, target_col)

# Compute class weights
weights = CategoricalTransformer.compute_class_weights(y_series)
```

**✅ Continuous Transformations:**
```python
from utils.transformers import ContinuousTransformer

# Get recommended method
method = ContinuousTransformer.get_transformation_method(skew_value)

# Apply transformation
df = ContinuousTransformer.apply_transformation(df, col, skew_value)

# Or apply specific transformations
df[col] = ContinuousTransformer.apply_log(df[col])
df = ContinuousTransformer.apply_yeo_johnson(df, col)
```

---

## **🎯 Benefits Summary**

| Aspect | Old Code | New Code |
|--------|----------|----------|
| **Lines of Code** | 923 lines | 442 lines |
| **Code Duplication** | High (repeated everywhere) | None (DRY principle) |
| **Testability** | Hard (coupled to Flask) | Easy (pure functions) |
| **Maintainability** | Low (scattered logic) | High (organized) |
| **Readability** | Poor (100+ line functions) | Excellent (20 line functions) |
| **Extensibility** | Hard (modify routes) | Easy (add to services) |

---

## **🚀 Quick Start**

To use the new modular code in your routes:

```python
# Import services
from services import (
    FileService,
    BiasDetectionService,
    BiasCorrectionService,
    SkewnessDetectionService,
    SkewnessCorrectionService,
    VisualizationService
)

# Import validators
from utils.validators import PathValidator, FileValidator

# Import transformers (if needed for custom logic)
from utils.transformers import CategoricalTransformer, ContinuousTransformer

# Then use them as shown above!
```

That's it! Your code is now modular, testable, and professional! ✨
