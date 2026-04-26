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
  "UX/UI Design Intern"
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
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!value || value.length < 2 || !show) {
        setSuggestions([]);
        return;
      }

      console.log(`Autocomplete fetching for ${type}: "${value}"`);

      if (type === 'job') {
        const filtered = COMMON_ROLES.filter(role => 
          role.toLowerCase().includes(value.toLowerCase())
        );
        console.log("Found job suggestions:", filtered);
        setSuggestions(filtered.slice(0, 6));
        return;
      }

      setLoading(true);
      try {
        const url = `https://api.teleport.org/api/cities/?search=${encodeURIComponent(value)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        // Debugging the response structure
        console.log("Teleport API raw response:", data);

        const results = data._embedded?.['city:search-results']?.map(i => i.matching_full_name) || [];
        console.log("Filtered city results:", results);
        setSuggestions(results.slice(0, 5));
      } catch (err) {
        console.error("Autocomplete fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchData, type === 'job' ? 10 : 300); 
    return () => clearTimeout(timeoutId);
  }, [value, type, show]);

  const handleSelect = (item) => {
    console.log("Selected item:", item);
    onChange({ target: { value: item } });
    setSuggestions([]);
    setShow(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', zIndex: 1000 }}>
      <input
        type="text"
        className={className || "finp"}
        value={value}
        onChange={(e) => {
          onChange(e);
          setShow(true);
        }}
        onFocus={() => {
          console.log("Input focused");
          setShow(true);
        }}
        placeholder={placeholder}
        autoComplete="off"
        style={{ width: '100%' }}
      />
      
      {show && (suggestions.length > 0 || loading) && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 5px)',
          left: 0,
          right: 0,
          zIndex: 99999,
          background: '#2c2c2c', // Hardcoded dark gray for test
          border: '1px solid #555',
          borderRadius: '8px',
          padding: '4px 0',
          boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          {loading ? (
            <div style={{ padding: '10px 15px', color: '#888', fontSize: '12px' }}>Searching cities...</div>
          ) : suggestions.map((item, index) => (
            <div 
              key={index} 
              onClick={() => handleSelect(item)}
              style={{
                padding: '10px 15px',
                fontSize: '13px',
                cursor: 'pointer',
                color: '#eee',
                borderBottom: index === suggestions.length - 1 ? 'none' : '1px solid #333'
              }}
              onMouseOver={(e) => e.target.style.background = '#3d3d3d'}
              onMouseOut={(e) => e.target.style.background = 'transparent'}
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Autocomplete;
