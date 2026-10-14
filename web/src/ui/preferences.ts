import { useState } from "react";
export type Preferences = {
  compact: boolean;
  speed: number;
  labels: boolean;
  trails: boolean;
  paneWidth: number;
};
export const defaults: Preferences = {
  compact: false,
  speed: 10,
  labels: false,
  trails: false,
  paneWidth: 480,
};
export function usePreferences() {
  const [value, set] = useState<Preferences>(() => {
    try {
      const raw = JSON.parse(
        localStorage.getItem("robocon-view-preferences") || "null",
      );
      return { ...defaults, ...raw };
    } catch {
      return defaults;
    }
  });
  return [
    value,
    (next: Preferences) => {
      set(next);
      try {
        localStorage.setItem("robocon-view-preferences", JSON.stringify(next));
      } catch {
        /* View preferences never block notebook editing. */
      }
    },
  ] as const;
}
