import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

export default function AnalyticsPage({ apps }) {
 
  const stats = useMemo(() => {
    if (!apps || apps.length === 0) return null;

    // 1. Top-Level Metrics
    const total = apps.length;
    const interviews = apps.filter(a => ["Phone Screen", "Interview"].includes(a.status)).length;
    const offers = apps.filter(a => a.status === "Offer").length;
    const interviewRate = total > 0 ? ((interviews / total) * 100).toFixed(1) : 0;

    // 2. Timeline Data (Group by applied_date)
    const dateMap = {};
    apps.forEach(app => {
      const d = app.applied_date || "Unknown";
      if (!dateMap[d]) dateMap[d] = 0;
      dateMap[d]++;
    });
    
    // Sort dates chronologically
    const timeline = Object.keys(dateMap)
      .filter(d => d !== "Unknown")
      .sort((a, b) => new Date(a) - new Date(b))
      .map(date => ({ date, applications: dateMap[date] }));

    // 3. Funnel Data (Status Breakdown)
    const funnelMap = { "Wishlist": 0, "Applied": 0, "Interview": 0, "Offer": 0, "Rejected": 0 };
    apps.forEach(app => {
      if (funnelMap[app.status] !== undefined) funnelMap[app.status]++;
    });
    
    const funnel = Object.keys(funnelMap).map(status => ({
      status, 
      count: funnelMap[status]
    }));

    return { total, interviews, offers, interviewRate, timeline, funnel };
  }, [apps]);

  // Colors for the funnel bars
  const COLORS = { Wishlist: "#787774", Applied: "#5b7fff", Interview: "#fbbf24", Offer: "#34d399", Rejected: "#f87171" };

  if (!stats) {
    return (
      <div style={{ textAlign: "center", padding: "40px", color: "var(--txt3)" }}>
        <h2>No data yet!</h2>
        <p>Add some applications to your Tracker to see your analytics.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", paddingBottom: "40px" }}>
      
      {/* TOP METRIC CARDS */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "32px" }}>
        <div className="scard" style={{ flex: 1, margin: 0, textAlign: "center", padding: "24px" }}>
          <div style={{ fontSize: "14px", color: "var(--txt2)", marginBottom: "8px" }}>Total Applications</div>
          <div style={{ fontSize: "32px", fontWeight: "700", color: "var(--txt)" }}>{stats.total}</div>
        </div>
        <div className="scard" style={{ flex: 1, margin: 0, textAlign: "center", padding: "24px" }}>
          <div style={{ fontSize: "14px", color: "var(--txt2)", marginBottom: "8px" }}>Interview Rate</div>
          <div style={{ fontSize: "32px", fontWeight: "700", color: "var(--amb)" }}>{stats.interviewRate}%</div>
        </div>
        <div className="scard" style={{ flex: 1, margin: 0, textAlign: "center", padding: "24px" }}>
          <div style={{ fontSize: "14px", color: "var(--txt2)", marginBottom: "8px" }}>Offers Secured</div>
          <div style={{ fontSize: "32px", fontWeight: "700", color: "var(--grn)" }}>{stats.offers}</div>
        </div>
      </div>

      {/* TIMELINE CHART */}
      <div className="scard" style={{ marginBottom: "24px" }}>
        <h3 style={{ marginBottom: "24px" }}>Application Velocity</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <AreaChart data={stats.timeline}>
              <defs>
                <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5b7fff" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#5b7fff" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="var(--txt3)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--txt3)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: "var(--s2)", border: "1px solid var(--b1)", borderRadius: "8px", color: "var(--txt)" }}
                itemStyle={{ color: "#5b7fff", fontWeight: "bold" }}
              />
              <Area type="monotone" dataKey="applications" stroke="#5b7fff" strokeWidth={3} fillOpacity={1} fill="url(#colorApps)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* FUNNEL CHART */}
      <div className="scard">
        <h3 style={{ marginBottom: "24px" }}>Pipeline Breakdown</h3>
        <div style={{ width: '100%', height: 250 }}>
          <ResponsiveContainer>
            <BarChart data={stats.funnel} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="status" type="category" stroke="var(--txt)" fontSize={13} tickLine={false} axisLine={false} width={80} />
              <Tooltip 
                cursor={{ fill: "var(--s3)" }}
                contentStyle={{ backgroundColor: "var(--s2)", border: "1px solid var(--b1)", borderRadius: "8px", color: "var(--txt)" }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={30}>
                {stats.funnel.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.status]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}