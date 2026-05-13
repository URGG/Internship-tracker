import Icon from "../components/shared/Icon";

const sampleJobs = [
  { company: "Northstar Labs", role: "Software Engineering Intern", tag: "Applied", cls: "sa" },
  { company: "Orbit Health", role: "Frontend Intern", tag: "Interview", cls: "si" },
  { company: "LedgerWorks", role: "Data Analyst Intern", tag: "Follow up", cls: "sp" },
];

const proofPoints = [
  ["Pipeline clarity", "Board, list, and timeline views keep each application moving."],
  ["Deadline control", "Follow-ups, recruiters, referrals, and next actions stay attached to the job."],
  ["No setup wall", "The core tracker works free, with optional AI and search keys later."],
];

const features = [
  ["tracker", "Application tracker", "Save roles, stages, notes, contacts, links, and dates."],
  ["analytics", "Weekly review", "Watch response rates, interviews, offers, and source performance."],
  ["search", "Job search tools", "Find listings, import leads, and avoid tracking duplicates."],
  ["spark", "Optional AI drafts", "Generate cover letters, follow-ups, resume matches, and company notes."],
];

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    detail: "Applications, pipeline views, reminders, analytics, and exports.",
    action: "Create account",
    id: "free",
  },
  {
    name: "Pro",
    price: "$9/mo",
    detail: "Built-in AI quota for cover letters, resume match, follow-ups, and company intel.",
    action: "Choose monthly",
    id: "pro_monthly",
  },
  {
    name: "Lifetime",
    price: "$129",
    detail: "One payment for permanent access to the premium tracker version.",
    action: "Own forever",
    id: "lifetime",
  },
];

export default function LandingPage({ onStart, onLogin, onOpenApp, onCheckout, checkoutLoading }) {
  return (
    <main className="landing">
      <header className="landing-nav">
        <div className="sb-logo landing-logo">
          <div className="sb-logo-mark"><Icon name="logo" size={16} strokeWidth={2} /></div>
          <div className="sb-logo-text">
            intern<span>.track</span>
          </div>
        </div>
        <div className="landing-nav-actions">
          <button className="tbtn" onClick={onOpenApp}>
            Open app
          </button>
          <button className="tbtn tbtn-p" onClick={onLogin}>
            <Icon name="login" size={15} /> Sign in
          </button>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-copy">
          <div className="landing-kicker">
            <Icon name="tracker" size={14} />
            Private internship application tracker
          </div>
          <h1>Track every internship application without losing the thread.</h1>
          <p>
            intern.track gives students one focused workspace for saved roles, deadlines, follow-ups, interviews, analytics, exports, and optional AI help.
          </p>
          <div className="landing-actions">
            <button className="landing-primary" onClick={onStart}>
              <Icon name="plus" size={16} /> Start tracking
            </button>
            <a className="landing-secondary" href="#pricing">
              <Icon name="pricing" size={16} /> View pricing
            </a>
          </div>
        </div>

        <div className="landing-product" aria-label="intern.track tracker preview">
          <div className="landing-browser">
            <div className="landing-browser-bar">
              <span />
              <span />
              <span />
              <strong>Tracker</strong>
            </div>
            <div className="landing-stats">
              {[
                ["24", "tracked"],
                ["11", "applied"],
                ["3", "interviews"],
              ].map(([value, label]) => (
                <div key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div className="landing-board">
              {["To Do", "Applied", "Interview"].map((column, index) => (
                <div className="landing-column" key={column}>
                  <div className="landing-column-head">
                    <span className={`kdot ${index === 0 ? "d-W" : index === 1 ? "d-A" : "d-I"}`} />
                    {column}
                  </div>
                  {sampleJobs.slice(index, index + 2).map((job) => (
                    <div className="landing-job" key={`${column}-${job.company}`}>
                      <strong>{job.company}</strong>
                      <span>{job.role}</span>
                      <em className={`spill ${job.cls}`}>{job.tag}</em>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-proof">
        {proofPoints.map(([title, body]) => (
          <div key={title}>
            <strong>{title}</strong>
            <span>{body}</span>
          </div>
        ))}
      </section>

      <section className="landing-section">
        <div className="landing-section-head">
          <span className="landing-kicker">What stays organized</span>
          <h2>Built around the student job hunt, not generic tasks.</h2>
        </div>
        <div className="landing-features">
          {features.map(([icon, title, body]) => (
            <article key={title}>
              <div className="landing-feature-icon"><Icon name={icon} size={18} /></div>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-pricing" id="pricing">
        <div>
          <span className="landing-kicker">Pricing</span>
          <h2>Start free. Upgrade only if convenience is worth it.</h2>
          <p>The tracker, analytics, reminders, and exports stay free. Paid plans add built-in AI usage, and bring-your-own-key mode stays available on every plan.</p>
        </div>
        <div className="landing-price-grid">
          {pricingPlans.map((plan) => (
            <div className="landing-price-card" key={plan.id}>
              <span>{plan.name}</span>
              <strong>{plan.price}</strong>
              <p>{plan.detail}</p>
              <button
                className="landing-primary"
                onClick={plan.id === "free" ? onStart : () => onCheckout(plan.id)}
                disabled={checkoutLoading === plan.id}
              >
                <Icon name={plan.id === "free" ? "plus" : "pricing"} size={16} />
                {checkoutLoading === plan.id ? "Opening Checkout..." : plan.action}
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
