import { useState } from "react";
import { createStudy, readStudy, type Study } from "../study/state";
import { history, change, undo, redo, type History } from "./history";
const key = "robocon-strategy-notebook-2";
function load() {
  try {
    const raw =
      localStorage.getItem(key) ||
      localStorage.getItem("robocon-strategy-notebook-1");
    return {
      study: raw ? readStudy(JSON.parse(raw)) : createStudy(),
      error: "",
    };
  } catch {
    return {
      study: createStudy(),
      error:
        "保存ノートを読み込めません。元のデータは残しています。保存ファイルから読み込めます。",
    };
  }
}
export function useNotebook() {
  const [boot] = useState(load),
    [h, setH] = useState(() => history(boot.study)),
    [error, setError] = useState(boot.error);
  function apply(next: History<Study>) {
    setH(next);
    try {
      localStorage.setItem(key, JSON.stringify(next.present));
      setError("");
    } catch {
      setError("端末に保存できません。ファイルに保存してください。");
    }
  }
  function update(next: Study) {
    try {
      const valid = readStudy(next);
      const a = { ...h.present, activeConditionId: "" },
        b = { ...valid, activeConditionId: "" };
      apply(change(h, valid, JSON.stringify(a) !== JSON.stringify(b)));
    } catch (e) {
      setError(String(e));
    }
  }
  return {
    study: h.present,
    update,
    error,
    setError,
    canUndo: !!h.past.length,
    canRedo: !!h.future.length,
    undo: () => apply(undo(h)),
    redo: () => apply(redo(h)),
  };
}
