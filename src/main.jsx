import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import ResponsePage from "./ResponsePage";
import ReportViewPage from "./ReportViewPage";
import SalesPage from "./SalesPage";
import UpdatePage from "./UpdatePage";
import BatchUpdatePage from "./BatchUpdatePage";
import NextOrderPage from "./NextOrderPage";
import ProductDetailPage from "./ProductDetailPage";
import AdsConnectionsPage from "./AdsConnectionsPage";
import AdsCampaignsPage from "./AdsCampaignsPage";
import AdsKeywordsPage from "./AdsKeywordsPage";
import AdsSearchTermsPage from "./AdsSearchTermsPage";
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
        <Route path="/batch-update" element={<BatchUpdatePage />} />
        <Route path="/next-order" element={<NextOrderPage />} />
        <Route path="/product" element={<ProductDetailPage />} />
        <Route path="/ads" element={<AdsConnectionsPage />} />
        <Route path="/ads-campaigns" element={<AdsCampaignsPage />} />
        <Route path="/ads-keywords" element={<AdsKeywordsPage />} />
        <Route path="/ads-search-terms" element={<AdsSearchTermsPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);