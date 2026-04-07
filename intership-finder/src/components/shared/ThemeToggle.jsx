import { useState, useEffect } from "react";

export default function ThemeToggle() {
  const [isLightMode, setIsLightMode] = useState(false);

  useEffect(() => {
    // Toggles the class on the global body tag
    if (isLightMode) {
      document.body.classList.add("light-mode");
    } else {
      document.body.classList.remove("light-mode");
    }
  }, [isLightMode]);

  return (
    <button 
      onClick={() => setIsLightMode(!isLightMode)}
      style={{
        padding: "8px 14px",
        borderRadius: "8px",
        cursor: "pointer",
        // The button inverses itself automatically
        backgroundColor: isLightMode ? "#000000" : "#ffffff",
        color: isLightMode ? "#ffffff" : "#000000",
        border: "none",
        fontWeight: "600",
        fontFamily: "'Cabinet Grotesk', sans-serif",
        marginLeft: "auto" // Pushes it to the far right of whatever container it's in
      }}
    >
      {isLightMode ? "Dark Mode" : "Light Mode"}
    </button>
  );
}