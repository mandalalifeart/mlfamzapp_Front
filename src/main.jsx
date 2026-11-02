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
import AdsAdvertisedProductsPage from "./AdsAdvertisedProductsPage";
import EtsyPage from "./EtsyPage";
import OpsPage from "./OpsPage";
import AdsBidOptimizerPage from "./AdsBidOptimizerPage";
import BidChangePerformancePage from "./BidChangePerformancePage";
import PaymentsPage from "./PaymentsPage";
import WisePage from "./WisePage";
import VatPage from "./VatPage";
import ReturnsPage from "./ReturnsPage";
import AsinAnalyticsPage from "./AsinAnalyticsPage";
import ArcherPage from "./ArcherPage";
import ProductResearchPage from "./ProductResearchPage";
import FbaShipmentsPage from "./FbaShipmentsPage";
import FbaFeesPage from "./FbaFeesPage";
import ImportShipmentsPage from "./ImportShipmentsPage";
import AdsReviewsPage from "./AdsReviewsPage";
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
        <Route path="/ads-advertised-products" element={<AdsAdvertisedProductsPage />} />
        <Route path="/etsy" element={<EtsyPage />} />
        <Route path="/ops" element={<OpsPage />} />
        <Route path="/ads-bid-optimizer" element={<AdsBidOptimizerPage />} />
        <Route path="/bid-change-performance" element={<BidChangePerformancePage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/wise" element={<WisePage />} />
        <Route path="/vat" element={<VatPage />} />
        <Route path="/returns" element={<ReturnsPage />} />
        <Route path="/asin-analytics" element={<AsinAnalyticsPage />} />
        <Route path="/archer" element={<ArcherPage />} />
        <Route path="/product-research" element={<ProductResearchPage />} />
        <Route path="/fba-shipments" element={<FbaShipmentsPage />} />
        <Route path="/fba-fees" element={<FbaFeesPage />} />
        <Route path="/shipments" element={<ImportShipmentsPage />} />
        <Route path="/ads-reviews" element={<AdsReviewsPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);