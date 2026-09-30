"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Search, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PremiumDropdownProps, DropdownOption } from "@/types/filter.types";

const variantConfig = {
  default: {
    content: "min-w-[200px]",
    maxHeight: "max-h-60",
    padding: "p-1",
    searchPadding: "p-3",
  },
  compact: {
    content: "min-w-[140px]",
    maxHeight: "max-h-48",
    padding: "p-1",
    searchPadding: "p-2",
  },
};

export function PremiumDropdown({
  value,
  onChange,
  options,
  placeholder,
  loading = false,
  error,
  icon: Icon,
  searchable = false,
  variant = "default",
}: PremiumDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [openUpward, setOpenUpward] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const variantStyles = variantConfig[variant];

  const filteredOptions =
    searchable && searchQuery
      ? options.filter((option) =>
          String(option?.label || option?.value || "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
        )
      : options;

  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(event.target as Node) &&
        !triggerRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
        setFocusedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;

      const estimatedHeight = searchable ? 300 : 260;
      setOpenUpward(
        spaceBelow < estimatedHeight && spaceAbove > estimatedHeight
      );

      if (searchable && searchInputRef.current) {
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
    }
  }, [isOpen, searchable]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen) {
      if (
        event.key === "Enter" ||
        event.key === " " ||
        event.key === "ArrowDown"
      ) {
        event.preventDefault();
        setIsOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        setIsOpen(false);
        setSearchQuery("");
        setFocusedIndex(-1);
        triggerRef.current?.focus();
        break;
      case "ArrowDown":
        event.preventDefault();
        setFocusedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        event.preventDefault();
        setFocusedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case "Enter":
        event.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
          const option = filteredOptions[focusedIndex];
          if (!option.disabled) {
            handleSelect(option);
          }
        }
        break;
      case "Tab":
        setIsOpen(false);
        setSearchQuery("");
        setFocusedIndex(-1);
        break;
    }
  };

  const handleSelect = (option: DropdownOption) => {
    onChange(option.value);
    setIsOpen(false);
    setSearchQuery("");
    setFocusedIndex(-1);
    triggerRef.current?.focus();
  };

  const handleClear = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onChange(null);
  };

  return (
    <div className="relative z-10">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={loading}
        className={cn(
          "group relative w-full flex items-center justify-between border transition-all duration-200",
          variant === "compact"
            ? "rounded-full px-3 py-2 text-xs font-bold"
            : "rounded-xl px-4 py-3 text-sm font-medium",
          value
            ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 animate-subtle-glow"
            : "bg-background/60 hover:bg-primary/10 hover:text-primary border-border/50 hover:border-primary/30 hover:shadow-sm hover:scale-[1.02]",
          "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50",
          isOpen && "border-primary/50 ring-2 ring-primary/20",
          error &&
            "border-destructive focus:border-destructive focus:ring-destructive/20",
          loading && "opacity-50 cursor-not-allowed"
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={placeholder}
      >
        {value && (
          <motion.div
            className={cn(
              "absolute inset-0 bg-gradient-to-r from-white/20 via-white/10 to-transparent",
              variant === "compact" ? "rounded-full" : "rounded-xl"
            )}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        )}

        <div className="relative z-10 flex items-center gap-2 flex-1 min-w-0">
          {Icon && (
            <Icon
              className={cn(
                "flex-shrink-0 transition-colors duration-200",
                value
                  ? "text-current"
                  : "text-muted-foreground group-hover:text-primary",
                variant === "compact" ? "w-3.5 h-3.5" : "w-4 h-4"
              )}
            />
          )}

          <span
            className={cn(
              "truncate text-left transition-colors duration-200",
              selectedOption
                ? ""
                : "text-muted-foreground group-hover:text-primary"
            )}
          >
            {selectedOption?.label || placeholder}
          </span>
        </div>

        <div className="relative z-10 flex items-center gap-1 flex-shrink-0 ml-2">
          {value && !loading && (
            <motion.div
              onClick={handleClear}
              className={cn(
                "p-0.5 rounded-md transition-colors cursor-pointer",
                value
                  ? "hover:bg-white/20 text-current hover:text-current"
                  : "hover:bg-primary/10 hover:text-primary text-muted-foreground"
              )}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-3 h-3" />
            </motion.div>
          )}

          {loading ? (
            <motion.div
              className={cn(
                "w-4 h-4 border-2 border-t-transparent rounded-full",
                value ? "border-current" : "border-muted-foreground"
              )}
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          ) : (
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className={value ? "text-current" : "text-muted-foreground"}
            >
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          )}
        </div>
      </button>

      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={contentRef}
            initial={{ opacity: 0, y: openUpward ? 10 : -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUpward ? 10 : -10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "absolute z-[100] rounded-xl border bg-popover shadow-xl",
              "backdrop-blur-xl bg-background/95 border-border/50",
              openUpward ? "bottom-full mb-2" : "top-full mt-2",
              variantStyles.content,
              "shadow-2xl shadow-black/10 dark:shadow-black/20"
            )}
            style={{ minWidth: triggerRef.current?.offsetWidth || "auto" }}
          >
            {searchable && (
              <div
                className={cn(
                  "border-b border-border/50",
                  variantStyles.searchPadding
                )}
              >
                <div className="relative">
                  <Search
                    className={cn(
                      "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground",
                      variant === "compact" ? "w-3 h-3" : "w-3.5 h-3.5"
                    )}
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setFocusedIndex(0);
                    }}
                    placeholder="Search options..."
                    className={cn(
                      "w-full pl-9 pr-3 rounded-lg bg-muted/50 border-0 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-background transition-all",
                      variant === "compact" ? "h-7 text-xs" : "h-8 text-sm"
                    )}
                  />
                </div>
              </div>
            )}

            <div
              className={cn(
                "overflow-y-auto",
                variantStyles.maxHeight,
                variantStyles.padding
              )}
            >
              {filteredOptions.length === 0 ? (
                <div
                  className={cn(
                    "text-muted-foreground text-center",
                    variant === "compact"
                      ? "px-2 py-1.5 text-xs"
                      : "px-3 py-2 text-sm"
                  )}
                >
                  {searchQuery ? "No options found" : "No options available"}
                </div>
              ) : (
                filteredOptions.map((option, index) => (
                  <motion.button
                    key={option.value}
                    type="button"
                    onClick={() => !option.disabled && handleSelect(option)}
                    className={cn(
                      "w-full flex items-center gap-2 rounded-lg transition-all duration-200",
                      "text-left hover:bg-primary/10 hover:text-primary focus:outline-none focus:bg-primary/10 focus:text-primary hover:scale-[1.01]",
                      variant === "compact"
                        ? "px-2 py-1.5 text-xs"
                        : "px-3 py-2 text-sm",
                      option.value === value &&
                        "bg-primary/10 text-primary font-medium",
                      focusedIndex === index && "bg-muted/80",
                      option.disabled &&
                        "opacity-50 cursor-not-allowed hover:bg-transparent",
                      !option.disabled && "hover:shadow-sm"
                    )}
                    disabled={option.disabled}
                    onMouseEnter={() => setFocusedIndex(index)}
                    onMouseLeave={() => setFocusedIndex(-1)}
                    whileHover={!option.disabled ? { x: 2 } : undefined}
                  >
                    {option.icon && (
                      <option.icon
                        className={cn(
                          "flex-shrink-0 text-muted-foreground",
                          variant === "compact" ? "w-3.5 h-3.5" : "w-4 h-4"
                        )}
                      />
                    )}

                    <span className="flex-1 truncate">
                      {option.label || option.value || ""}
                    </span>

                    {option.value === value && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-primary"
                      >
                        <Check
                          className={cn(
                            variant === "compact" ? "w-3.5 h-3.5" : "w-4 h-4"
                          )}
                        />
                      </motion.div>
                    )}
                  </motion.button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PremiumDropdown;
