import React, { useState } from 'react';
import './KanbanBoard.css';

const COLUMNS = ["Wishlist", "Applied", "Interview", "Offer", "Rejected"];

// We pass the data in from App.jsx so Add and Search work perfectly!
const KanbanBoard = ({ filtered, setDragId, onDrop, openEdit }) => {
  // NEW: State to track which column is currently being hovered over
  const [hoveredCol, setHoveredCol] = useState(null);
  
  const handleDragStart = (e, jobId) => {
    e.dataTransfer.setData("jobId", jobId);
    setDragId(jobId); // Tell App.jsx which job is moving
  };

  const handleDragOver = (e, colName) => {
    e.preventDefault(); 
    // NEW: Tell React this column is being hovered
    if (hoveredCol !== colName) {
      setHoveredCol(colName);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    // NEW: Turn off the glow when the mouse leaves the column
    setHoveredCol(null);
  };

  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    setHoveredCol(null); // NEW: Turn off the glow when dropped
    onDrop(newStatus); // App.jsx handles the database save!
  };

  const openAppPage = (e, link) => {
    e.stopPropagation(); // Prevents the edit modal from opening when you click the link icon
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    } else {
      alert("No link saved for this application.");
    }
  };

  return (
    <div className="kanban-container">
      <div className="kanban-board">
        {COLUMNS.map(col => (
          <div 
            key={col} 
            /* NEW: Dynamically add the 'drag-over' class if this is the hovered column */
            className={`kanban-column ${hoveredCol === col ? 'drag-over' : ''}`}
            onDragOver={(e) => handleDragOver(e, col)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col)}
          >
            <div className="column-header">
              <h2>{col}</h2>
              <span className="column-count">
                {/* Case-insensitive check brings back missing jobs! */}
                {filtered.filter(j => (j.status || "").toLowerCase() === col.toLowerCase()).length}
              </span>
            </div>

            <div className="column-body">
              {filtered
                .filter(j => (j.status || "").toLowerCase() === col.toLowerCase())
                .map(job => (
                <div 
                  key={job.id} 
                  className="job-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, job.id)}
                  onClick={() => openEdit(job)} // Clicking the card opens your edit modal!
                >
                  <h3 className="job-role">{job.role}</h3>
                  <p className="job-company">{job.company}</p>
                  
                  <div className="job-tags">
                    <span className="tag">
                      <span style={{ color: '#ef4444' }}>📍</span> {job.location || 'Remote'}
                    </span>
                    {job.remote && <span className="tag remote">Remote</span>}
                  </div>

                  {job.link && (
                    <div className="link-icon" onClick={(e) => openAppPage(e, job.link)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KanbanBoard;