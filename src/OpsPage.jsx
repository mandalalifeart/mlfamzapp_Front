import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { buttonStyle } from "./buttonStyle";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://us-central1-mlfamzapp.cloudfunctions.net";
const OPS_KEY = import.meta.env.VITE_OPS_DASHBOARD_KEY || "";

function tabStyle(active) {
  return {
    padding: "10px 20px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    borderBottom: active ? "3px solid #1976d2" : "3px solid transparent",
    background: "transparent",
    color: active ? "#1976d2" : "#555",
  };
}

function tableCellStyle(extra = {}) {
  return { border: "1px solid #ccc", padding: "6px 10px", textAlign: "left", fontSize: "13px", ...extra };
}

function Checkbox({ checked, onChange, disabled }) {
  return (
    <input
      type="checkbox"
      checked={!!checked}
      disabled={disabled}
      onChange={onChange}
      style={{ width: "16px", height: "16px", cursor: disabled ? "not-allowed" : "pointer" }}
    />
  );
}

function ScheduledJobsTab() {
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);

  async function load() {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/GetScheduledJobs`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setJobs(data.items || []);
    } catch (err) {
      setError(err.message || "Failed to load scheduled jobs");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleField(job, field) {
    const newValue = !job[field];
    setSavingId(job.id);
    // optimistic update
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, [field]: newValue } : j)));
    try {
      const res = await fetch(`${API_BASE}/UpdateScheduledJob?key=${encodeURIComponent(OPS_KEY)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: job.id, [field]: newValue }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
    } catch (err) {
      setError(err.message || "Failed to save change");
      // revert on failure
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, [field]: !newValue } : j)));
    } finally {
      setSavingId(null);
    }
  }

  if (error) return <div className="error" style={{ margin: "16px" }}>{error}</div>;
  if (!jobs) return <p style={{ padding: "16px" }}>Loading...</p>;

  const byApp = jobs.reduce((acc, j) => {
    acc[j.app] = acc[j.app] || [];
    acc[j.app].push(j);
    return acc;
  }, {});

  return (
    <div style={{ padding: "16px" }}>
      <p style={{ fontSize: "13px", color: "#555", marginBottom: "16px" }}>
        Every scheduled job across all apps, and where its notifications go. Telegram (@baba_social_bot) is the
        default channel for routine runs; email is reserved for alerts/errors only. Toggle a checkbox to change it -
        saves immediately.
      </p>
      {Object.keys(byApp)
        .sort()
        .map((app) => (
          <div key={app} style={{ marginBottom: "26px" }}>
            <h3 style={{ marginBottom: "8px", textTransform: "capitalize" }}>{app}</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Job</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Schedule</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Target</th>
                    <th style={tableCellStyle({ background: "#f4f4f4" })}>Description</th>
                    <th style={tableCellStyle({ background: "#f4f4f4", textAlign: "center" })}>Telegram</th>
                    <th style={tableCellStyle({ background: "#f4f4f4", textAlign: "center" })}>Email on error</th>
                    <th style={tableCellStyle({ background: "#f4f4f4", textAlign: "center" })}>Email always</th>
                  </tr>
                </thead>
                <tbody>
                  {byApp[app].map((job) => (
                    <tr key={job.id}>
                      <td style={tableCellStyle({ fontWeight: 600 })}>{job.job_name}</td>
                      <td style={tableCellStyle()}>
                        {job.schedule} <span style={{ color: "#888" }}>({job.timezone})</span>
                      </td>
                      <td style={tableCellStyle()}>{job.target}</td>
                      <td style={tableCellStyle()}>{job.description}</td>
                      <td style={tableCellStyle({ textAlign: "center" })}>
                        <Checkbox
                          checked={job.notify_telegram}
                          disabled={savingId === job.id}
                          onChange={() => toggleField(job, "notify_telegram")}
                        />
                      </td>
                      <td style={tableCellStyle({ textAlign: "center" })}>
                        <Checkbox
                          checked={job.notify_email_on_error}
                          disabled={savingId === job.id}
                          onChange={() => toggleField(job, "notify_email_on_error")}
                        />
                      </td>
                      <td style={tableCellStyle({ textAlign: "center" })}>
                        <Checkbox
                          checked={job.notify_email_always}
                          disabled={savingId === job.id}
                          onChange={() => toggleField(job, "notify_email_always")}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      <p style={{ fontSize: "12px", color: "#888" }}>
        Note: toggling a job's checkboxes here only takes effect for jobs whose Cloud Function has been wired up to
        read this config (currently: amazon-relist-queue-processor, amazon-weekly-listings-audit,
        etsy-daily-mcf-fulfillment, etsy-daily-tracking-update, etsy-daily-experiment-monitor). Other jobs listed here
        are shown for visibility but don't yet consult this table before sending notifications.
      </p>
    </div>
  );
}

function EventLogTab() {
  const [runs, setRuns] = useState(null);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  async function load() {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/GetJobRunsLog?perPage=200`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRuns(data.items || []);
    } catch (err) {
      setError(err.message || "Failed to load event log");
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (error) return <div className="error" style={{ margin: "16px" }}>{error}</div>;
  if (!runs) return <p style={{ padding: "16px" }}>Loading...</p>;

  return (
    <div style={{ padding: "16px" }}>
      <p style={{ fontSize: "13px", color: "#555", marginBottom: "16px" }}>
        Every run of a job wired up to log here (see note on the Scheduled Jobs tab), newest first. Click a row to
        see its full summary text.
      </p>
      {runs.length === 0 ? (
        <p>No runs logged yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={tableCellStyle({ background: "#f4f4f4" })}>Ran At</th>
                <th style={tableCellStyle({ background: "#f4f4f4" })}>Job</th>
                <th style={tableCellStyle({ background: "#f4f4f4" })}>App</th>
                <th style={tableCellStyle({ background: "#f4f4f4" })}>Status</th>
                <th style={tableCellStyle({ background: "#f4f4f4", textAlign: "center" })}>Telegram</th>
                <th style={tableCellStyle({ background: "#f4f4f4", textAlign: "center" })}>Email</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <>
                  <tr
                    key={run.id}
                    onClick={() => setExpandedId(expandedId === run.id ? null : run.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={tableCellStyle()}>{new Date(run.ran_at).toLocaleString()}</td>
                    <td style={tableCellStyle({ fontWeight: 600 })}>{run.job_name}</td>
                    <td style={tableCellStyle()}>{run.app}</td>
                    <td
                      style={tableCellStyle({
                        color: run.status === "error" ? "#b00020" : "#1b7a1b",
                        fontWeight: 600,
                      })}
                    >
                      {run.status}
                    </td>
                    <td style={tableCellStyle({ textAlign: "center" })}>{run.notified_telegram ? "✓" : ""}</td>
                    <td style={tableCellStyle({ textAlign: "center" })}>{run.notified_email ? "✓" : ""}</td>
                  </tr>
                  {expandedId === run.id && (
                    <tr key={`${run.id}-detail`}>
                      <td colSpan={6} style={tableCellStyle({ background: "#fafafa", whiteSpace: "pre-wrap" })}>
                        {run.summary}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PocketBaseTablesTab() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/GetPocketBaseCollections`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setItems(data.items || []);
      })
      .catch((err) => setError(err.message || "Failed to load PocketBase tables"));
  }, []);

  if (error) return <div className="error" style={{ margin: "16px" }}>{error}</div>;
  if (!items) return <p style={{ padding: "16px" }}>Loading...</p>;

  return (
    <div style={{ padding: "16px" }}>
      <p style={{ fontSize: "13px", color: "#555", marginBottom: "16px" }}>
        Every PocketBase collection this app uses. Opens the PocketBase admin UI directly (requires the admin login).
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={tableCellStyle({ background: "#f4f4f4" })}>Table</th>
              <th style={tableCellStyle({ background: "#f4f4f4" })}>Type</th>
              <th style={tableCellStyle({ background: "#f4f4f4" })}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.name}>
                <td style={tableCellStyle({ fontWeight: 600 })}>{item.name}</td>
                <td style={tableCellStyle()}>{item.type}</td>
                <td style={tableCellStyle()}>
                  <a href={item.adminUrl} target="_blank" rel="noreferrer">
                    Open &rarr;
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function OpsPage() {
  const [tab, setTab] = useState("jobs");

  return (
    <div style={{ padding: "20px 0", fontFamily: "Arial, sans-serif", minHeight: "100vh", background: "#fafafa" }}>
      <h2 style={{ textAlign: "center", marginBottom: "10px" }}>Ops Dashboard</h2>
      <div style={{ display: "flex", justifyContent: "center", borderBottom: "1px solid #ddd", marginBottom: "10px" }}>
        <button style={tabStyle(tab === "jobs")} onClick={() => setTab("jobs")}>
          Scheduled Jobs &amp; Notifications
        </button>
        <button style={tabStyle(tab === "log")} onClick={() => setTab("log")}>
          Event Log
        </button>
        <button style={tabStyle(tab === "tables")} onClick={() => setTab("tables")}>
          PocketBase Tables
        </button>
      </div>

      {tab === "jobs" && <ScheduledJobsTab />}
      {tab === "log" && <EventLogTab />}
      {tab === "tables" && <PocketBaseTablesTab />}

      <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "20px", paddingBottom: "16px" }}>
        <Link style={buttonStyle()} to="/">
          Home
        </Link>
      </div>
    </div>
  );
}
