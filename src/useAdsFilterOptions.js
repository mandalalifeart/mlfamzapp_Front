import { useEffect, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://us-central1-mlfamzapp.cloudfunctions.net";

// Every Ads page's Country/Portfolio dropdowns used to derive their option
// lists from that page's own (already country/portfolio-filtered) data
// array - so once a marketplace was selected, the Country dropdown only
// ever showed that one value back (nothing else to pick to get out of it),
// and the Portfolio dropdown showed every portfolio in the account
// regardless of whether it had any campaign in the selected marketplace.
// Found live 2026-09-06 on /ads-campaigns (Country dropdown stuck on "NL").
//
// This hook fetches the full ENABLED campaign roster once, unfiltered by
// country/portfolio/date (GetAdsCampaignStats seeds every ENABLED campaign
// regardless of activity, so a single-day range is enough - the campaign
// list itself doesn't depend on which date range a page's own data table is
// showing), and derives from it:
//   - countryOptions: every marketplace with an ENABLED campaign, always
//     the same list no matter what's currently selected anywhere.
//   - portfolioOptionsFor(countryCode): only the portfolios that actually
//     have a campaign in that marketplace (all portfolios when no country
//     is selected).
// Each page keeps its own real data fetch (server-filtered by country for
// the heavier keyword/search-term/product-level pages) - only the dropdown
// option lists come from here.
export function useAdsFilterOptions() {
  const [campaigns, setCampaigns] = useState([]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    fetch(`${API_BASE}/GetAdsCampaignStats?start_date=${today}&end_date=${today}`)
      .then((r) => r.json())
      .then((data) => setCampaigns(data.campaigns || []))
      .catch(() => {});
  }, []);

  const countryOptions = [...new Set(campaigns.map((c) => c.countryCode).filter(Boolean))].sort();

  function portfolioOptionsFor(countryCode) {
    const scoped = countryCode ? campaigns.filter((c) => c.countryCode === countryCode) : campaigns;
    return [...new Set(scoped.map((c) => c.portfolioName).filter(Boolean))].sort();
  }

  // Lets a Campaign dropdown be usable before any data has been run/loaded
  // yet (e.g. Bid Optimizer's pre-run filters) instead of only being
  // populated from a page's own already-loaded results.
  function campaignOptionsFor(countryCode, portfolioName) {
    const scoped = campaigns.filter(
      (c) => (!countryCode || c.countryCode === countryCode) && (!portfolioName || c.portfolioName === portfolioName)
    );
    return [...new Map(scoped.map((c) => [c.campaignId, c.campaignName])).entries()].sort(
      (a, b) => (a[1] || "").localeCompare(b[1] || "")
    );
  }

  return { countryOptions, portfolioOptionsFor, campaignOptionsFor };
}
