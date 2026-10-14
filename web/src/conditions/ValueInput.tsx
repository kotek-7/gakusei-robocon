import { useEffect, useState, useRef } from "react";
export function ValueInput({
  value,
  label,
  min,
  max,
  integer,
  onCommit,
}: {
  value: number;
  label: string;
  min: number;
  max: number;
  integer?: boolean;
  onCommit: (n: number) => void;
}) {
  const cancel = useRef(false);
  const [draft, setDraft] = useState(String(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setDraft(String(value));
    setInvalid(false);
  }, [value]);
  function commit() {
    if (cancel.current) {
      cancel.current = false;
      return;
    }
    const n = Number(draft);
    if (
      !draft.trim() ||
      !Number.isFinite(n) ||
      n < min ||
      n > max ||
      (integer && !Number.isInteger(n))
    ) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (n !== value) onCommit(n);
  }
  return (
    <>
      <input
        aria-label={label}
        aria-invalid={invalid}
        type="number"
        min={min}
        max={max}
        step={integer ? 1 : "any"}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setInvalid(false);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            cancel.current = true;
            setDraft(String(value));
            setInvalid(false);
            e.currentTarget.blur();
          }
        }}
      />
      {invalid && (
        <small role="alert">
          {min}〜{max}
          {integer ? "の整数" : ""}を入力してください。
        </small>
      )}
    </>
  );
}
