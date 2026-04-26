import React, { useState, useEffect, useRef } from 'react';

/**
 * A reusable autocomplete input component.
 * @param {string} type - "city" or "job"
 * @param {string} value - Current value
 * @param {function} onChange - Callback when value changes
 * @param {string} placeholder - Input placeholder
 * @param {string} className - Optional CSS class
 */
const Autocomplete = ({ type, value, onChange, placeholder, className }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

  // Close suggestions when clicking outside
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
      // Only search if we have at least 3 characters
      if (!value || value.length < 3 || !show) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      try {
        let url = '';
        if (type === 'city') {
          url = `https://api.teleport.org/api/cities/?search=${encodeURIComponent(value)}`;
        } else {
          // Fallback to a different job API or just use Teleport for cities for now
          // as dataatwork is sometimes unstable. For now, let's focus on Cities.
          // If you have a specific Job API key, we can swap this.
          return; 
        }

        const response = await fetch(url);
        const data = await response.json();

        if (type === 'city') {
          const results = data._embedded?.['city:search-results']?.map(i => i.matching_full_name) || [];
          setSuggestions(results.slice(0, 5));
        }
      } catch (err) {
        console.error("Autocomplete error:", err);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchData, 300);
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
        autoComplete="off"
      />
      
      {show && (suggestions.length > 0 || loading) && (
        <ul style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 1000,
          background: 'var(--s2)',
          border: '1px solid var(--b0)',
          borderRadius: 'var(--r)',
          marginTop: '4px',
          listStyle: 'none',
          padding: '4px 0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          {loading && (
            <li style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--txt3)' }}>Searching...</li>
          )}
          {!loading && suggestions.map((item, index) => (
            <li 
              key={index} 
              onClick={() => handleSelect(item)}
              style={{
                padding: '8px 12px',
                fontSize: '12px',
                cursor: 'pointer',
                color: 'var(--txt)',
                borderBottom: index === suggestions.length - 1 ? 'none' : '1px solid var(--b0)'
              }}
              onMouseOver={(e) => e.target.style.background = 'var(--s3)'}
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
