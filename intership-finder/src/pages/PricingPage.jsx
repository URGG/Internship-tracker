import { useMemo, useState } from "react";
import Icon from "../components/shared/Icon";

const tiers = {
  monthly: [
    {
      name: "Free",
      id: "free",
      price: "$0",
      cadence: "/forever",
      badge: "Best for starting",
      tone: "var(--txt2)",
      cta: "Stay Free",
      highlight: false,
      points: [
        "Application tracker, timeline, and reminders",
        "Analytics, exports, and manual job entry",
        "Bring-your-own-key support for optional AI tools",
      ],
    },
    {
      name: "Pro",
      id: "pro_monthly",
      price: "$9",
      cadence: "/month",
      badge: "Simple recurring plan",
      tone: "var(--txt)",
      cta: "Choose Monthly",
      highlight: true,
      points: [
        "Everything in Free",
        "Built-in AI credits so setup feels instant",
        "Shared live job search quota without user-owned keys",
        "Priority feature access and smoother onboarding",
      ],
    },
    {
      name: "Lifetime",
      id: "lifetime",
      price: "$129",
      cadence: "one-time",
      badge: "Own it forever",
      tone: "var(--grn)",
      cta: "Own Forever",
      highlight: false,
      points: [
        "One payment, permanent access",
        "Best fit for students who do not want subscriptions",
        "Future paid tracker upgrades included",
      ],
    },
  ],
  lifetime: [
    {
      name: "Free",
      id: "free",
      price: "$0",
      cadence: "/forever",
      badge: "Best for starting",
      tone: "var(--txt2)",
      cta: "Stay Free",
      highlight: false,
      points: [
        "Application tracker, timeline, and reminders",
        "Analytics, exports, and manual job entry",
        "Bring-your-own-key support for optional AI tools",
      ],
    },
    {
      name: "Pro",
      id: "pro_monthly",
      price: "$9",
      cadence: "/month",
      badge: "Lower upfront cost",
      tone: "var(--txt)",
      cta: "Choose Monthly",
      highlight: false,
      points: [
        "Everything in Free",
        "Built-in AI credits so setup feels instant",
        "Shared live job search quota without user-owned keys",
        "Priority feature access and smoother onboarding",
      ],
    },
    {
      name: "Lifetime",
      id: "lifetime",
      price: "$129",
      cadence: "one-time",
      badge: "Recommended ownership plan",
      tone: "var(--grn)",
      cta: "Own Forever",
      highlight: true,
      points: [
        "One payment, permanent access",
        "Best fit for students who do not want subscriptions",
        "Future paid tracker upgrades included",
        "Strongest value if you want a premium version later",
      ],
    },
  ],
};

export default function PricingPage({ startCheckout, checkoutLoading }) {
  const [mode, setMode] = useState("monthly");

  const plans = useMemo(() => tiers[mode], [mode]);

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", paddingBottom: 40 }}>
      <div className="scard" style={{ marginBottom: 20, overflow: "hidden", position: "relative" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at top right, rgba(255,255,255,0.08), transparent 35%), radial-gradient(circle at bottom left, rgba(255,255,255,0.06), transparent 40%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", display: "grid", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 999, border: "1px solid var(--b0)", background: "var(--s2)", color: "var(--txt2)", fontSize: 11, fontFamily: "var(--mono)", marginBottom: 14 }}>
                <Icon name="pricing" size={14} />
                Pricing
              </div>
              <h2 style={{ fontSize: 30, lineHeight: 1.1, marginBottom: 10 }}>Simple pricing for students</h2>
              <p style={{ color: "var(--txt2)", maxWidth: 640, lineHeight: 1.7 }}>
                Keep the tracker free, upgrade later if you want built-in AI and search without bringing your own keys. Monthly stays lightweight. Lifetime lets you own the premium version outright.
              </p>
            </div>

            <div className="vsw" style={{ marginLeft: 0 }}>
              <button className={`vsw-btn${mode === "monthly" ? " on" : ""}`} onClick={() => setMode("monthly")}>
                Monthly
              </button>
              <button className={`vsw-btn${mode === "lifetime" ? " on" : ""}`} onClick={() => setMode("lifetime")}>
                Own Forever
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {[
              ["No paywall on the tracker", "Applications, analytics, reminders, exports"],
              ["Monthly option", "Easy entry if you want premium later"],
              ["Lifetime option", "One payment for permanent access"],
            ].map(([title, desc]) => (
              <div key={title} style={{ padding: 16, borderRadius: "var(--r)", background: "var(--s2)", border: "1px solid var(--b0)" }}>
                <div style={{ fontSize: 12, color: "var(--txt)", marginBottom: 6, fontWeight: 700 }}>{title}</div>
                <div style={{ fontSize: 12, color: "var(--txt3)", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 20 }}>
        {plans.map((plan) => (
          <div
            key={plan.name}
            className="scard"
            style={{
              margin: 0,
              borderColor: plan.highlight ? "var(--txt)" : "var(--b0)",
              boxShadow: plan.highlight ? "0 16px 48px rgba(0,0,0,.22)" : "none",
              transform: plan.highlight ? "translateY(-2px)" : "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>{plan.name}</div>
                <div className="tag t-ot">{plan.badge}</div>
              </div>
              {plan.highlight && <div className="tag t-li">Recommended</div>}
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 40, fontWeight: 800, color: plan.tone }}>{plan.price}</div>
              <div style={{ color: "var(--txt3)", fontSize: 12, fontFamily: "var(--mono)" }}>{plan.cadence}</div>
            </div>

            <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
              {plan.points.map((point) => (
                <div key={point} style={{ display: "grid", gridTemplateColumns: "16px 1fr", gap: 10, alignItems: "start", color: "var(--txt2)", fontSize: 13, lineHeight: 1.6 }}>
                  <Icon name="todo" size={14} />
                  <span>{point}</span>
                </div>
              ))}
            </div>

            <button
              className={plan.highlight ? "mbtn mbtn-p" : "mbtn"}
              style={{ width: "100%" }}
              onClick={() => startCheckout(plan.id)}
              disabled={checkoutLoading === plan.id}
            >
              {checkoutLoading === plan.id ? "Opening Checkout..." : plan.cta}
            </button>
          </div>
        ))}
      </div>

      <div className="scard" style={{ margin: 0 }}>
        <h3 style={{ marginBottom: 14 }}>Recommended release positioning</h3>
        <div style={{ display: "grid", gap: 10, color: "var(--txt2)", fontSize: 13, lineHeight: 1.7 }}>
          <div>Free: core tracker forever, optional bring-your-own-key AI.</div>
          <div>Pro Monthly: built-in convenience for users who do not want setup friction.</div>
          <div>Lifetime: strongest pitch for students who prefer one payment over a subscription.</div>
        </div>
      </div>
    </div>
  );
}
