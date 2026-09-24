import React, { useState, useRef, useEffect, useMemo } from "react";
import "./SearchableSelect.css";

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  className = "",
  style = {},
  compact = false,
  searchPlaceholder = "Type to search...",
  id,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Normalize options to uniform array of { value, label }
  const normalizedOptions = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === "object" && opt !== null) {
        return {
          value: opt.value !== undefined ? opt.value : opt.symbol || opt.name || "",
          label: opt.label !== undefined ? String(opt.label) : String(opt.value || opt.symbol || opt.name || ""),
        };
      }
      return {
        value: opt,
        label: String(opt),
      };
    });
  }, [options]);

  // Current selected label
  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => String(opt.value) === String(value));
  }, [normalizedOptions, value]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) {
      return normalizedOptions;
    }
    const q = searchQuery.toLowerCase().trim();
    return normalizedOptions.filter((opt) =>
      opt.label.toLowerCase().includes(q) || String(opt.value).toLowerCase().includes(q)
    );
  }, [normalizedOptions, searchQuery]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  const handleSelect = (optValue) => {
    if (disabled) return;
    if (onChange) {
      // Support standard event signature (e.target.value) and direct value
      onChange({
        target: { value: optValue },
      });
    }
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setSearchQuery("");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex].value);
      }
    }
  };

  // Limit rendered items in dropdown to 200 for peak smooth 60fps rendering
  const displayedOptions = useMemo(() => {
    return filteredOptions.slice(0, 200);
  }, [filteredOptions]);

  return (
    <div
      ref={containerRef}
      className={`searchable-select-container ${compact ? "compact" : ""} ${className}`}
      style={style}
      id={id}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <div
        className={`searchable-select-trigger ${isOpen ? "open" : ""} ${disabled ? "disabled" : ""}`}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={`searchable-select-value ${!selectedOption ? "searchable-select-placeholder" : ""}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="searchable-select-arrow">▼</span>
      </div>

      {/* Popover Dropdown */}
      {isOpen && !disabled && (
        <div className="searchable-select-dropdown">
          <div className="searchable-select-search-wrap">
            <span className="searchable-select-search-icon">🔍</span>
            <input
              ref={searchInputRef}
              type="text"
              className="searchable-select-search-input"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              onClick={(e) => e.stopPropagation()}
            />
            {searchQuery && (
              <button
                type="button"
                className="searchable-select-search-clear"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchQuery("");
                  if (searchInputRef.current) searchInputRef.current.focus();
                }}
              >
                ✕
              </button>
            )}
          </div>

          <ul ref={listRef} className="searchable-select-options" role="listbox">
            {displayedOptions.length === 0 ? (
              <li className="searchable-select-empty">No matching options found</li>
            ) : (
              displayedOptions.map((opt, index) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = index === highlightedIndex;

                return (
                  <li
                    key={`${opt.value}-${index}`}
                    className={`searchable-select-option ${isSelected ? "selected" : ""} ${
                      isHighlighted ? "highlighted" : ""
                    }`}
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <span className="searchable-select-option-check">✓</span>}
                  </li>
                );
              })
            )}
            {filteredOptions.length > 200 && (
              <li
                style={{
                  padding: "6px 12px",
                  fontSize: "11px",
                  color: "#94a3b8",
                  textAlign: "center",
                  borderTop: "1px solid #f1f5f9",
                }}
              >
                Showing top 200 of {filteredOptions.length} results. Type to refine search.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
