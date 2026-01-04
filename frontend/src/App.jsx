import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import Home from "./pages/Home";
import Upload from "./pages/Upload";
import ReportPage from "./pages/ReportPage";
import Dashboard from "./pages/Dashboard";

const router = createBrowserRouter([
  {
    children: [
      { path: "/", element: <Home /> },
      {
        path: "/upload",
        element: <Upload />,
      },
      {
        path: "/dashboard",
        element: <Dashboard />,
      },
      {
        path: "/report",
        element: <ReportPage />,
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
