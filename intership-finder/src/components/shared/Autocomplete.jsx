import React, { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../config';

const COMMON_ROLES = [
  "Software Engineer Intern", "Frontend Engineer Intern", "Backend Engineer Intern",
  "Fullstack Engineer Intern", "Mobile App Developer Intern", "Data Science Intern",
  "Machine Learning Intern", "AI Research Intern", "Product Management Intern",
  "UX/UI Design Intern", "Cybersecurity Intern", "Cloud Engineer Intern",
  "Data Analyst Intern", "DevOps Intern", "Systems Engineer Intern"
];

const TECH_CITIES = [
  "San Francisco, CA", "New York, NY", "Seattle, WA", "Austin, TX", "Boston, MA",
  "Palo Alto, CA", "Mountain View, CA", "Sunnyvale, CA", "San Jose, CA", "Los Angeles, CA",
  "Los Altos, CA", "Los Altos Hills, CA", "Los Gatos, CA", "Los Alamitos, CA",
  "Los Feliz, CA", "Los Banos, CA", "Los Osos, CA",
  "Chicago, IL", "Atlanta, GA", "Denver, CO", "Washington, D.C.", "San Diego, CA",
  "London, UK", "Berlin, Germany", "Paris, France", "Amsterdam, Netherlands", "Dublin, Ireland",
  "Stockholm, Sweden", "Toronto, Canada", "Vancouver, Canada", "Waterloo, Canada", "Montreal, Canada",
  "Bangalore, India", "Hyderabad, India", "Singapore", "Sydney, Australia", "Tokyo, Japan",
  "Tel Aviv, Israel", "Seoul, South Korea", "Remote"
];

const rankSuggestions = (items, query) => {
  const q = query.trim().toLowerCase();
  if (!q) return items;

  return [...items].sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    const aStarts = aLower.startsWith(q);
    const bStarts = bLower.startsWith(q);
    if (aStarts !== bStarts) return aStarts ? -1 : 1;

    const aWordStarts = aLower.split(/[\s,/-]+/).some((part) => part.startsWith(q));
    const bWordStarts = bLower.split(/[\s,/-]+/).some((part) => part.startsWith(q));
    if (aWordStarts !== bWordStarts) return aWordStarts ? -1 : 1;

    const aIndex = aLower.indexOf(q);
    const bIndex = bLower.indexOf(q);
    if (aIndex !== bIndex) return aIndex - bIndex;

    return a.localeCompare(b);
  });
};

const Autocomplete = ({ type, value, onChange, placeholder, className }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const wrapperRef = useRef(null);

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
      setNoResults(false);

      if (!value || value.length < 2 || !show) {
        setSuggestions([]);
        return;
      }

      // Local matches always instant
      const list = type === 'job' ? COMMON_ROLES : TECH_CITIES;
      const localMatches = rankSuggestions(
        list.filter(item => item.toLowerCase().includes(value.toLowerCase())),
        value
      );

      if (type === 'job') {
        setSuggestions(localMatches.slice(0, 6));
        setNoResults(localMatches.length === 0);
        return;
      }

      // Show ranked local matches immediately for city search while remote results load.
      setSuggestions(localMatches.slice(0, 7));
      setNoResults(false);

      setLoading(true);
      try {
        // Proxy call to backend to avoid browser blocks
        const url = `${API_BASE}/cities?q=${encodeURIComponent(value)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        const apiResults = rankSuggestions(
          (data._embedded?.['city:search-results'] || [])
            .map((item) => item.matching_full_name || item?.matching_alternate_names?.[0]?.name || "")
            .filter(Boolean),
          value
        );

        const combined = rankSuggestions(Array.from(new Set([...localMatches, ...apiResults])), value);
        setSuggestions(combined.slice(0, 7));
        setNoResults(combined.length === 0);
      } catch {
        setSuggestions(localMatches.slice(0, 7));
        setNoResults(localMatches.length === 0);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchData, type === 'job' ? 10 : 350); 
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
          {loading && suggestions.length === 0 ? (
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
