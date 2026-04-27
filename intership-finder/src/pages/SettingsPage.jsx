import React, { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import Autocomplete from "../components/shared/Autocomplete";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export default function SettingsPage({
  rKey,
  setRKey,
  gKey,
  setGKey,
  resumeTxt,
  setResumeTxt,
  saveUserKeys,
  subs,
  addHunt,
  delHunt,
  runHunter,
  hQ,
  setHQ,
  hL,
  setHL,
  hLoading,
  onExportCsv,
  onExportJson,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isReading, setIsReading] = useState(false);

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file || file.type !== "application/pdf") {
      alert("Please drop a valid PDF file.");
      return;
    }

    setIsReading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let extractedText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        extractedText += `${textContent.items.map((item) => item.str).join(" ")}\n\n`;
      }

      setResumeTxt(extractedText.trim());
    } catch (err) {
      console.error(err);
      alert("Failed to read the PDF. Make sure it's a text-based PDF, not an image scan.");
    } finally {
      setIsReading(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", paddingBottom: "40px" }}>
      <div className="scard">
        <h3>Free Mode</h3>
        <p style={{ fontSize: 12, color: "var(--txt2)", marginBottom: 12 }}>
          The tracker works without any API keys. Applications, reminders, analytics, timeline, and exports are all available for free.
        </p>
        <div className="note" style={{ marginTop: 0 }}>
          Add your own keys only if you want advanced extras like live job search, AI cover letters, resume match, follow-up drafts, company intel, or auto-hunter.
        </div>
      </div>

      <div className="scard">
        <h3>Optional API Keys</h3>
        <p style={{ fontSize: 12, color: "var(--txt3)", marginBottom: 16 }}>
          Keys are optional and only unlock paid external services. They are encrypted in the database and never stored in plain text.
        </p>
        <div className="srow">
          <label>RapidAPI Key</label>
          <input type="password" value={rKey} onChange={(e) => setRKey(e.target.value)} placeholder="Paste JSearch key here..." />
        </div>
        <div className="note" style={{ marginBottom: 14 }}>
          Used for: live job search and auto-hunter.
        </div>
        <div className="srow">
          <label>Gemini API Key</label>
          <input type="password" value={gKey} onChange={(e) => setGKey(e.target.value)} placeholder="Paste Gemini key here..." />
        </div>
        <div className="note" style={{ marginBottom: 14 }}>
          Used for: AI cover letters, resume match, follow-up drafts, and company intel.
        </div>
        <button className="mbtn mbtn-p" onClick={saveUserKeys} style={{ marginTop: 12 }}>
          Save Optional Keys
        </button>
      </div>

      <div className="scard">
        <h3>Backup and Export</h3>
        <p style={{ fontSize: 12, color: "var(--txt3)", marginBottom: 16 }}>Export a spreadsheet for analysis or a JSON backup you can restore later.</p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="mbtn" onClick={onExportCsv}>Export CSV</button>
          <button className="mbtn mbtn-p" onClick={onExportJson}>Backup JSON</button>
        </div>
      </div>

      <div className="scard">
        <h3>Your Background</h3>
        <p style={{ fontSize: 12, color: "var(--txt3)", marginBottom: 16 }}>
          Drop your PDF resume here so the optional AI tools can use it as context. You can still use the tracker without this.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragging ? "var(--acc)" : "var(--b0)"}`,
            backgroundColor: isDragging ? "rgba(255,255,255,0.02)" : "var(--s2)",
            borderRadius: "var(--r)",
            padding: "40px 20px",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.2s ease",
            marginBottom: "16px",
          }}
        >
          {isReading ? (
            <div style={{ color: "var(--txt2)", fontSize: "14px", fontWeight: "600" }}>
              <div className="spin" style={{ margin: "0 auto 10px auto" }}></div>
              Extracting text...
            </div>
          ) : (
            <div style={{ color: isDragging ? "var(--acc)" : "var(--txt3)", fontSize: "14px", fontWeight: "600" }}>
              <span style={{ fontSize: "24px", display: "block", marginBottom: "8px" }}>[PDF]</span>
              {isDragging ? "Drop it!" : "Drag and drop your resume PDF here"}
            </div>
          )}
        </div>

        <textarea className="finp fta" placeholder="Or paste your text manually here..." value={resumeTxt} onChange={(e) => setResumeTxt(e.target.value)} style={{ width: "100%", minHeight: "150px" }} />
      </div>

      <div className="scard">
        <h3>Auto-Hunter Management</h3>
        <p style={{ fontSize: "12px", color: "var(--txt3)", marginBottom: "16px" }}>
          Auto-hunter is optional and requires your RapidAPI key. It will search these keywords and add new jobs to your To Do list.
        </p>

        <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "240px" }}>
            <Autocomplete type="job" value={hQ} onChange={(e) => setHQ(e.target.value)} placeholder="Keyword (e.g. React Developer)" />
          </div>
          <div style={{ flex: 1, minWidth: "240px" }}>
            <Autocomplete type="city" value={hL} onChange={(e) => setHL(e.target.value)} placeholder="Location (e.g. New York)" />
          </div>
          <button className="mbtn mbtn-p" onClick={addHunt}>Add Hunt</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {subs.map((s) => (
            <div key={s.id} className="link-row" style={{ padding: "10px 16px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13px", fontWeight: "600" }}>{s.query}</div>
                <div style={{ fontSize: "11px", color: "var(--txt3)" }}>{s.location} | {s.job_type}</div>
              </div>
              <button className="mbtn-d" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => delHunt(s.id)}>
                Remove
              </button>
            </div>
          ))}
          {subs.length === 0 && <div className="note">No active hunts. You can skip this entirely if you want to stay in free tracker mode.</div>}
        </div>

        <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid var(--b0)" }}>
          <button className="mbtn mbtn-p" style={{ width: "100%", height: "44px" }} onClick={runHunter} disabled={hLoading}>
            {hLoading ? "Hunter is searching..." : "Run Hunter Now"}
          </button>
        </div>
      </div>
    </div>
  );
}
