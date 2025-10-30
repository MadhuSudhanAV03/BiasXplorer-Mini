def classify_column(series,
                    cat_unique_thresh,
                    cat_fraction_thresh,
                    id_fraction_thresh):
    """
    Classify a pandas Series based on thresholds into one of:
    - 'categorical'
    - 'high-cardinality categorical'
    - 'continuous'
    - 'identifier / name-like'
    - 'identifier / code-like'

    Parameters
    ----------
    series : pandas.Series
        Column to classify.
    cat_unique_thresh : int
        Absolute unique count threshold for categorical.
    cat_fraction_thresh : float
        Fraction of total rows below which numeric becomes categorical.
    id_fraction_thresh : float
        Fraction of unique values above which a column is considered identifier-like.

    Returns
    -------
    str
        Classification label.
    """

    total_count = len(series)
    if total_count == 0:
        return 'other'

    dtype = series.dtype
    unique_count = series.nunique(dropna=True)
    unique_fraction = unique_count / total_count

    # Handle strings and explicit category dtype
    if dtype == 'object' or str(dtype) == 'category':
        if unique_fraction >= id_fraction_thresh:
            return 'identifier / name-like'
        elif unique_count <= cat_unique_thresh or unique_fraction < cat_fraction_thresh:
            return 'categorical'
        else:
            return 'high-cardinality categorical'

    # Handle numeric
    if dtype in ['int64', 'float64']:
        if unique_fraction >= id_fraction_thresh:
            return 'identifier / code-like'
        elif unique_count <= cat_unique_thresh or unique_fraction < cat_fraction_thresh:
            return 'categorical'
        else:
            return 'continuous'

    # Any other dtype
    return 'other'
