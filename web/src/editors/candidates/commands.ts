import { currentAnalysis, goToNode } from "../../app/coreCommands";
import { register } from "../../app/commands";
import { ui, useUI } from "../../app/store";

export type CandidateComparison = { path: number[]; node: number; label: string };
for (const side of ["a", "b"] as const) {
  register({
    id: `candidate.compare${side.toUpperCase()}`,
    title: `この展開を${side.toUpperCase()}に設定`,
    category: "比較",
    hidden: true,
    enabled: ({ args }) => !!(args as CandidateComparison | undefined)?.path?.length,
    run: async ({ args }) => {
      const { path, node, label } = args as CandidateComparison;
      const compare = useUI.getState().session.compare;
      const labels: [string, string] = [...compare.label];
      labels[side === "a" ? 0 : 1] = label;
      ui.patchSession({ compare: { ...compare, [side]: [...path], label: labels } });
      if (side === "a") {
        await goToNode(node, [...path]);
        const analysis = await currentAnalysis();
        if (analysis) ui.seek(analysis.start);
        ui.patchPlayback({ range: null });
      }
      ui.toast(`比較${side.toUpperCase()}：${label}`);
    },
  });
}
