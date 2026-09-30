import { useEffect, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://us-central1-mlfamzapp.cloudfunctions.net";

// Shared profile save/load/delete logic for AdsBidOptimizerPage and
// AdsKeywordsPage's Rules panel - both read/write the same
// ads_bid_rule_profiles collection via GetBidRuleProfiles/SaveBidRuleProfile/
// DeleteBidRuleProfile, so this hook is the one place that logic lives.
// country/setCountry and portfolio/setPortfolio are passed in so each page
// can point a loaded profile's country/portfolio at whatever state actually
// drives that page - AdsBidOptimizerPage has its own; AdsKeywordsPage reuses
// its existing top-level Country/Portfolio filters instead of a second copy.
export function useBidRuleProfiles({ rules, setRules, country, setCountry, portfolio, setPortfolio }) {
  const [savedProfiles, setSavedProfiles] = useState({});
  const [selectedProfile, setSelectedProfile] = useState("");
  const [profileNameInput, setProfileNameInput] = useState("");
  const [profileError, setProfileError] = useState("");

  function refreshProfiles() {
    return fetch(`${API_BASE}/GetBidRuleProfiles`)
      .then((r) => r.json())
      .then((data) => {
        const map = Object.fromEntries((data.profiles || []).map((p) => [p.name, p]));
        setSavedProfiles(map);
      })
      .catch(() => {});
  }

  useEffect(() => {
    refreshProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveProfile() {
    const name = profileNameInput.trim();
    if (!name) return;
    setProfileError("");
    try {
      const response = await fetch(`${API_BASE}/SaveBidRuleProfile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, rules, country, portfolio }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data?.error || `HTTP ${response.status}`);
      await refreshProfiles();
      setSelectedProfile(name);
      setProfileNameInput(name);
    } catch (err) {
      setProfileError(err.message || "Failed to save profile");
    }
  }

  function handleLoadProfile(name) {
    setSelectedProfile(name);
    setProfileNameInput(name);
    const profile = savedProfiles[name];
    if (!profile) return;
    setRules(profile.rules);
    if (setCountry) setCountry(profile.country || "");
    if (setPortfolio) setPortfolio(profile.portfolio || "");
  }

  function handleClearProfile() {
    setSelectedProfile("");
    setProfileNameInput("");
  }

  async function handleDeleteProfile() {
    if (!selectedProfile) return;
    setProfileError("");
    try {
      const response = await fetch(`${API_BASE}/DeleteBidRuleProfile?name=${encodeURIComponent(selectedProfile)}`);
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data?.error || `HTTP ${response.status}`);
      await refreshProfiles();
      setSelectedProfile("");
    } catch (err) {
      setProfileError(err.message || "Failed to delete profile");
    }
  }

  return {
    savedProfiles,
    selectedProfile,
    profileNameInput,
    setProfileNameInput,
    profileError,
    handleSaveProfile,
    handleLoadProfile,
    handleClearProfile,
    handleDeleteProfile,
  };
}
