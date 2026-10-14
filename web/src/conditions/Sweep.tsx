import { useEffect, useRef, useState } from "react";
import type { Config } from "../engine/types";
import { sweepCases, valueAt, type Parameter } from "./values";
export function Sweep({
  config,
  parameter,
  onRun,
  onClose,
}: {
  config: Config;
  parameter: Parameter;
  onRun: (cases: { name: string; config: Config }[]) => void;
  onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    root.current?.scrollIntoView({ block: "nearest" });
    root.current?.focus();
  }, []);
  const [side, setSide] = useState(0);
  const [text, setText] = useState(
    typeof valueAt(config, parameter, 0) === "boolean"
      ? "あり、なし"
      : String(valueAt(config, parameter, 0)),
  );
  let cases: ReturnType<typeof sweepCases> = [],
    error = "";
  try {
    cases = sweepCases(config, parameter, side, text);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  return (
    <div
      className="condition-sweep"
      ref={root}
      tabIndex={-1}
      aria-label={`${parameter.label}の比較`}
    >
      <strong>{parameter.label}を変えて比べる</strong>
      <div className="toolbar">
        <select
          aria-label="比較する側"
          value={side}
          onChange={(e) => setSide(Number(e.target.value))}
        >
          <option value={0}>自分・赤</option>
          <option value={1}>相手・青</option>
        </select>
        <label>
          候補値{" "}
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="例：1、1.5、2"
          />
        </label>
      </div>
      <p>
        {error ||
          `${cases.length}条件・${cases.length * 2}試合。選択中の作戦と相手を、赤優先・青優先で計算します。`}
      </p>
      <div className="toolbar">
        <button disabled={!!error} onClick={() => onRun(cases)}>
          条件を追加して計算
        </button>
        <button onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
}
