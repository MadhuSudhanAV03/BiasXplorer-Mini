"""Categorical bias correction methods."""
from typing import Union, List, Optional
import pandas as pd
from imblearn.under_sampling import RandomUnderSampler
from imblearn.over_sampling import RandomOverSampler, SMOTE, SMOTENC
from sklearn.utils.class_weight import compute_class_weight


class CategoricalTransformer:
    """Handles categorical bias correction transformations."""

    @staticmethod
    def oversample(df: pd.DataFrame, target_col: str, sampling_strategy: Union[str, float, int, dict] = 'auto', random_state: int = 42) -> pd.DataFrame:
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
    def undersample(df: pd.DataFrame, target_col: str, sampling_strategy: Union[str, float, int, dict] = 'auto', random_state: int = 42) -> pd.DataFrame:
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
    def smote(df: pd.DataFrame, target_col: str, sampling_strategy: Union[str, float, int, dict] = 'auto', random_state: int = 42, categorical_columns: Optional[List[str]] = None) -> pd.DataFrame:
        """
        Apply SMOTE or SMOTE-NC oversampling to balance classes.
        Uses SMOTE-NC when categorical_columns are provided, otherwise uses standard SMOTE.

        Args:
            df: Input DataFrame
            target_col: Name of target column
            sampling_strategy: Sampling strategy ('auto', float, int, or dict)
            random_state: Random seed
            categorical_columns: List of categorical column names (excluding target). If provided, uses SMOTE-NC.

        Returns:
            Resampled DataFrame with synthetic samples

        Raises:
            ValueError: If non-numeric features are present (when using standard SMOTE)
        """
        df_reset = df.reset_index(drop=True)
        X = df_reset.drop(columns=[target_col])
        y = df_reset[target_col].astype(str).reset_index(drop=True)

        # Validate sampling_strategy for multi-class
        nunique = y.nunique()
        if isinstance(sampling_strategy, (int, float)) and not isinstance(sampling_strategy, bool):
            if nunique > 2:
                # Multi-class: float not allowed, use 'auto' instead
                sampling_strategy = 'auto'

        # If categorical columns are provided, use SMOTE-NC
        if categorical_columns:
            # Calculate indices of categorical features
            categorical_features = [
                X.columns.get_loc(c) for c in categorical_columns
                if c in X.columns
            ]

            if not categorical_features:
                raise ValueError(
                    "None of the specified categorical columns found in the dataset"
                )

            # For SMOTE-NC, convert categorical columns to numeric codes if they're not already numeric
            X_processed = X.copy()
            for col in categorical_columns:
                if col in X_processed.columns:
                    if X_processed[col].dtype == 'object':
                        X_processed[col] = pd.Categorical(
                            X_processed[col]).codes

            # Fill NaN values for numerical columns
            numeric_cols = X_processed.select_dtypes(
                include=['number']).columns
            for col in numeric_cols:
                if X_processed[col].isna().any():
                    X_processed[col] = X_processed[col].fillna(
                        X_processed[col].mean())

            # Apply SMOTE-NC
            smote_nc = SMOTENC(
                categorical_features=categorical_features,
                sampling_strategy=sampling_strategy,
                random_state=random_state
            )  # type: ignore[arg-type]
            X_res_num, y_res = smote_nc.fit_resample(
                X_processed, y)  # type: ignore[misc]

        else:
            # Standard SMOTE - requires all numeric
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
        df_res = pd.DataFrame(X_res_num, columns=X.columns)
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
