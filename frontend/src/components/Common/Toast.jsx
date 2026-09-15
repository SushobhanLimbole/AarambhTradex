import React, { useEffect } from "react";
import "./Toast.css";

export default function Toast({ message, type = "success", onClose, duration = 3000 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const icons = {
    success: "✅",
    error: "❌",
    info: "ℹ️",
  };

  return (
    <div className="toast-container">
      <div className={`toast-item ${type}`}>
        <span className="toast-icon">{icons[type] || "ℹ️"}</span>
        <div className="toast-content">{message}</div>
        <button className="toast-close" onClick={onClose} aria-label="Close toast">
          ✕
        </button>
      </div>
    </div>
  );
}
