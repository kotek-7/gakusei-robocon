import { useEffect, useState, useRef } from "react";
export function CommitInput({
  value,
  onCommit,
  label,
  numeric = false,
}: {
  value: string | number;
  onCommit: (v: string) => void;
  label: string;
  numeric?: boolean;
}) {
  const cancel = useRef(false);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <input
      aria-label={label}
      type={numeric ? "number" : "text"}
      min={numeric ? 0 : undefined}
      max={numeric ? 12 : undefined}
      step={numeric ? 1 : undefined}
      maxLength={numeric ? undefined : 80}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (cancel.current) {
          cancel.current = false;
          return;
        }
        if (
          numeric &&
          (!Number.isInteger(Number(draft)) ||
            Number(draft) < 0 ||
            Number(draft) > 12 ||
            draft === "")
        ) {
          setDraft(String(value));
          return;
        }
        const next = numeric ? draft : draft.trim();
        if (!next) {
          setDraft(String(value));
          return;
        }
        if (next !== String(value)) onCommit(next);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          cancel.current = true;
          setDraft(String(value));
          e.currentTarget.blur();
        }
      }}
    />
  );
}
