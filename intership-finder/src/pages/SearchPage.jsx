import { JOB_TYPES, DATE_OPTS } from '../utils/constants';
import { srcTag } from '../utils/helpers';

export default function SearchPage({
  jsQ, setJsQ, jsLoc, setJsLoc, jsType, setJsType,
  jsDate, setJsDate, runSearch, jsLoad, jsErr, jsRes, jsAdded, addFromSearch
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Job search</h2>
        <span className="panel-sub">Live results · Secure Backend Pipeline</span>
      </div>
      
      {/* The API Key input bar has been completely removed! 
        Your React app no longer handles raw keys. 
      */}

      <div className="sf-grid">
        <div className="sf-grp">
          <span className="sf-lbl">Keywords</span>
          <input className="sf-inp" value={jsQ} onChange={(e) => setJsQ(e.target.value)} placeholder="software engineer intern" onKeyDown={(e) => e.key === "Enter" && runSearch()} />
        </div>
        <div className="sf-grp">
          <span className="sf-lbl">Location</span>
          <input className="sf-inp" value={jsLoc} onChange={(e) => setJsLoc(e.target.value)} placeholder="San Francisco, CA" onKeyDown={(e) => e.key === "Enter" && runSearch()} />
        </div>
        <div className="sf-grp">
          <span className="sf-lbl">Job type</span>
          <select className="sf-inp" value={jsType} onChange={(e) => setJsType(e.target.value)}>
            {JOB_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </div>
        <div className="sf-grp">
          <span className="sf-lbl">Posted</span>
          <select className="sf-inp" value={jsDate} onChange={(e) => setJsDate(e.target.value)}>
            {DATE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
        <button className="go-btn" onClick={runSearch} disabled={jsLoad}>
          {jsLoad ? "Searching…" : "Search ↗"}
        </button>
      </div>

      <div className="results">
        {jsLoad && (
          <div className="loading">
            <div className="spin" />
            <span>Fetching live jobs from backend…</span>
          </div>
        )}
        
        {/* The new Error UI to prevent the white screen crash */}
        {jsErr && !jsLoad && (
          <div className="empty">
            <div className="empty-ico" style={{ color: "var(--red)" }}>✕</div>
            <p style={{ color: "var(--red)", fontWeight: 600 }}>{jsErr}</p>
            <p style={{ fontSize: '11px', marginTop: '8px', color: "var(--txt3)" }}>
              Check your FastAPI terminal and .env file to ensure keys are loaded.
            </p>
          </div>
        )}

        {!jsLoad && !jsErr && jsRes.length === 0 && (
          <div className="empty">
            <div className="empty-ico">◎</div>
            <p>Search above to pull live jobs from LinkedIn, Indeed, Glassdoor &amp; more</p>
          </div>
        )}
        
        {/* We only map over results if there's no error and it's not loading */}
        {!jsLoad && !jsErr && jsRes.map((r) => {
          const added = jsAdded.has(r._id);
          return (
            <div key={r._id} className="rcard">
              <div className="rinfo">
                <div className="rco">{r.company}</div>
                <div className="rrole">{r.role}</div>
                <div className="rmeta">
                  <span className={`tag ${srcTag(r.source)}`}>{r.source}</span>
                  {r.remote && <span className="tag t-rm">remote</span>}
                  {r.location && <span className="rloc">📍 {r.location}</span>}
                  {r.posted && <span className="rloc">· {r.posted}</span>}
                </div>
              </div>
              <div className="racts">
                {r.link && <a href={r.link} target="_blank" rel="noreferrer"><button className="rbtn">View ↗</button></a>}
                <button className={`rbtn ${added ? "rbtn-done" : "rbtn-add"}`} onClick={() => !added && addFromSearch(r)}>
                  {added ? "✓ Added" : "+ Track"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}