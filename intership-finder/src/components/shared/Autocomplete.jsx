import React, { useState, useEffect, useRef } from 'react';

const COMMON_ROLES = [
  "Software Engineer Intern",
  "Frontend Engineer Intern",
  "Backend Engineer Intern",
  "Fullstack Engineer Intern",
  "Mobile App Developer Intern",
  "iOS Developer Intern",
  "Android Developer Intern",
  "Data Science Intern",
  "Machine Learning Intern",
  "AI Research Intern",
  "Product Management Intern",
  "UX/UI Design Intern",
  "Cybersecurity Intern",
  "Cloud Engineer Intern",
  "DevOps Intern",
  "Data Analyst Intern",
  "Systems Engineer Intern",
  "Embedded Systems Intern",
  "Game Developer Intern",
  "Web Developer Intern",
  "QA Engineer Intern",
  "Hardware Engineer Intern",
  "Project Management Intern",
  "Digital Marketing Intern"
];

const Autocomplete = ({ type, value, onChange, placeholder, className }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShow(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  useEffect(() => {
    const fetchData = async () => {
      if (!value || value.length < 2 || !show) {
        setSuggestions([]);
        return;
      }

      if (type === 'job') {
        // Local filtering for job titles
        const filtered = COMMON_ROLES.filter(role => 
          role.toLowerCase().includes(value.toLowerCase())
        );
        setSuggestions(filtered.slice(0, 6));
        return;
      }

      // City Search via Teleport API
      setLoading(true);
      try {
        const url = `https://api.teleport.org/api/cities/?search=${encodeURIComponent(value)}`;
        const response = await fetch(url);
        const data = await response.json();
        const results = data._embedded?.['city:search-results']?.map(i => i.matching_full_name) || [];
        setSuggestions(results.slice(0, 5));
      } catch (err) {
        console.error("Autocomplete error:", err);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchData, type === 'job' ? 50 : 400); 
    return () => clearTimeout(timeoutId);
  }, [value, type, show]);

  const handleSelect = (item) => {
    onChange({ target: { value: item } });
    setSuggestions([]);
    setShow(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        className={className || "finp"}
        value={value}
        onChange={(e) => {
          onChange(e);
          setShow(true);
        }}
        onFocus={() => setShow(true)}
        placeholder={placeholder}
        autoComplete="new-password" 
      />
      
      {show && (suggestions.length > 0 || loading) && (
        <ul style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 9999,
          background: 'var(--s1)',
          border: '1px solid var(--b1)',
          borderRadius: 'var(--r)',
          marginTop: '6px',
          listStyle: 'none',
          padding: '4px 0',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          maxHeight: '220px',
          overflowY: 'auto'
        }}>
          {loading ? (
            <li style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--txt3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="spin" style={{ width: 12, height: 12 }}></div> Searching...
            </li>
          ) : suggestions.map((item, index) => (
            <li 
              key={index} 
              onClick={() => handleSelect(item)}
              style={{
                padding: '10px 14px',
                fontSize: '12px',
                cursor: 'pointer',
                color: 'var(--txt)',
                transition: 'background 0.1s'
              }}
              onMouseOver={(e) => e.target.style.background = 'var(--s2)'}
              onMouseOut={(e) => e.target.style.background = 'transparent'}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Autocomplete;
