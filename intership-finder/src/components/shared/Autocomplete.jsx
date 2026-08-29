import { useEffect, useId, useRef, useState } from "react";
import { API_BASE } from "../../config";

const COMMON_ROLES = [
  "Software Engineer Intern",
  "Software Engineering Intern",
  "Frontend Engineer Intern",
  "Backend Engineer Intern",
  "Fullstack Engineer Intern",
  "Mobile App Developer Intern",
  "Web Developer Intern",
  "React Developer Intern",
  "Python Developer Intern",
  "Java Developer Intern",
  "iOS Developer Intern",
  "Android Developer Intern",
  "Data Science Intern",
  "Data Analyst Intern",
  "Machine Learning Intern",
  "AI Research Intern",
  "Product Management Intern",
  "Product Designer Intern",
  "UX/UI Design Intern",
  "User Experience Intern",
  "Cybersecurity Intern",
  "Cloud Engineer Intern",
  "DevOps Intern",
  "Systems Engineer Intern",
  "QA Engineer Intern",
  "Research Intern",
  "Business Analyst Intern",
  "Marketing Intern",
  "Finance Intern",
];

const TECH_CITIES = [
  "San Francisco, CA", "New York, NY", "Seattle, WA", "Austin, TX", "Boston, MA",
  "Palo Alto, CA", "Mountain View, CA", "Sunnyvale, CA", "San Jose, CA", "Los Angeles, CA",
  "Chicago, IL", "Atlanta, GA", "Denver, CO", "Washington, D.C.", "San Diego, CA",
  "London, UK", "Berlin, Germany", "Paris, France", "Amsterdam, Netherlands", "Dublin, Ireland",
  "Stockholm, Sweden", "Toronto, Canada", "Vancouver, Canada", "Waterloo, Canada", "Montreal, Canada",
  "Bangalore, India", "Hyderabad, India", "Singapore", "Sydney, Australia", "Tokyo, Japan",
  "Tel Aviv, Israel", "Seoul, South Korea", "Remote",
];

const rankSuggestions = (items, query) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return items;

  return [...items].sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    const aStarts = aLower.startsWith(normalizedQuery);
    const bStarts = bLower.startsWith(normalizedQuery);
    if (aStarts !== bStarts) return aStarts ? -1 : 1;

    const aWordStarts = aLower.split(/[\s,/-]+/).some((part) => part.startsWith(normalizedQuery));
    const bWordStarts = bLower.split(/[\s,/-]+/).some((part) => part.startsWith(normalizedQuery));
    if (aWordStarts !== bWordStarts) return aWordStarts ? -1 : 1;

    const aIndex = aLower.indexOf(normalizedQuery);
    const bIndex = bLower.indexOf(normalizedQuery);
    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.localeCompare(b);
  });
};

export default function Autocomplete({ type, value, onChange, placeholder, className }) {
  const [suggestions, setSuggestions] = useState([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef(null);
  const listboxId = useId();
  const query = (value || "").trim();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setShow(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, suggestions.length, show]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const fetchSuggestions = async () => {
      if (!show || query.length < 2) {
        if (active) {
          setSuggestions([]);
          setNoResults(false);
          setLoading(false);
        }
        return;
      }

      const list = type === "job" ? COMMON_ROLES : TECH_CITIES;
      const localMatches = rankSuggestions(
        list.filter((item) => item.toLowerCase().includes(query.toLowerCase())),
        query,
      );

      if (type === "job") {
        setSuggestions(localMatches.slice(0, 8));
        setNoResults(localMatches.length === 0);
        setLoading(false);
        return;
      }

      // Keep local matches visible while the city service is queried.
      setSuggestions(localMatches.slice(0, 8));
      setNoResults(false);
      setLoading(true);

      try {
        const response = await fetch(`${API_BASE}/cities?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`City lookup failed (${response.status})`);
        const data = await response.json();
        const remoteMatches = rankSuggestions(
          (data?._embedded?.["city:search-results"] || [])
            .map((item) => item?.matching_full_name || item?.matching_alternate_names?.[0]?.name || "")
            .filter(Boolean),
          query,
        );
        if (!active) return;
        const combined = rankSuggestions([...new Set([...localMatches, ...remoteMatches])], query);
        setSuggestions(combined.slice(0, 8));
        setNoResults(combined.length === 0);
      } catch (error) {
        if (!active || error.name === "AbortError") return;
        // Autocomplete remains useful when the optional city service is down.
        setSuggestions(localMatches.slice(0, 8));
        setNoResults(localMatches.length === 0);
      } finally {
        if (active) setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, type === "job" ? 0 : 300);
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [query, show, type]);

  const handleSelect = (item) => {
    onChange({ target: { value: item } });
    setSuggestions([]);
    setNoResults(false);
    setShow(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      setShow(false);
      return;
    }
    if (!show || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      handleSelect(suggestions[activeIndex]);
    }
  };

  const dropdownVisible = show && (loading || suggestions.length > 0 || noResults);

  return (
    <div ref={wrapperRef} style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        className={className || "finp"}
        value={value}
        onChange={(event) => {
          onChange(event);
          setShow(true);
        }}
        onFocus={() => setShow(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={dropdownVisible}
        aria-activedescendant={dropdownVisible && suggestions[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined}
        style={{ width: "100%" }}
      />

      {dropdownVisible && (
        <div
          id={listboxId}
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 5px)",
            left: 0,
            right: 0,
            zIndex: 999999,
            background: "var(--s2)",
            border: "1px solid var(--b1)",
            borderRadius: "8px",
            boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
            overflow: "hidden",
          }}
        >
          {loading && suggestions.length === 0 ? (
            <div role="status" style={{ padding: "12px 16px", color: "var(--txt2)", fontSize: "13px", display: "flex", alignItems: "center", gap: "10px" }}>
              <div className="spin" style={{ width: 14, height: 14 }} />
              Searching...
            </div>
          ) : noResults ? (
            <div style={{ padding: "12px 16px", color: "var(--txt3)", fontSize: "13px" }}>No matches found</div>
          ) : (
            suggestions.map((item, index) => (
              <div
                id={`${listboxId}-option-${index}`}
                key={`${item}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => {
                  event.preventDefault();
                  handleSelect(item);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                style={{
                  padding: "12px 16px",
                  fontSize: "13px",
                  cursor: "pointer",
                  color: "var(--txt)",
                  background: index === activeIndex ? "var(--s3)" : "transparent",
                  borderBottom: index === suggestions.length - 1 ? "none" : "1px solid var(--b0)",
                  transition: "background 0.2s",
                }}
              >
                {item}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
