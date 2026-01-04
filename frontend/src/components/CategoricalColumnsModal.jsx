import React, { useState, useEffect } from "react";

/**
 * Modal component for selecting categorical columns when using SMOTE-NC
 * @param {boolean} isOpen - Whether the modal is visible
 * @param {function} onClose - Callback to close the modal
 * @param {function} onConfirm - Callback with selected columns array
 * @param {array} allColumns - All column names in the dataset
 * @param {string} targetColumn - The target column (will be excluded from selection)
 */
const CategoricalColumnsModal = ({
  isOpen,
  onClose,
  onConfirm,
  allColumns = [],
  targetColumn,
}) => {
  const [selectedColumns, setSelectedColumns] = useState([]);

  // Show all columns including target column
  // User needs to select ALL categorical columns for SMOTE-NC (including target)
  const availableColumns = allColumns;

  useEffect(() => {
    if (!isOpen) {
      setSelectedColumns([]);
    }
  }, [isOpen]);

  const handleToggle = (column) => {
    setSelectedColumns((prev) => {
      if (prev.includes(column)) {
        return prev.filter((c) => c !== column);
      } else {
        return [...prev, column];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedColumns.length === availableColumns.length) {
      setSelectedColumns([]);
    } else {
      setSelectedColumns([...availableColumns]);
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedColumns);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center"
      style={{ 
        zIndex: 99999, 
        pointerEvents: 'auto',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        backgroundColor: 'rgba(255, 255, 255, 0.3)'
      }}
      onClick={(e) => {
        // Prevent clicks from going through to elements below
        e.stopPropagation();
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
        style={{ zIndex: 100000, position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            Select Categorical Columns for SMOTE-NC
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Select ALL categorical columns in your dataset (including the target
            column). SMOTE-NC needs to know which features are categorical to
            handle them properly.
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          <div className="mb-4">
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              {selectedColumns.length === availableColumns.length
                ? "Deselect All"
                : "Select All"}
            </button>
            <span className="text-sm text-gray-500 ml-2">
              ({selectedColumns.length} of {availableColumns.length} selected)
            </span>
          </div>

          <div className="space-y-2">
            {availableColumns.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No columns available
              </p>
            ) : (
              availableColumns.map((column) => (
                <label
                  key={column}
                  className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(column)}
                    onChange={() => handleToggle(column)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-3 text-sm text-gray-800 font-medium">
                    {column}
                  </span>
                </label>
              ))
            )}
          </div>

          {selectedColumns.length === 0 && availableColumns.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <span className="font-semibold">Note:</span> If no categorical
                columns are selected, standard SMOTE will be used instead of
                SMOTE-NC.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3 bg-gray-50">
          <button
            onClick={onClose}
            type="button"
            className="px-6 py-3 text-sm font-bold text-gray-700 bg-white hover:bg-gray-100 rounded-lg transition-colors border-2 border-gray-300 hover:border-gray-400 shadow-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            type="button"
            className="px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            <span>✓</span>
            <span>Confirm & Apply SMOTE</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoricalColumnsModal;
