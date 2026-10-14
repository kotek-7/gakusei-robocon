import { useEffect, useState } from "react";
type Layout = {
  inspector: boolean;
  panel: "" | "events" | "scores" | "notes";
  width: number;
};
export function useReplayLayout(reset = 0) {
  const [layout, setLayout] = useState<Layout>(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("robocon-replay-layout") || "null",
      );
      return {
        inspector: !!saved?.inspector,
        panel: ["events", "scores", "notes"].includes(saved?.panel)
          ? saved.panel
          : "",
        width: Math.max(180, Math.min(400, Number(saved?.width) || 240)),
      };
    } catch {
      return { inspector: false, panel: "", width: 240 };
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("robocon-replay-layout", JSON.stringify(layout));
    } catch {
      /* Layout remains usable when storage is full. */
    }
  }, [layout]);
  useEffect(() => {
    if (reset) setLayout({ inspector: false, panel: "", width: 240 });
  }, [reset]);
  const setInspector = (inspector: boolean) =>
    setLayout((old) => ({ ...old, inspector }));
  const setPanel = (panel: Layout["panel"]) =>
    setLayout((old) => ({ ...old, panel }));
  const setWidth = (width: number) =>
    setLayout((old) => ({
      ...old,
      width: Math.max(180, Math.min(400, width)),
    }));
  return { ...layout, setInspector, setPanel, setWidth };
}
