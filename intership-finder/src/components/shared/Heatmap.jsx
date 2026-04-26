import React, { useMemo } from 'react';

const Heatmap = ({ apps }) => {
  const { grid, months } = useMemo(() => {
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 364); // Last 365 days including today
    
    // Align to the start of the week (Sunday = 0)
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    const dateMap = {};
    apps.forEach(app => {
      if (app.applied_date) {
        dateMap[app.applied_date] = (dateMap[app.applied_date] || 0) + 1;
      }
    });

    const grid = [];
    const months = [];
    let currentMonth = -1;

    for (let i = 0; i < 371; i++) { // ~53 weeks
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const count = dateMap[dateStr] || 0;
      
      const month = date.getMonth();
      if (month !== currentMonth) {
        if (i % 7 === 0 || grid.length < 7) { // Only add month label if it's roughly the start of a column
            months.push({ name: date.toLocaleString('default', { month: 'short' }), index: Math.floor(i / 7) });
            currentMonth = month;
        }
      }

      grid.push({
        date: dateStr,
        count,
        level: count === 0 ? 0 : count < 2 ? 1 : count < 4 ? 2 : count < 6 ? 3 : 4
      });
    }

    return { grid, months };
  }, [apps]);

  const getColor = (level) => {
    switch (level) {
      case 0: return 'var(--s2)';
      case 1: return 'rgba(52, 211, 153, 0.2)';
      case 2: return 'rgba(52, 211, 153, 0.45)';
      case 3: return 'rgba(52, 211, 153, 0.7)';
      case 4: return 'var(--grn)';
      default: return 'var(--s2)';
    }
  };

  return (
    <div style={{ marginTop: '20px', padding: '10px 0', overflowX: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: '700px' }}>
        
        {/* Month Labels */}
        <div style={{ position: 'relative', height: '16px', marginLeft: '30px', marginBottom: '4px' }}>
          {months.map((m, i) => (
            <span key={i} style={{ 
              position: 'absolute', 
              left: `${m.index * 14}px`, 
              fontSize: '10px', 
              color: 'var(--txt3)', 
              fontFamily: 'var(--mono)' 
            }}>
              {m.name}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {/* Day Labels */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '4px 0', fontSize: '9px', color: 'var(--txt3)', fontFamily: 'var(--mono)', width: '20px' }}>
            <span>Mon</span>
            <span>Wed</span>
            <span>Fri</span>
          </div>

          {/* The Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateRows: 'repeat(7, 11px)', 
            gridAutoFlow: 'column', 
            gridAutoColumns: '11px', 
            gap: '3px' 
          }}>
            {grid.map((day, i) => (
              <div 
                key={i} 
                title={`${day.date}: ${day.count} applications`}
                style={{ 
                  width: '11px', 
                  height: '11px', 
                  backgroundColor: getColor(day.level), 
                  borderRadius: '2px',
                  transition: 'transform 0.1s ease'
                }}
                onMouseOver={(e) => e.target.style.transform = 'scale(1.2)'}
                onMouseOut={(e) => e.target.style.transform = 'scale(1.0)'}
              />
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', marginTop: '12px', fontSize: '10px', color: 'var(--txt3)', fontFamily: 'var(--mono)' }}>
          <span>Less</span>
          {[0, 1, 2, 3, 4].map(l => (
            <div key={l} style={{ width: '10px', height: '10px', backgroundColor: getColor(l), borderRadius: '2px' }} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
};

export default Heatmap;
