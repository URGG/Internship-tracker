import React, { useState, useEffect, useRef } from 'react';

const COMMON_ROLES = [
  "Software Engineer Intern",
  "Frontend Engineer Intern",
  "Backend Engineer Intern",
  "Fullstack Engineer Intern",
  "Mobile App Developer Intern",
  "Data Science Intern",
  "Machine Learning Intern",
  "AI Research Intern",
  "Product Management Intern",
  "UX/UI Design Intern",
  "Cybersecurity Intern",
  "Cloud Engineer Intern",
  "Data Analyst Intern"
];

const Autocomplete = ({ type, value, onChange, placeholder, className }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const wrapperRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShow(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      // Clear previous results while searching
      setNoResults(false);

      if (!value || value.length < 2 || !show) {
        setSuggestions([]);
        return;
      }

      if (type === 'job') {
        const filtered = COMMON_ROLES.filter(role => 
          role.toLowerCase().includes(value.toLowerCase())
        );
        setSuggestions(filtered.slice(0, 6));
        setNoResults(filtered.length === 0);
        return;
      }

      setLoading(true);
      try {
        // Try a 5-second timeout for the fetch
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const url = `https://api.teleport.org/api/cities/?search=${encodeURIComponent(value)}`;
        const response = await fetch(url, { signal: controller.signal });
        const data = await response.json();
        clearTimeout(timeout);
        
        // Defensive parsing of Teleport API structure
        let results = [];
        if (data && data._embedded && data._embedded['city:search-results']) {
          results = data._embedded['city:search-results'].map(i => i.matching_full_name);
        } else if (Array.isArray(data)) {
           // Some APIs return a flat array
           results = data;
        }

        setSuggestions(results.slice(0, 5));
        setNoResults(results.length === 0);
      } catch (err) {
        console.error("Autocomplete fetch error:", err);
        setNoResults(true);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchData, type === 'job' ? 50 : 500); 
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
        style={{ width: '100%' }}
      />
      
      {show && (loading || suggestions.length > 0 || noResults) && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 5px)',
          left: 0,
          right: 0,
          zIndex: 999999,
          background: '#2c2c2c',
          border: '1px solid #444',
          borderRadius: '8px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
          overflow: 'hidden'
        }}>
          {loading ? (
            <div style={{ padding: '12px 16px', color: '#aaa', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="spin" style={{ width: 14, height: 14 }}></div>
              Searching...
            </div>
          ) : noResults ? (
            <div style={{ padding: '12px 16px', color: '#777', fontSize: '13px' }}>
              No matches found
            </div>
          ) : (
            suggestions.map((item, index) => (
              <div 
                key={index} 
                onClick={() => handleSelect(item)}
                style={{
                  padding: '12px 16px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  color: '#eee',
                  borderBottom: index === suggestions.length - 1 ? 'none' : '1px solid #3a3a3a',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#444'}
                onMouseOut={(e) => e.target.style.background = 'transparent'}
              >
                {item}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Autocomplete;
