/**
 * Preference schema. The settings editor is generated from it, and values
 * persist per browser in localStorage.
 */
import { create } from "zustand";

export type PrefDef = {
  id: string;
  category: string;
  label: string;
  description?: string;
} & (
  | { type: "boolean"; default: boolean }
  | { type: "number"; default: number; min: number; max: number; step?: number; unit?: string }
  | { type: "enum"; default: string; options: [string, string][] }
);

export const PREF_DEFS: PrefDef[] = [];
export function definePrefs(defs: PrefDef[]) {
  for (const d of defs)
    if (!PREF_DEFS.some((x) => x.id === d.id)) PREF_DEFS.push(d);
}

definePrefs([
  { id: "ui.theme", category: "外観", label: "テーマ", type: "enum", default: "system", options: [["system", "システムに合わせる"], ["light", "ライト"], ["dark", "ダーク"]] },
  { id: "ui.density", category: "外観", label: "表示密度", type: "enum", default: "compact", options: [["compact", "詳細"], ["comfortable", "標準"]], description: "行の高さと余白。" },
  { id: "ui.fontScale", category: "外観", label: "文字の倍率", type: "number", default: 100, min: 85, max: 130, step: 5, unit: "%" },
  { id: "ui.statusBar", category: "外観", label: "ステータスバーを表示", type: "boolean", default: true },
  { id: "ui.confirmDelete", category: "操作", label: "探索の削除前に確認", type: "boolean", default: true },
  { id: "ui.hoverFocus", category: "操作", label: "ポインタ下の領域にショートカットを送る", type: "boolean", default: true, description: "オフにするとクリックした領域が対象になる。" },
  { id: "job.discoverySeconds", category: "計算", label: "候補探索の既定時間", type: "enum", default: "300", options: [["10", "10秒"], ["60", "1分"], ["300", "5分"], ["1800", "30分"], ["3600", "1時間"], ["21600", "6時間"], ["86400", "24時間"]] },
  { id: "job.exactBudget", category: "計算", label: "全探索の1回の行動数", type: "number", default: 1000, min: 1, max: 1000000, step: 100 },
]);

const STORAGE = "robocon.prefs.v1";
const read = (): Record<string, unknown> => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || "{}");
  } catch {
    return {};
  }
};
type PrefState = { values: Record<string, unknown> };
export const usePrefStore = create<PrefState>(() => ({ values: read() }));
export function getPref<T = unknown>(id: string): T {
  const v = usePrefStore.getState().values[id];
  return (v === undefined ? PREF_DEFS.find((d) => d.id === id)?.default : v) as T;
}
export function setPref(id: string, value: unknown) {
  usePrefStore.setState((s) => {
    const values = { ...s.values };
    const def = PREF_DEFS.find((d) => d.id === id);
    if (def && value === def.default) delete values[id];
    else values[id] = value;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(values));
    } catch {
      // Private mode or storage disabled: keep the value for this session.
    }
    return { values };
  });
}
export function usePref<T = unknown>(id: string): T {
  const v = usePrefStore((s) => s.values[id]);
  return (v === undefined ? PREF_DEFS.find((d) => d.id === id)?.default : v) as T;
}
