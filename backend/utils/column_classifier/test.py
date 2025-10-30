import pandas as pd
from backend.utils.column_classifier.autoThreshold import auto_thresholds
from backend.utils.column_classifier.classify_column import classify_column

from backend.utils.continuous_data.skew import skewness

import os
def classify():
    base_dir = os.path.dirname(__file__)
    file_path = os.path.join(base_dir, "SampleSuperstore.xls")
    df = pd.read_csv(file_path)
    # Get thresholds automatically
    thr = auto_thresholds(df)

    # Classify each column
    types = {}
    for col in df.columns:
        types[col] = classify_column(df[col],
                                    thr['cat_unique_thresh'],
                                    thr['cat_fraction_thresh'],
                                    thr['id_fraction_thresh'])

    print("Used thresholds:", thr)
    print("Column types:", types)
    continuous = []
    for col, col_type in types.items():
        if col_type == 'continuous':
            continuous.append(col)
    print("Continuous columns:", continuous)
    continuous.remove('Postal Code')
    print(skewness(df, continuous))
if __name__ == "__main__":
    classify()