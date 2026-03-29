export default function SettingsPage({ 
  rKey, setRKey, gKey, setGKey, resumeTxt, setResumeTxt, saveUserKeys 
}) {
  return (
    <>
      <div className="scard">
        <h3>User API Keys (Encrypted Vault)</h3>
        <p style={{ fontSize: 12, color: "var(--txt3)", marginBottom: 16 }}>
          Your keys are encrypted in the database using AES-256. They are never stored in plain text and are tied strictly to your account.
        </p>
        <div className="srow">
          <label>RapidAPI Key</label>
          <input type="password" value={rKey} onChange={(e) => setRKey(e.target.value)} placeholder="Paste JSearch key here..." />
        </div>
        <div className="srow">
          <label>Gemini API Key</label>
          <input type="password" value={gKey} onChange={(e) => setGKey(e.target.value)} placeholder="Paste Gemini key here..." />
        </div>
        <button className="mbtn mbtn-p" onClick={saveUserKeys} style={{ marginTop: 16 }}>
          Lock in Vault 🔒
        </button>
      </div>

      <div className="scard">
        <h3>Your background (for AI cover letters)</h3>
        <p style={{ fontSize: 12, color: "var(--txt3)", marginBottom: 12 }}>
          This context is saved directly to your browser so it auto-loads whenever you log in.
        </p>
        <textarea className="finp fta" style={{ width: "100%" }} value={resumeTxt} onChange={(e) => setResumeTxt(e.target.value)}
          placeholder="e.g. CS junior, 3.9 GPA. Skills: Java, Python, C++..." />
      </div>
    </>
  );
}