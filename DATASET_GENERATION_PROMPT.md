# 📊 Comprehensive Test Dataset Generation Prompt

Copy and paste this prompt into ChatGPT to generate a complete test dataset for BiasXplorer-Mini:

---

## **PROMPT START**

I need you to generate a comprehensive CSV test dataset for a bias detection and correction tool. The dataset should test ALL edge cases, valid scenarios, invalid scenarios, and various levels of bias. Here are the exact requirements:

### **Dataset Requirements:**

**Total Rows:** 1000 rows minimum

**Columns to Include:**

#### **1. CATEGORICAL COLUMNS - Class Imbalance Testing**

Create the following categorical columns with EXACT imbalance ratios:

- **`gender`** - **SEVERELY IMBALANCED** (ratio < 0.2)
  - Male: 850 rows (85%)
  - Female: 150 rows (15%)
  - Imbalance ratio: 0.176 (Severe)

- **`department`** - **MODERATELY IMBALANCED** (ratio 0.2 to 0.5)
  - Sales: 400 rows (40%)
  - IT: 300 rows (30%)
  - HR: 200 rows (20%)
  - Finance: 100 rows (10%)
  - Imbalance ratio: 0.25 (Moderate)

- **`subscription_type`** - **LOW IMBALANCE** (ratio >= 0.5)
  - Premium: 550 rows (55%)
  - Basic: 450 rows (45%)
  - Imbalance ratio: 0.818 (Low)

- **`status`** - **PERFECTLY BALANCED** (for testing edge case)
  - Active: 500 rows (50%)
  - Inactive: 500 rows (50%)
  - Imbalance ratio: 1.0 (No bias)

- **`customer_segment`** - **BINARY SEVERE IMBALANCE** (for SMOTE testing)
  - High Value: 900 rows (90%)
  - Low Value: 100 rows (10%)
  - This tests correction methods on binary classes

- **`education`** - **MULTI-CLASS WITH MISSING VALUES**
  - High School: 300 rows
  - Bachelor: 350 rows
  - Master: 250 rows
  - PhD: 70 rows
  - NULL/Missing: 30 rows
  - Tests handling of missing data in categorical columns

#### **2. CONTINUOUS COLUMNS - Skewness Testing**

Create the following continuous columns with EXACT skewness values:

- **`income`** - **HIGHLY RIGHT-SKEWED** (skewness > 3)
  - Use exponential distribution
  - Target skewness: 3.5 to 4.0
  - Range: $20,000 to $500,000
  - Majority clustered at lower end with long tail to the right

- **`age`** - **MODERATELY RIGHT-SKEWED** (skewness 1 to 2)
  - Target skewness: 1.5 to 1.8
  - Range: 18 to 75
  - More younger people, tapering off at higher ages

- **`purchase_amount`** - **SLIGHTLY RIGHT-SKEWED** (skewness 0.5 to 1)
  - Target skewness: 0.7 to 0.9
  - Range: $10 to $1000
  - Slight skew to the right

- **`account_balance`** - **SYMMETRIC** (skewness -0.5 to 0.5)
  - Target skewness: -0.1 to 0.1
  - Use normal distribution
  - Range: -$5000 to $5000
  - Tests "no correction needed" case

- **`response_time`** - **HIGHLY LEFT-SKEWED** (skewness < -2)
  - Target skewness: -2.5 to -3.0
  - Range: 0 to 100
  - Long tail to the left (negative skew)

- **`product_rating`** - **MODERATELY LEFT-SKEWED** (skewness -1 to -2)
  - Target skewness: -1.5
  - Range: 1 to 5
  - Most ratings are high (4-5) with fewer low ratings

- **`days_since_signup`** - **EXTREME RIGHT-SKEWNESS** (skewness > 5)
  - Target skewness: 5 to 7
  - Range: 1 to 3650 days
  - Most users are new, very few old users

#### **3. EDGE CASE COLUMNS**

- **`unique_id`** - **IDENTIFIER COLUMN**
  - Sequential integers 1 to 1000
  - Should be detected as identifier (high cardinality)
  - Tests column type classification

- **`transaction_id`** - **HIGH CARDINALITY CATEGORICAL**
  - Random alphanumeric strings (e.g., "TXN001", "TXN002"...)
  - All unique values
  - Tests identifier detection

- **`city`** - **HIGH CARDINALITY CATEGORICAL (20+ unique values)**
  - 30-40 different city names
  - Tests categorical with many unique values

- **`country`** - **LOW CARDINALITY CATEGORICAL (2-3 values)**
  - USA: 600
  - Canada: 300
  - UK: 100
  - Tests small cardinality categorical

#### **4. DATA QUALITY TESTING COLUMNS**

- **`score_with_nulls`** - **CONTINUOUS WITH MISSING VALUES**
  - Normal distribution, range 0-100
  - Include 100 NULL values (10%)
  - Tests missing value handling in continuous columns

- **`mixed_type_column`** - **MIXED DATA TYPES**
  - Include numeric values (500 rows): 1, 2, 3, etc.
  - Include text values (400 rows): "low", "medium", "high"
  - Include NULL values (100 rows)
  - Tests data type coercion and errors

- **`all_nulls`** - **COMPLETELY EMPTY COLUMN**
  - All 1000 values are NULL
  - Tests error handling for empty columns

- **`single_value`** - **CONSTANT COLUMN**
  - All 1000 values are "constant"
  - Tests detection of zero-variance columns

- **`text_column`** - **FREE TEXT (NON-NUMERIC)**
  - Random text descriptions
  - Should fail skewness computation
  - Tests error handling for non-numeric continuous columns

#### **5. SMOTE-SPECIFIC TESTING COLUMNS**

- **`numeric_feature_1`** - Normal distribution, mean 50, std 15
- **`numeric_feature_2`** - Normal distribution, mean 100, std 25
- **`numeric_feature_3`** - Uniform distribution, range 0-100

These numeric features are needed because SMOTE requires all non-target features to be numeric. Include these to test SMOTE correction properly.

---

### **Additional Requirements:**

1. **CSV Format:** Generate as a valid CSV file with headers
2. **No Index Column:** Don't include a separate index/row number column (except unique_id)
3. **Realistic Values:** Use realistic names, values, and ranges
4. **Reproducible:** Use a fixed random seed if possible
5. **Validation:** After generation, verify:
   - Skewness values match requirements (use scipy.stats.skew)
   - Imbalance ratios are correct (minority/majority)
   - Missing values are in correct percentages

---

### **Expected Skewness Ranges Summary:**
- Symmetric: -0.5 to 0.5
- Slightly skewed: 0.5 to 1 (right) or -0.5 to -1 (left)
- Moderately skewed: 1 to 2 (right) or -1 to -2 (left)
- Highly skewed: 2 to 3 (right) or -2 to -3 (left)
- Severely/Extremely skewed: > 3 (right) or < -3 (left)

### **Expected Imbalance Ratio Ranges:**
- Severe: ratio < 0.2 (minority class < 20% of majority)
- Moderate: 0.2 <= ratio < 0.5 (20-50%)
- Low: ratio >= 0.5 (50%+)

---

### **Output Format:**

Provide Python code using pandas and numpy that generates this exact dataset and saves it as `comprehensive_test_dataset.csv`. Include:
1. All import statements
2. Seed for reproducibility (random_state=42)
3. Code to generate each column with exact specifications
4. Validation code to print skewness and imbalance ratios
5. Save to CSV command

Make sure the code actually runs and produces the dataset meeting ALL specifications above.

## **PROMPT END**

---

## **Usage Instructions:**

1. Copy the entire prompt above (between "PROMPT START" and "PROMPT END")
2. Paste it into ChatGPT
3. ChatGPT will generate Python code
4. Run the Python code to generate `comprehensive_test_dataset.csv`
5. Place the CSV file in your project root or `backend/` folder
6. Test all features of BiasXplorer-Mini with this dataset

---

## **What This Dataset Tests:**

### **Bias Detection:**
✅ Severe imbalance (< 0.2 ratio)  
✅ Moderate imbalance (0.2-0.5 ratio)  
✅ Low imbalance (>= 0.5 ratio)  
✅ Perfectly balanced (1.0 ratio)  
✅ Binary classes (for SMOTE)  
✅ Multi-class scenarios  
✅ Missing values in categorical  

### **Skewness Detection:**
✅ Highly right-skewed (> 3)  
✅ Moderately right-skewed (1-2)  
✅ Slightly right-skewed (0.5-1)  
✅ Symmetric (-0.5 to 0.5)  
✅ Slightly left-skewed (-0.5 to -1)  
✅ Moderately left-skewed (-1 to -2)  
✅ Highly left-skewed (< -2)  
✅ Extreme skewness (> 5)  

### **Correction Methods:**
✅ Oversample (all categorical)  
✅ Undersample (all categorical)  
✅ SMOTE (numeric features required)  
✅ Reweight (class weights)  
✅ Square root transform (slight positive skew)  
✅ Log transform (moderate positive skew)  
✅ Square power (slight negative skew)  
✅ Cube power (moderate negative skew)  
✅ Yeo-Johnson (severe skew)  
✅ Quantile transformer (extreme skew)  

### **Edge Cases & Error Handling:**
✅ Identifier columns (high cardinality)  
✅ Missing values (NULLs/NaN)  
✅ Empty columns (all NULLs)  
✅ Constant columns (zero variance)  
✅ Mixed data types  
✅ Non-numeric text in continuous  
✅ High cardinality categorical  
✅ Single row/insufficient data  

### **File Format:**
✅ CSV format  
✅ Excel formats (test with .xls/.xlsx)  
✅ Various column types  

---

**This comprehensive dataset ensures your BiasXplorer-Mini project is thoroughly tested across all implemented features and edge cases!**
