"use client";

import { useState } from "react";
import { X } from "lucide-react";

type SkillsEditorProps = {
  label: string;
  skills: string[];
  onChange: (skills: string[]) => void;
  placeholder?: string;
};

/** Chip-based skill list editor (Enter or comma adds, Backspace removes). */
export function SkillsEditor({
  label,
  skills,
  onChange,
  placeholder,
}: SkillsEditorProps) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const skill = raw.trim().toLowerCase().replace(/,\s*$/, "");
    if (!skill) return;
    if (!skills.includes(skill) && skills.length < 25) {
      onChange([...skills, skill]);
    }
    setDraft("");
  }

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-2.5 py-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
        {skills.map((skill) => (
          <span key={skill} className="chip">
            {skill}
            <button
              type="button"
              onClick={() => onChange(skills.filter((s) => s !== skill))}
              className="text-stone-400 hover:text-stone-700"
              aria-label={`Remove ${skill}`}
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && draft === "") {
              onChange(skills.slice(0, -1));
            }
          }}
          onBlur={() => add(draft)}
          className="min-w-24 flex-1 border-0 bg-transparent text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
          placeholder={placeholder ?? "Type and press Enter"}
          aria-label={label}
        />
      </div>
    </div>
  );
}
