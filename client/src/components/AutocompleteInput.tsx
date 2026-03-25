import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";

interface AutocompleteInputProps {
    category: "diagnosis" | "medication" | "lab_test" | "procedure" | "complaint";
    value: string;
    onChange: (value: string) => void;
    onSelect?: (term: string) => void;
    placeholder?: string;
    className?: string;
}

export default function AutocompleteInput({
    category,
    value,
    onChange,
    onSelect,
    placeholder,
    className = "",
}: AutocompleteInputProps) {
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        if (value.length < 1) {
            setSuggestions([]);
            setShowDropdown(false);
            return;
        }

        // Debounce search
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            try {
                const results = await api.autocomplete.search(category, value);
                setSuggestions(results);
                setShowDropdown(results.length > 0);
                setActiveIndex(-1);
            } catch {
                setSuggestions([]);
            }
        }, 150);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [value, category]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(e.target as Node)
            ) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showDropdown || suggestions.length === 0) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === "Enter" && activeIndex >= 0) {
            e.preventDefault();
            selectTerm(suggestions[activeIndex].term);
        } else if (e.key === "Escape") {
            setShowDropdown(false);
        }
    };

    const selectTerm = (term: string) => {
        onChange(term);
        setShowDropdown(false);
        setSuggestions([]);
        onSelect?.(term);
    };

    return (
        <div className="relative">
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                    if (suggestions.length > 0) setShowDropdown(true);
                }}
                placeholder={placeholder}
                className={`w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition outline-none ${className}`}
            />

            {showDropdown && suggestions.length > 0 && (
                <div ref={dropdownRef} className="autocomplete-dropdown">
                    {suggestions.map((s, i) => (
                        <div
                            key={s.id}
                            className={`autocomplete-item ${i === activeIndex ? "active" : ""}`}
                            onClick={() => selectTerm(s.term)}
                            onMouseEnter={() => setActiveIndex(i)}
                        >
                            <span>{s.term}</span>
                            <span className="text-sm text-gray-400 ml-2">
                                ({s.usageCount}×)
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
