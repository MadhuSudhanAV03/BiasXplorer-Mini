# Appendices

## Appendix A: Data Sheet of Components

### Component 1: Flask (Backend Framework)

**i. Framework Type:** Web Application Framework for Python.

**ii. Version:** Latest stable version (compatible with Python 3.8+).

**iii. Features:**
- Lightweight and modular design
- RESTful API development with Flask-Smorest
- Built-in development server and debugger
- Extensive middleware support for authentication and validation
- CORS (Cross-Origin Resource Sharing) support via Flask-CORS

**iv. Relevance to Project:**
- Provides the core backend API layer for BiasXplorer-Mini
- Handles requests for dataset upload, preprocessing, bias detection, and correction
- Implements RESTful endpoints for file management and data analysis operations
- Supports Swagger UI for API documentation and testing
- Manages session state and data processing workflows

---

### Component 2: React.js (Frontend Library)

**i. Library Type:** JavaScript Library for UI Development.

**ii. Version:** 19.1.1.

**iii. Features:**
- Component-based architecture for reusable UI elements
- Virtual DOM for efficient rendering and performance
- State management using hooks and Redux Toolkit
- React Router for client-side routing and navigation
- Modern JSX syntax for declarative UI development

**iv. Relevance to Project:**
- Develops the user interface for data scientists and analysts
- Provides interactive dashboards for:
  - Dataset upload and preview
  - Bias detection visualization
  - Skewness analysis and correction
  - Real-time data preprocessing
  - Report generation and download
- Enables dynamic interactions such as column selection and parameter adjustment
- Implements responsive design for various screen sizes

---

### Component 3: Pandas & NumPy (Data Processing Libraries)

**i. Library Type:** Python libraries for data manipulation and numerical computing.

**ii. Versions:**
- Pandas: Latest stable version
- NumPy: Latest stable version
- SciPy: Latest stable version

**iii. Features:**
- DataFrame operations for structured data manipulation
- Statistical analysis and aggregation functions
- Missing value handling and data cleaning
- Efficient array operations and mathematical computations
- Time series and categorical data support

**iv. Relevance to Project:**
- Core data processing engine for BiasXplorer-Mini
- Loads and processes CSV/Excel files (via openpyxl and xlrd)
- Performs statistical analysis for bias and skewness detection
- Calculates class distributions and imbalance ratios
- Executes data transformations and normalization
- Handles categorical and continuous data preprocessing

---

### Component 4: Scikit-learn & Imbalanced-learn (Machine Learning Libraries)

**i. Library Type:** Python libraries for machine learning and data balancing.

**ii. Versions:**
- Scikit-learn: Latest stable version
- Imbalanced-learn: Latest stable version

**iii. Features:**
- SMOTE (Synthetic Minority Over-sampling Technique) for categorical and continuous data
- StandardScaler and other preprocessing transformers
- Statistical validation and cross-validation tools
- Model evaluation metrics for imbalanced datasets
- Integration with NumPy and Pandas

**iv. Relevance to Project:**
- Implements bias correction algorithms for imbalanced datasets
- Applies SMOTE and SMOTE-NC for class balancing
- Performs feature scaling and normalization
- Detects and corrects data distribution issues
- Provides statistical measures for data quality assessment
- Supports automated bias mitigation workflows

---

### Component 5: Plotly.js (Data Visualization Library)

**i. Library Type:** Interactive Graphing Library for JavaScript and Python.

**ii. Version:**
- Frontend: plotly.js-dist-min 2.35.2
- Backend: Plotly (latest Python version)

**iii. Features:**
- Interactive charts and graphs (bar charts, histograms, scatter plots)
- Responsive and customizable visualizations
- Export functionality (PNG, SVG, PDF)
- Real-time data updates and animations
- Statistical plotting capabilities

**iv. Relevance to Project:**
- Visualizes bias detection results with interactive charts
- Displays class distribution and imbalance ratios
- Generates skewness plots and statistical distributions
- Creates comparative before/after correction visualizations
- Provides interactive exploration of dataset characteristics
- Embedded in both frontend (React) and backend (Python) for comprehensive reporting

---

### Component 6: Vite (Frontend Build Tool)

**i. Tool Type:** Next-generation frontend build tool and development server.

**ii. Version:** 7.1.7.

**iii. Features:**
- Lightning-fast Hot Module Replacement (HMR)
- Optimized production builds with code splitting
- Native ES modules support
- Plugin ecosystem for React and other frameworks
- Development server with instant updates

**iv. Relevance to Project:**
- Powers the frontend development environment
- Provides fast refresh during development for improved productivity
- Optimizes React components for production deployment
- Handles asset bundling and minification
- Enables efficient development workflow with instant feedback

---

### Component 7: TailwindCSS (CSS Framework)

**i. Framework Type:** Utility-first CSS framework.

**ii. Version:** 4.1.13.

**iii. Features:**
- Utility-first approach for rapid UI development
- Responsive design utilities for all screen sizes
- Customizable design system
- JIT (Just-In-Time) compilation for optimal performance
- Modern CSS features and animations

**iv. Relevance to Project:**
- Provides consistent and professional styling across the application
- Implements responsive layouts for dashboard, upload, and report pages
- Enables rapid prototyping and UI iterations
- Ensures accessibility and user-friendly design
- Creates visually appealing data presentation interfaces

---

### Component 8: ReportLab (PDF Generation Library)

**i. Library Type:** Python library for PDF document generation.

**ii. Version:** Latest stable version.

**iii. Features:**
- Programmatic PDF creation with text, tables, and charts
- Support for custom fonts, colors, and layouts
- Integration with Plotly for chart embedding
- Multi-page document generation
- Professional report formatting

**iv. Relevance to Project:**
- Generates comprehensive bias analysis reports in PDF format
- Includes statistical summaries and visualizations
- Creates downloadable documentation of:
  - Dataset characteristics
  - Bias detection results
  - Correction recommendations
  - Before/after comparison metrics
- Provides exportable analysis results for stakeholders and documentation

---

### Component 9: Redux Toolkit (State Management)

**i. Library Type:** State management library for React applications.

**ii. Version:** 2.9.0 (via @reduxjs/toolkit).

**iii. Features:**
- Centralized application state management
- Simplified Redux configuration
- Built-in immutable updates with Immer
- DevTools integration for debugging
- Async logic handling with createAsyncThunk

**iv. Relevance to Project:**
- Manages global application state across components
- Stores uploaded dataset information and analysis results
- Maintains user selections (categorical columns, target features)
- Coordinates data flow between upload, analysis, and visualization components
- Enables persistent state across navigation and page refreshes

---

### Component 10: Axios (HTTP Client)

**i. Library Type:** Promise-based HTTP client for JavaScript.

**ii. Version:** 1.12.2.

**iii. Features:**
- Promise-based API for async/await support
- Request and response interceptors
- Automatic JSON transformation
- Error handling and timeout configuration
- Support for file uploads with multipart/form-data

**iv. Relevance to Project:**
- Handles all HTTP communication between frontend and backend
- Manages file upload requests for datasets
- Sends preprocessing and analysis requests to Flask API
- Retrieves analysis results and visualizations
- Implements error handling and loading states
- Downloads generated reports and corrected datasets

---

## System Integration

All components work together seamlessly to provide a comprehensive bias detection and correction platform:

1. **Frontend Stack** (React + Vite + TailwindCSS) provides an intuitive user interface
2. **Backend Stack** (Flask + Pandas + Scikit-learn) processes data and performs analysis
3. **Communication Layer** (Axios) bridges frontend and backend via RESTful APIs
4. **State Management** (Redux Toolkit) maintains application consistency
5. **Visualization Layer** (Plotly) presents results interactively
6. **Reporting Engine** (ReportLab) generates professional documentation

This architecture ensures scalability, maintainability, and excellent user experience for bias analysis workflows.
