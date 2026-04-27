import React, { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import Heatmap from "../components/shared/Heatmap";
import { daysBetween } from "../utils/helpers";

export default function AnalyticsPage({ apps, onExportCsv, onExportJson }) {
  const stats = useMemo(() => {
    if (!apps || apps.length === 0) return null;

    const total = apps.length;
    const applied = apps.filter((a) => a.applied_date).length;
    const interviews = apps.filter((a) => ["Phone Screen", "Interview"].includes(a.status)).length;
    const offers = apps.filter((a) => a.status === "Offer").length;
    const responded = apps.filter((a) => a.last_contact_date || ["Phone Screen", "Interview", "Offer", "Rejected"].includes(a.status)).length;
    const interviewRate = applied > 0 ? ((interviews / applied) * 100).toFixed(1) : "0.0";
    const responseRate = applied > 0 ? ((responded / applied) * 100).toFixed(1) : "0.0";
    const offerRate = applied > 0 ? ((offers / applied) * 100).toFixed(1) : "0.0";

    const responseDays = apps.map((app) => daysBetween(app.applied_date, app.last_contact_date)).filter((value) => value !== null);
    const avgDaysToResponse = responseDays.length > 0 ? (responseDays.reduce((sum, value) => sum + value, 0) / responseDays.length).toFixed(1) : "-";

    const dateMap = {};
    apps.forEach((app) => {
      const d = app.applied_date || "Unknown";
      if (!dateMap[d]) dateMap[d] = 0;
      dateMap[d] += 1;
    });
    const timeline = Object.keys(dateMap)
      .filter((d) => d !== "Unknown")
      .sort((a, b) => new Date(a) - new Date(b))
      .map((date) => ({ date, applications: dateMap[date] }));

    const funnelMap = { "To Do": 0, Applied: 0, "Phone Screen": 0, Interview: 0, Offer: 0, Rejected: 0 };
    apps.forEach((app) => {
      if (funnelMap[app.status] !== undefined) funnelMap[app.status] += 1;
    });
    const funnel = Object.keys(funnelMap).map((status) => ({ status, count: funnelMap[status] }));

    const sourceMap = {};
    apps.forEach((app) => {
      const source = app.source || "Other";
      if (!sourceMap[source]) sourceMap[source] = { source, total: 0, interviews: 0, offers: 0 };
      sourceMap[source].total += 1;
      if (["Phone Screen", "Interview"].includes(app.status)) sourceMap[source].interviews += 1;
      if (app.status === "Offer") sourceMap[source].offers += 1;
    });
    const sources = Object.values(sourceMap)
      .map((item) => ({
        source: item.source,
        count: item.total,
        interviewRate: item.total ? ((item.interviews / item.total) * 100).toFixed(0) : "0",
        offerRate: item.total ? ((item.offers / item.total) * 100).toFixed(0) : "0",
      }))
      .sort((a, b) => b.count - a.count);

    const interviewStageMap = {};
    apps.forEach((app) => {
      if (!app.interview_stage) return;
      interviewStageMap[app.interview_stage] = (interviewStageMap[app.interview_stage] || 0) + 1;
    });
    const interviewStages = Object.keys(interviewStageMap).map((stage) => ({ stage, count: interviewStageMap[stage] }));

    return { total, interviews, offers, responseRate, interviewRate, offerRate, avgDaysToResponse, timeline, funnel, sources, interviewStages };
  }, [apps]);

  const COLORS = { "To Do": "#787774", Applied: "#5b7fff", "Phone Screen": "#38bdf8", Interview: "#fbbf24", Offer: "#34d399", Rejected: "#f87171" };
  const SOURCE_COLORS = ["#5b7fff", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#38bdf8"];

  if (!stats) {
    return (
      <div style={{ textAlign: "center", padding: "40px", color: "var(--txt3)" }}>
        <h2>No data yet!</h2>
        <p>Add some applications to your Tracker to see your analytics.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", paddingBottom: "40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", marginBottom: "20px", alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: "20px", marginBottom: "4px" }}>Pipeline Analytics</h2>
          <div style={{ color: "var(--txt3)", fontSize: "12px" }}>Response, interview, and offer performance across your internship search</div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="mbtn" onClick={onExportCsv}>Export CSV</button>
          <button className="mbtn mbtn-p" onClick={onExportJson}>Backup JSON</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "32px" }}>
        {[
          ["Total Applications", stats.total, "var(--txt)"],
          ["Response Rate", `${stats.responseRate}%`, "var(--acc)"],
          ["Interview Rate", `${stats.interviewRate}%`, "var(--amb)"],
          ["Offer Rate", `${stats.offerRate}%`, "var(--grn)"],
          ["Avg. Days to Response", stats.avgDaysToResponse, "var(--acc2)"],
        ].map(([label, value, color]) => (
          <div key={label} className="scard" style={{ margin: 0, textAlign: "center", padding: "24px" }}>
            <div style={{ fontSize: "14px", color: "var(--txt2)", marginBottom: "8px" }}>{label}</div>
            <div style={{ fontSize: "32px", fontWeight: "700", color }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="scard" style={{ marginBottom: "24px" }}>
        <h3>Application Activity</h3>
        <Heatmap apps={apps} />
      </div>

      <div className="scard" style={{ marginBottom: "24px" }}>
        <h3 style={{ marginBottom: "24px" }}>Application Velocity</h3>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <AreaChart data={stats.timeline}>
              <defs>
                <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5b7fff" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#5b7fff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="var(--txt3)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--txt3)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: "var(--s2)", border: "1px solid var(--b1)", borderRadius: "8px", color: "var(--txt)" }} itemStyle={{ color: "#5b7fff", fontWeight: "bold" }} />
              <Area type="monotone" dataKey="applications" stroke="#5b7fff" strokeWidth={3} fillOpacity={1} fill="url(#colorApps)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px" }}>
        <div className="scard" style={{ margin: 0 }}>
          <h3 style={{ marginBottom: "24px" }}>Pipeline Breakdown</h3>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={stats.funnel} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="status" type="category" stroke="var(--txt)" fontSize={13} tickLine={false} axisLine={false} width={100} />
                <Tooltip cursor={{ fill: "var(--s3)" }} contentStyle={{ backgroundColor: "var(--s2)", border: "1px solid var(--b1)", borderRadius: "8px", color: "var(--txt)" }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={26}>
                  {stats.funnel.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="scard" style={{ margin: 0 }}>
          <h3 style={{ marginBottom: "24px" }}>Top Channels</h3>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={stats.sources} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="source" type="category" stroke="var(--txt)" fontSize={13} tickLine={false} axisLine={false} width={100} />
                <Tooltip cursor={{ fill: "var(--s3)" }} contentStyle={{ backgroundColor: "var(--s2)", border: "1px solid var(--b1)", borderRadius: "8px", color: "var(--txt)" }} formatter={(value, _, payload) => [`${value} tracked | ${payload.payload.interviewRate}% interview | ${payload.payload.offerRate}% offer`, "Source"]} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={26}>
                  {stats.sources.map((entry, index) => (
                    <Cell key={`source-${index}`} fill={SOURCE_COLORS[index % SOURCE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="scard" style={{ margin: 0 }}>
          <h3 style={{ marginBottom: "24px" }}>Interview Stage Mix</h3>
          {stats.interviewStages.length === 0 ? (
            <div className="note">No interview stage data yet. Add stages like Technical, Behavioral, or Final Round in your applications.</div>
          ) : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={stats.interviewStages}>
                  <XAxis dataKey="stage" stroke="var(--txt3)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--txt3)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "var(--s2)", border: "1px solid var(--b1)", borderRadius: "8px", color: "var(--txt)" }} />
                  <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
