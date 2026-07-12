"use client";

import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ToggleEvent } from "react";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  icon: LucideIcon;
  disabled?: boolean;
}

// Without the Popover API, the [popover] attribute hides the element with no way
// to show it; the position:fixed fallback still escapes the modal's overflow.
const supportsPopover = typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype;

export function SelectField({ id, label, value, options, onChange, icon: Icon, disabled }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ query: "", at: 0 });
  const selected = options.find((option) => option.value === value);
  const listboxId = `${id}-listbox`;

  function openMenu() {
    const index = options.findIndex((option) => option.value === value);
    setActiveIndex(index < 0 ? 0 : index);
    setOpen(true);
  }

  function closeMenu(refocus = true) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function choose(option: SelectOption) {
    onChange(option.value);
    closeMenu();
  }

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const trigger = triggerRef.current;
    if (!list || !trigger) return;
    try { list.showPopover?.(); } catch { /* already shown */ }
    const rect = trigger.getBoundingClientRect();
    const gap = 6;
    const height = list.offsetHeight;
    const fitsBelow = rect.bottom + gap + height <= window.innerHeight - 8;
    list.style.minWidth = `${rect.width}px`;
    list.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - list.offsetWidth - 8))}px`;
    list.style.top = `${Math.max(8, fitsBelow ? rect.bottom + gap : rect.top - height - gap)}px`;
    list.focus({ preventScroll: true });

    const dismiss = (event: Event) => {
      const target = event.target instanceof Node ? event.target : null;
      if (target && (list.contains(target) || trigger.contains(target))) return;
      setOpen(false);
    };
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    document.addEventListener("pointerdown", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
      document.removeEventListener("pointerdown", dismiss);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, open]);

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu();
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      return;
    }
    if (event.key === "Tab") { closeMenu(false); return; }
    if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(options.length - 1, index + 1)); return; }
    if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(0, index - 1)); return; }
    if (event.key === "Home") { event.preventDefault(); setActiveIndex(0); return; }
    if (event.key === "End") { event.preventDefault(); setActiveIndex(options.length - 1); return; }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) choose(option);
      return;
    }
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const now = event.timeStamp;
      const state = typeahead.current;
      state.query = now - state.at > 600 ? event.key : state.query + event.key;
      state.at = now;
      const query = state.query.toLowerCase();
      const index = options.findIndex((option) => option.label.toLowerCase().startsWith(query));
      if (index >= 0) setActiveIndex(index);
    }
  }

  return (
    <span className={`select-field ${open ? "select-field--open" : ""}`}>
      <Icon className="select-field__context" size={17} strokeWidth={1.7} aria-hidden="true" />
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="select-field__trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={onTriggerKeyDown}
      >
        <span>{selected?.label ?? "Choose…"}</span>
      </button>
      <ChevronDown className="select-field__chevron" size={17} strokeWidth={1.7} aria-hidden="true" />
      {open ? (
        <div
          ref={listRef}
          id={listboxId}
          className="select-menu"
          role="listbox"
          aria-label={label}
          aria-activedescendant={`${id}-option-${activeIndex}`}
          tabIndex={-1}
          popover={supportsPopover ? "auto" : undefined}
          onKeyDown={onListKeyDown}
          onToggle={(event: ToggleEvent<HTMLDivElement>) => { if (event.newState === "closed") setOpen(false); }}
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={option.value === value}
              data-index={index}
              className={`select-option ${index === activeIndex ? "is-active" : ""}`}
              onPointerMove={() => setActiveIndex(index)}
              onClick={() => choose(option)}
            >
              <span className="select-option__label">
                {option.label}
                {option.hint ? <small>{option.hint}</small> : null}
              </span>
              {option.value === value ? <Check size={16} strokeWidth={2.2} aria-hidden="true" /> : null}
            </div>
          ))}
        </div>
      ) : null}
    </span>
  );
}
