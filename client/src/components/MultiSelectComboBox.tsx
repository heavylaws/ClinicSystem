import { useState, useEffect, useRef } from "react";
import { Search, X, CheckSquare } from "lucide-react";
import { api } from "../lib/api";

interface MultiSelectComboBoxProps {
    category: "diagnosis" | "medication" | "lab_test" | "procedure" | "complaint";
    selectedItems: string[];
    onChange: (items: string[]) => void;
    placeholder?: string;
    className?: string;
}

export default function MultiSelectComboBox({
    category,
    selectedItems,
    onChange,
    placeholder = "Select options...",
    className = "",
}: MultiSelectComboBoxProps) {
    const [inputValue, setInputValue] = useState("");
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);

    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // Fetch suggestions based on input or focus
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(async () => {
            try {
                let results = [];
                if (inputValue.trim().length === 0) {
                    // Fetch popular terms when input is empty
                    results = await api.autocomplete.popular(category);
                } else {
                    // Search terms when input is provided
                    results = await api.autocomplete.search(category, inputValue);
                }

                // Filter out already selected items
                const filteredResults = results.filter((r: any) => !selectedItems.includes(r.term));

                // If the exact typed value isn't in results & isn't selected, add it as a "Create new" option
                // We'll simulate it by ensuring the typed text is always an option if not present
                const exactMatch = results.find((r: any) => r.term.toLowerCase() === inputValue.toLowerCase());
                const isSelected = selectedItems.some(i => i.toLowerCase() === inputValue.toLowerCase());

                let finalResults = filteredResults;
                if (!exactMatch && !isSelected && inputValue.trim()) {
                    finalResults = [{ id: 'new', term: inputValue, usageCount: 0, isNew: true }, ...filteredResults];
                }

                setSuggestions(finalResults);

                // Update active index but DO NOT auto-close the modal
                setActiveIndex(-1);
            } catch {
                setSuggestions([]);
            }
        }, 150);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [inputValue, category, selectedItems]);



    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Backspace" && inputValue === "" && selectedItems.length > 0) {
            // Remove last item on backspace if input is empty
            const newItems = [...selectedItems];
            newItems.pop();
            onChange(newItems);
            return;
        }

        if (!showDropdown || suggestions.length === 0) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (activeIndex >= 0) {
                selectTerm(suggestions[activeIndex].term);
            } else if (inputValue.trim()) {
                // If they press enter with typed text but no selection, add it
                selectTerm(inputValue.trim());
            }
        } else if (e.key === "Escape") {
            setShowDropdown(false);
        }
    };

    const selectTerm = (term: string) => {
        if (!selectedItems.includes(term)) {
            onChange([...selectedItems, term]);
        }
        setInputValue("");
        setSuggestions([]);
        inputRef.current?.focus();
    };

    const removeItem = (termToRemove: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        onChange(selectedItems.filter(item => item !== termToRemove));
        inputRef.current?.focus();
    };

    return (
        <>
            <div className="relative">
                <div
                    className={`w-full min-h-[52px] border-2 border-gray-200 rounded-lg px-3 py-2 flex flex-wrap gap-2 items-center hover:border-primary-400 transition bg-white cursor-pointer ${className}`}
                    onClick={() => setShowDropdown(true)}
                >
                    {selectedItems.map((item) => (
                        <span
                            key={item}
                            className="inline-flex items-center gap-1.5 bg-primary-50 text-primary-700 px-2.5 py-1 rounded-md text-sm font-semibold border border-primary-100"
                        >
                            {item}
                            <button
                                type="button"
                                onClick={(e) => removeItem(item, e)}
                                className="text-primary-400 hover:text-danger-500 transition-colors focus:outline-none"
                            >
                                ✕
                            </button>
                        </span>
                    ))}
                    {selectedItems.length === 0 && (
                        <span className="text-gray-400 text-lg px-2 flex-1">{placeholder}</span>
                    )}
                </div>
            </div>

            {/* Modal Overlay */}
            {showDropdown && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6" onClick={() => setShowDropdown(false)}>
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()} // Prevent clicks inside from closing
                    >
                        {/* Header & Search */}
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-3xl font-extrabold text-gray-800 capitalize">
                                    Select {category.replace("_", " ")}
                                </h2>
                                <button
                                    onClick={() => setShowDropdown(false)}
                                    className="p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-700 rounded-full transition"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Search className="text-gray-400" size={20} />
                                </div>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Search or type to add new..."
                                    className="w-full bg-white border-2 border-gray-200 text-gray-800 rounded-xl pl-12 pr-4 py-5 text-xl focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition shadow-sm"
                                    autoFocus
                                />
                            </div>

                            {/* Selected Tags Display */}
                            {selectedItems.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {selectedItems.map((item) => (
                                        <span
                                            key={item}
                                            className="inline-flex items-center gap-1.5 bg-primary-100 text-primary-800 px-4 py-2 rounded-lg text-base font-bold border border-primary-200"
                                        >
                                            {item}
                                            <button
                                                type="button"
                                                onClick={(e) => removeItem(item, e)}
                                                className="text-primary-500 hover:text-danger-500 transition-colors bg-white/50 rounded-full p-0.5"
                                            >
                                                <X size={14} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Results List */}
                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30">
                            {suggestions.length === 0 && !inputValue ? (
                                <div className="text-center py-10 text-gray-400">
                                    <Search size={48} className="mx-auto mb-4 opacity-20" />
                                    <p className="text-lg">Type to search for {category.replace("_", " ")}</p>
                                </div>
                            ) : suggestions.length === 0 ? (
                                <div className="text-center py-10 text-gray-400">
                                    <p className="text-lg">No results found.</p>
                                    <p className="text-sm mt-2">Press enter to add "{inputValue}"</p>
                                </div>
                            ) : (
                                <div>
                                    {inputValue === "" && (
                                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest pl-2 mb-4">Popular Options</p>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {suggestions.map((s, i) => {
                                            const isAlreadySelected = selectedItems.includes(s.term);
                                            return (
                                                <div
                                                    key={s.id || `new-${s.term}`}
                                                    className={`px-5 py-4 rounded-xl cursor-pointer flex items-start justify-between gap-3 transition-all border min-h-[64px] ${i === activeIndex ? "bg-primary-50 border-primary-200 shadow-sm" : isAlreadySelected ? "bg-primary-50/50 border-primary-100 opacity-70" : "bg-white border-gray-100 hover:border-primary-300 hover:shadow-md"}`}
                                                    onClick={() => !isAlreadySelected && selectTerm(s.term)}
                                                    onMouseEnter={() => setActiveIndex(i)}
                                                >
                                                    <div className="flex items-start gap-3 flex-1 min-w-0 pt-0.5">
                                                        {isAlreadySelected ? (
                                                            <CheckSquare className="text-primary-500 flex-shrink-0 mt-0.5" size={20} />
                                                        ) : (
                                                            <div className={`w-5 h-5 flex-shrink-0 mt-0.5 rounded border-2 ${i === activeIndex ? "border-primary-500" : "border-gray-300"}`}></div>
                                                        )}
                                                        <span className={`text-lg leading-snug break-words ${isAlreadySelected ? "text-primary-700 font-bold" : "text-gray-700 font-semibold"}`}>
                                                            {s.isNew ? (
                                                                <span className="flex items-center gap-2">
                                                                    <span className="text-primary-600 font-bold bg-primary-100 px-2 py-0.5 rounded text-sm whitespace-nowrap">Add New</span>
                                                                    {s.term}
                                                                </span>
                                                            ) : (
                                                                s.term
                                                            )}
                                                        </span>
                                                    </div>
                                                    {!s.isNew && s.usageCount > 0 && (
                                                        <span className="text-xs uppercase tracking-wider text-gray-500 font-bold bg-gray-100 px-3 py-1.5 rounded-full flex-shrink-0 mt-0.5 whitespace-nowrap">
                                                            {s.usageCount} uses
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3">
                            <button
                                onClick={() => setShowDropdown(false)}
                                className="px-8 py-3.5 text-lg font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => setShowDropdown(false)}
                                className="px-10 py-3.5 text-lg font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-lg transition"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
