"""Categorical bias correction methods."""
from typing import Union
import pandas as pd
from imblearn.under_sampling import RandomUnderSampler
from imblearn.over_sampling import RandomOverSampler, SMOTE
from sklearn.utils.class_weight import compute_class_weight


class CategoricalTransformer:
    """Handles categorical bias correction transformations."""

    @staticmethod
    def oversample(df: pd.DataFrame, target_col: str, sampling_strategy: Union[str, float, int] = 'auto', random_state: int = 42) -> pd.DataFrame:
        """
        Apply random oversampling to balance classes.

        Args:
            df: Input DataFrame
            target_col: Name of target column
            sampling_strategy: Sampling strategy ('auto', float, int, or dict)
            random_state: Random seed

        Returns:
            Resampled DataFrame
        """
        df_reset = df.reset_index(drop=True)
        X = df_reset.drop(columns=[target_col])
        y = df_reset[target_col].astype(str).reset_index(drop=True)

        # Add row ID to track original indices
        X_with_id = X.copy()
        X_with_id["__row_id__"] = X_with_id.index

        sampler = RandomOverSampler(
            # type: ignore[arg-type]
            sampling_strategy=sampling_strategy, random_state=random_state)
        X_res, y_res = sampler.fit_resample(X_with_id, y)  # type: ignore[misc]

        # Reconstruct DataFrame using original row indices
        row_ids = X_res["__row_id__"].astype(int).tolist()
        df_res = df_reset.iloc[row_ids].reset_index(drop=True)

        return df_res

    @staticmethod
    def undersample(df: pd.DataFrame, target_col: str, sampling_strategy: Union[str, float, int] = 'auto', random_state: int = 42) -> pd.DataFrame:
        """
        Apply random undersampling to balance classes.

        Args:
            df: Input DataFrame
            target_col: Name of target column
            sampling_strategy: Sampling strategy ('auto', float, int, or dict)
            random_state: Random seed

        Returns:
            Resampled DataFrame
        """
        df_reset = df.reset_index(drop=True)
        X = df_reset.drop(columns=[target_col])
        y = df_reset[target_col].astype(str).reset_index(drop=True)

        # Add row ID to track original indices
        X_with_id = X.copy()
        X_with_id["__row_id__"] = X_with_id.index

        sampler = RandomUnderSampler(
            # type: ignore[arg-type]
            sampling_strategy=sampling_strategy, random_state=random_state)
        X_res, y_res = sampler.fit_resample(X_with_id, y)  # type: ignore[misc]

        # Reconstruct DataFrame using original row indices
        row_ids = X_res["__row_id__"].astype(int).tolist()
        df_res = df_reset.iloc[row_ids].reset_index(drop=True)

        return df_res

    @staticmethod
    def smote(df: pd.DataFrame, target_col: str, sampling_strategy: Union[str, float, int] = 'auto', random_state: int = 42) -> pd.DataFrame:
        """
        Apply SMOTE (Synthetic Minority Over-sampling Technique).
        Requires all non-target features to be numeric.

        Args:
            df: Input DataFrame
            target_col: Name of target column
            sampling_strategy: Sampling strategy ('auto', float, int, or dict)
            random_state: Random seed

        Returns:
            Resampled DataFrame with synthetic samples

        Raises:
            ValueError: If non-numeric features are present
        """
        df_reset = df.reset_index(drop=True)
        X = df_reset.drop(columns=[target_col])
        y = df_reset[target_col].astype(str).reset_index(drop=True)

        # Check for non-numeric columns
        non_numeric_cols = [c for c in X.columns if str(
            X[c].dtype) in ("object", "category", "bool")]
        if non_numeric_cols:
            raise ValueError(
                f"SMOTE requires all non-target features to be numeric. "
                f"Non-numeric columns: {non_numeric_cols}"
            )

        # Convert to numeric and fill NaNs
        X_numeric = X.apply(pd.to_numeric, errors='coerce')
        X_numeric = X_numeric.apply(lambda s: s.fillna(s.mean()), axis=0)

        smote = SMOTE(sampling_strategy=sampling_strategy,
                      random_state=random_state)  # type: ignore[arg-type]
        X_res_num, y_res = smote.fit_resample(
            X_numeric, y)  # type: ignore[misc]

        # Reconstruct DataFrame
        df_res = pd.DataFrame(X_res_num, columns=X_numeric.columns)
        df_res[target_col] = y_res.values

        return df_res

    @staticmethod
    def compute_class_weights(y: pd.Series) -> dict:
        """
        Compute balanced class weights.

        Args:
            y: Target series

        Returns:
            Dictionary mapping class labels to weights
        """
        y_str = y.astype(str)
        classes = sorted(y_str.unique().tolist())
        weights = compute_class_weight(
            class_weight="balanced", classes=classes, y=y_str)
        return {str(c): float(w) for c, w in zip(classes, weights)}
