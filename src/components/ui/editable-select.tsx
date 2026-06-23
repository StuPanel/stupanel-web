"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const CUSTOM_VALUE = "__custom__";

interface Option {
  value: string;
  label: string;
}

interface EditableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  customPlaceholder?: string;
  className?: string;
  customLabel?: string;
}

// A native <select> that also lets the user type a value that isn't in the preset list.
export function EditableSelect({
  value, onChange, options, placeholder = "Select...", customPlaceholder = "Type your own...",
  className, customLabel = "+ Custom...",
}: EditableSelectProps) {
  const isKnownValue = !value || options.some(o => o.value === value);
  const [isCustom, setIsCustom] = useState(!isKnownValue);

  const baseClassName = cn(
    "w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400",
    className,
  );

  if (isCustom) {
    return (
      <div className="relative">
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={customPlaceholder}
          className={cn(baseClassName, "pr-8")}
        />
        <button
          type="button"
          onClick={() => { setIsCustom(false); onChange(""); }}
          title="Back to list"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={e => {
        if (e.target.value === CUSTOM_VALUE) { setIsCustom(true); onChange(""); return; }
        onChange(e.target.value);
      }}
      className={cn(baseClassName, "cursor-pointer")}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      <option value={CUSTOM_VALUE}>{customLabel}</option>
    </select>
  );
}
