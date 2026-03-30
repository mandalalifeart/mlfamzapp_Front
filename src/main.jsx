import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import ResponsePage from "./ResponsePage";
import ReportViewPage from "./ReportViewPage";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/response" element={<ResponsePage />} />
        <Route path="/report-view" element={<ReportViewPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);