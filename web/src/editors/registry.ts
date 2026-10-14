import type { ComponentType } from "react";
import type { AreaLeaf } from "../app/layout";

export type EditorProps = { area: AreaLeaf };
export type EditorDef = {
  type: string;
  title: string;
  /** Short group used in the editor-type menu. */
  group: "解析" | "探索" | "データ" | "設定";
  Component: ComponentType<EditorProps>;
  /** Editor-specific toolbar shown in the area header. */
  Header?: ComponentType<EditorProps>;
};
const editors = new Map<string, EditorDef>();
export function defineEditor(def: EditorDef) {
  editors.set(def.type, def);
}
export const getEditor = (type: string) => editors.get(type);
export const allEditors = () => [...editors.values()];
