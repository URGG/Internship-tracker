import React, { useState, useEffect } from 'react';
import './KanbanBoard.css';

const API_BASE = "https://internship-tracker-1-9w2v.onrender.com/api";
const COLUMNS = ["To Apply", "Applied", "Interview", "Offer", "Rejected"];

const KanbanBoard = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await fetch(`${API_BASE}/jobs`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (response.ok) {
        const data = await response.json();
        setJobs(data);
      }
    } catch (error) {
      console.error("API Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e, jobId) => {
    e.dataTransfer.setData("jobId", jobId);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); 
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    const jobId = parseInt(e.dataTransfer.getData("jobId"));
    
    const jobToMove = jobs.find(j => j.id === jobId);
    if (!jobToMove || jobToMove.status === newStatus) return;

    // Optimistic Update
    const updatedJobs = jobs.map(job => 
      job.id === jobId ? { ...job, status: newStatus } : job
    );
    setJobs(updatedJobs);

    try {
      await fetch(`${API_BASE}/jobs/${jobId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ ...jobToMove, status: newStatus }) 
      });
    } catch (err) {
      console.error("Failed to sync move to database", err);
      fetchJobs(); // Revert on failure
    }
  };

  const openAppPage = (link) => {
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  };

  if (loading) return <div className="kanban-container"><h1>Waking up server...</h1></div>;

  return (
    <div className="kanban-container">
      <header className="kanban-header">
        <h1>My Internship Pipeline</h1>
        <p>Manage your  applications</p>
      </header>

      <div className="kanban-board">
        {COLUMNS.map(col => (
          <div 
            key={col} 
            className="kanban-column"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col)}
          >
            <div className="column-header">
              <h2>{col}</h2>
              <span className="column-count">
                {jobs.filter(j => j.status === col).length}
              </span>
            </div>

            <div className="column-body">
              {jobs.filter(j => j.status === col).map(job => (
                <div 
                  key={job.id} 
                  className="job-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, job.id)}
                  onClick={() => openAppPage(job.link)}
                >
                  <h3 className="job-role">{job.role}</h3>
                  <p className="job-company">{job.company}</p>
                  <div className="job-tags">
                    <span className="tag">📍 {job.location || 'Remote'}</span>
                    {job.remote && <span className="tag remote">Remote</span>}
                  </div>
                  {job.link && (
                    <div className="link-icon">
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