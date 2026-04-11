import React, { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// We have to point PDF.js to its worker script so it doesn't freeze your app
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function SettingsPage({ rKey, setRKey, gKey, setGKey, resumeTxt, setResumeTxt, saveUserKeys }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isReading, setIsReading] = useState(false);

  // --- DRAG AND DROP HANDLERS ---
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

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
      // 1. Convert the file to an ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // 2. Load the PDF using pdfjs
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let extractedText = "";

      // 3. Loop through every page and pull out the text
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(" ");
        extractedText += pageText + "\n\n";
      }

      // 4. Save it to your app state!
      setResumeTxt(extractedText.trim());
      
    } catch (err) {
      console.error(err);
      alert("Failed to read the PDF. Make sure it's a text-based PDF, not an image scan.");
    } finally {
      setIsReading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      
      {/* API KEYS VAULT */}
      <div className="scard">
        <h3>User API Keys (Encrypted Vault)</h3>
        <p style={{ fontSize: 12, color: "var(--txt3)", marginBottom: 16 }}>
          Your keys are encrypted in the database. They are never stored in plain text.
        </p>
        <div className="srow">
          <label>RapidAPI Key</label>
          <input type="password" value={rKey} onChange={e => setRKey(e.target.value)} placeholder="Paste JSearch key here..." />
        </div>
        <div className="srow">
          <label>Gemini API Key</label>
          <input type="password" value={gKey} onChange={e => setGKey(e.target.value)} placeholder="Paste Gemini key here..." />
        </div>
        <button className="mbtn mbtn-p" onClick={saveUserKeys} style={{ marginTop: 12 }}>
          Lock in Vault 🔒
        </button>
      </div>

      {/* DRAG AND DROP RESUME ZONE */}
      <div className="scard">
        <h3>Your Background (for AI Cover Letters)</h3>
        <p style={{ fontSize: 12, color: "var(--txt3)", marginBottom: 16 }}>
          Drop your PDF resume here, and we will extract the text for the AI context.
        </p>

        {/* The Dropzone */}
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragging ? "var(--acc)" : "var(--b0)"}`,
            backgroundColor: isDragging ? "rgba(255, 255, 255, 0.02)" : "var(--s2)",
            borderRadius: "var(--r)",
            padding: "40px 20px",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.2s ease",
            marginBottom: "16px"
          }}
        >
          {isReading ? (
            <div style={{ color: "var(--txt2)", fontSize: "14px", fontWeight: "600" }}>
              <div className="spin" style={{ margin: "0 auto 10px auto" }}></div>
              Extracting text...
            </div>
          ) : (
            <div style={{ color: isDragging ? "var(--acc)" : "var(--txt3)", fontSize: "14px", fontWeight: "600" }}>
              <span style={{ fontSize: "24px", display: "block", marginBottom: "8px" }}>📄</span>
              {isDragging ? "Drop it!" : "Drag & Drop your Resume PDF here"}
            </div>
          )}
        </div>

        {/* The Text Fallback (In case they need to edit it manually after dropping) */}
        <textarea 
          className="finp fta"
          placeholder="Or paste your text manually here..."
          value={resumeTxt}
          onChange={(e) => setResumeTxt(e.target.value)}
          style={{ width: "100%", minHeight: "150px" }}
        />
      </div>

    </div>
  );
}