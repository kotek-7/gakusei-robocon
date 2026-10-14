import { useEffect, useState } from "react";
import { loadMatch } from "../study/persistence";
import type { Match } from "../study/match";
export function useRunData(key: string, revision?: string) {
  const [value, set] = useState<{ key: string; match?: Match; error: string }>({
    key: "",
    error: "",
  });
  useEffect(() => {
    let current = true;
    set({ key, error: "" });
    if (revision)
      loadMatch(key)
        .then((match) => {
          if (current)
            set({
              key,
              match,
              error: match
                ? ""
                : "保存結果が見つかりません。再計算してください。",
            });
        })
        .catch(() => {
          if (current)
            set({
              key,
              error: "再生データを読み込めません。再計算してください。",
            });
        });
    return () => {
      current = false;
    };
  }, [key, revision]);
  return value.key === key ? value : { key, error: "", match: undefined };
}
