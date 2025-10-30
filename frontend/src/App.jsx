import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import Home from "./pages/Home";
import ReportPage from "./pages/ReportPage";
import Dashboard from "./pages/Dashboard";

const router = createBrowserRouter([
  {
    children: [
      {
        path: "/dashboard",
        element: (
            <Dashboard />
        ),
      },
      {
        path: "/report",
        element: (
            <ReportPage />
        ),
      },
      { path: "/", element: <Home /> }
    ],
  }
  // Public home page with upload
]);


export default function App() {
  return <RouterProvider router={router} />;
}
