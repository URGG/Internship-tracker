import { JOB_TYPES, DATE_OPTS } from "../utils/constants";
import { srcTag } from "../utils/helpers";
import Autocomplete from "../components/shared/Autocomplete";
import Icon from "../components/shared/Icon";

export default function SearchPage({
  jsQ,
  setJsQ,
  jsLoc,
  setJsLoc,
  jsType,
  setJsType,
  jsDate,
  setJsDate,
  runSearch,
  jsLoad,
  jsErr,
  jsRes,
  jsAdded,
  addFromSearch,
  jobLinkUrl,
  setJobLinkUrl,
  jobLinkLoad,
  autofillJobLink,
}) {
  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <div className="panel">
        <div className="panel-head">
          <h2>Import from job link</h2>
          <span className="panel-sub">Paste a posting URL to prefill a tracked application</span>
        </div>
        <div style={{ padding: "18px 22px", display: "grid", gridTemplateColumns: "1fr auto", gap: "10px" }}>
          <input className="sf-inp" value={jobLinkUrl} onChange={(e) => setJobLinkUrl(e.target.value)} placeholder="https://jobs.company.com/posting/..." />
          <button className="go-btn" onClick={autofillJobLink} disabled={jobLinkLoad}>
            {jobLinkLoad ? "Importing..." : "Import Link"}
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Job search</h2>
          <span className="panel-sub">Optional live search | Bring your own RapidAPI key</span>
        </div>

        <div className="sf-grid">
          <div className="sf-grp">
            <span className="sf-lbl">Keywords</span>
            <Autocomplete type="job" value={jsQ} onChange={(e) => setJsQ(e.target.value)} placeholder="software engineer intern" className="sf-inp" />
          </div>
          <div className="sf-grp">
            <span className="sf-lbl">Location</span>
            <Autocomplete type="city" value={jsLoc} onChange={(e) => setJsLoc(e.target.value)} placeholder="San Francisco, CA" className="sf-inp" />
          </div>
          <div className="sf-grp">
            <span className="sf-lbl">Job type</span>
            <select className="sf-inp" value={jsType} onChange={(e) => setJsType(e.target.value)}>
              {JOB_TYPES.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.l}
                </option>
              ))}
            </select>
          </div>
          <div className="sf-grp">
            <span className="sf-lbl">Posted</span>
            <select className="sf-inp" value={jsDate} onChange={(e) => setJsDate(e.target.value)}>
              {DATE_OPTS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </div>
          <button className="go-btn" onClick={runSearch} disabled={jsLoad}>
            {jsLoad ? "Searching..." : "Search"}
          </button>
        </div>

        <div className="results">
          {jsLoad && (
            <div className="loading">
              <div className="spin" />
              <span>Fetching live jobs from backend...</span>
            </div>
          )}

          {jsErr && !jsLoad && (
            <div className="empty">
              <div className="empty-ico" style={{ color: "var(--red)" }}>
                <Icon name="error" size={36} strokeWidth={1.7} />
              </div>
              <p style={{ color: "var(--red)", fontWeight: 600 }}>{jsErr}</p>
              <p style={{ fontSize: "11px", marginTop: "8px", color: "var(--txt3)" }}>
                Live search is optional. Add your own RapidAPI key in Settings if you want backend-powered search.
              </p>
            </div>
          )}

        {!jsLoad && !jsErr && jsRes.length === 0 && (
            <div className="empty">
              <div className="empty-ico"><Icon name="empty" size={36} strokeWidth={1.7} /></div>
              <p>Search above to pull live jobs when you connect your own RapidAPI key, or keep using the tracker manually for free.</p>
            </div>
          )}

          {!jsLoad && !jsErr &&
            jsRes.map((r) => {
              const added = jsAdded.has(r._id);
              return (
                <div key={r._id} className="rcard">
                  <div className="rinfo">
                    <div className="rco">{r.company}</div>
                    <div className="rrole">{r.role}</div>
                    <div className="rmeta">
                      <span className={`tag ${srcTag(r.source)}`}>{r.source}</span>
                      {r.remote && <span className="tag t-rm">remote</span>}
                      {r.location && <span className="rloc">Location: {r.location}</span>}
                      {r.posted && <span className="rloc">| {r.posted}</span>}
                    </div>
                  </div>
                  <div className="racts">
                    {r.link && (
                      <a href={r.link} target="_blank" rel="noreferrer">
                        <button className="rbtn"><Icon name="external" size={14} /> View</button>
                      </a>
                    )}
                    <button className={`rbtn ${added ? "rbtn-done" : "rbtn-add"}`} onClick={() => !added && addFromSearch(r)}>
                      {added ? "Saved" : "+ Save Lead"}
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
