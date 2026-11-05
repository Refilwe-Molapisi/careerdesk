"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copies the given SQL to the clipboard; shows a short confirmation. */
export function CopySqlButton({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(sql);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard permission denied (e.g. non-secure context): fall back
          // to selecting the text so the user can copy manually.
          const range = document.createRange();
          const node = document.getElementById("fix-sql-text");
          if (node) {
            range.selectNodeContents(node);
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
        }
      }}
      className="btn-primary inline-flex items-center gap-1.5"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
      {copied ? "Copied" : "Copy SQL"}
    </button>
  );
}
