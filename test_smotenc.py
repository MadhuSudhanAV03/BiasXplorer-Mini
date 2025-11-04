"""Test SMOTE-NC implementation with mixed categorical/numerical data."""
from utils.transformers.categorical import CategoricalTransformer
import pandas as pd
import sys
import os

# Add backend to path
backend_path = os.path.join(os.path.dirname(__file__), 'backend')
sys.path.insert(0, backend_path)


# Create a sample dataset with mixed types
data = {
    'age': [25, 30, 35, 40, 45, 50, 55, 60],
    'income': [30000, 40000, 50000, 60000, 70000, 80000, 90000, 100000],
    'gender': ['M', 'F', 'M', 'F', 'M', 'F', 'M', 'F'],
    'city': ['NYC', 'LA', 'NYC', 'LA', 'NYC', 'LA', 'NYC', 'LA'],
    'target': ['A', 'A', 'A', 'A', 'B', 'B', 'B', 'B']
}

df = pd.DataFrame(data)

print("Original dataset:")
print(df)
print("\nOriginal shape:", df.shape)
print("\nTarget distribution:")
print(df['target'].value_counts())

# Test 1: Standard SMOTE (should fail with categorical columns)
print("\n" + "="*60)
print("Test 1: Standard SMOTE (no categorical_columns parameter)")
print("="*60)
try:
    result = CategoricalTransformer.smote(df, 'target')
    print("Unexpected: Standard SMOTE succeeded!")
    print(result.shape)
except ValueError as e:
    print(f"Expected error: {e}")

# Test 2: SMOTE-NC with categorical columns specified
print("\n" + "="*60)
print("Test 2: SMOTE-NC (with categorical_columns=['gender', 'city'])")
print("="*60)
try:
    result = CategoricalTransformer.smote(
        df,
        'target',
        categorical_columns=['gender', 'city']
    )
    print("✓ SMOTE-NC succeeded!")
    print("\nResult shape:", result.shape)
    print("\nResult target distribution:")
    print(result['target'].value_counts())
    print("\nFirst 10 rows:")
    print(result.head(10))
    print("\nData types:")
    print(result.dtypes)
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()

# Test 3: SMOTE-NC with all numeric data (edge case)
print("\n" + "="*60)
print("Test 3: SMOTE with all numeric data (no categorical_columns)")
print("="*60)
df_numeric = df[['age', 'income', 'target']].copy()
try:
    result = CategoricalTransformer.smote(df_numeric, 'target')
    print("✓ Standard SMOTE succeeded with numeric data!")
    print("Result shape:", result.shape)
except Exception as e:
    print(f"✗ Error: {e}")

print("\n" + "="*60)
print("All tests completed!")
print("="*60)
