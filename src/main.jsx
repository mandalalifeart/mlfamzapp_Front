import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import ResponsePage from "./ResponsePage";
import ReportViewPage from "./ReportViewPage";
import SalesPage from "./SalesPage";
import UpdatePage from "./UpdatePage";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/response" element={<ResponsePage />} />
        <Route path="/report-view" element={<ReportViewPage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/update" element={<UpdatePage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);