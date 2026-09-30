const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://us-central1-mlfamzapp.cloudfunctions.net";

// Narrowly-scoped key, only gates ApplyBidChange (one real Amazon bid write
// per call) - deliberately not the shared ADMIN_KEY, same reasoning as
// OPS_DASHBOARD_KEY elsewhere in this app.
const BID_APPLY_KEY = import.meta.env.VITE_BID_APPLY_KEY || "";

// `row` is either a bid-optimizer proposal or a keywords-page row merged
// with its matching recommendation - both shapes carry these same fields.
export async function applyBidChange(row) {
  const params = new URLSearchParams({
    key: BID_APPLY_KEY,
    confirm: "yes",
    target_id: row.targetId,
    campaign_id: row.campaignId,
    ad_group_id: row.adGroupId || "",
    campaign_name: row.campaignName || "",
    target_text: row.targetText || "",
    ad_product: row.adProduct || "",
    match_type: row.matchType || "",
    target_type: row.targetType || "",
    profile_id: row.profileId || "",
    country_code: row.countryCode || "",
    old_bid: String(row.currentBid),
    new_bid: String(row.proposedBid),
    reason: row.reason || "",
  });
  const response = await fetch(`${API_BASE}/ApplyBidChange?${params.toString()}`);
  const data = await response.json();
  if (!response.ok || data.applied === false) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }
  return data;
}

// Pauses the keyword/target on Amazon instead of changing its bid - `row`
// is the same shape as applyBidChange's, current bid is resubmitted
// unchanged alongside the state change.
export async function disableBidTarget(row) {
  const params = new URLSearchParams({
    key: BID_APPLY_KEY,
    confirm: "yes",
    target_id: row.targetId,
    campaign_id: row.campaignId,
    ad_group_id: row.adGroupId || "",
    campaign_name: row.campaignName || "",
    target_text: row.targetText || "",
    ad_product: row.adProduct || "",
    match_type: row.matchType || "",
    target_type: row.targetType || "",
    profile_id: row.profileId || "",
    country_code: row.countryCode || "",
    current_bid: String(row.currentBid),
  });
  const response = await fetch(`${API_BASE}/DisableBidTarget?${params.toString()}`);
  const data = await response.json();
  if (!response.ok || data.disabled === false) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }
  return data;
}

// Pauses one advertised product (a SKU's product ad within one campaign/ad
// group) - `row` is a row from GetAdsAdvertisedProductStats.
export async function pauseProductAd(row) {
  const params = new URLSearchParams({
    key: BID_APPLY_KEY,
    confirm: "yes",
    campaign_id: row.campaignId,
    ad_group_id: row.adGroupId || "",
    campaign_name: row.campaignName || "",
    asin: row.asin,
    sku: row.sku || "",
    ad_product: row.adProduct || "",
    profile_id: row.profileId || "",
    country_code: row.countryCode || "",
  });
  const response = await fetch(`${API_BASE}/PauseProductAd?${params.toString()}`);
  const data = await response.json();
  if (!response.ok || data.paused === false) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }
  return data;
}

// Re-enables one advertised product (same row shape as pauseProductAd).
export async function enableProductAd(row) {
  const params = new URLSearchParams({
    key: BID_APPLY_KEY,
    confirm: "yes",
    campaign_id: row.campaignId,
    ad_group_id: row.adGroupId || "",
    campaign_name: row.campaignName || "",
    asin: row.asin,
    sku: row.sku || "",
    ad_product: row.adProduct || "",
    profile_id: row.profileId || "",
    country_code: row.countryCode || "",
  });
  const response = await fetch(`${API_BASE}/EnableProductAd?${params.toString()}`);
  const data = await response.json();
  if (!response.ok || data.enabled === false) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }
  return data;
}
