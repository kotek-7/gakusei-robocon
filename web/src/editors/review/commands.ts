import { register } from "../../app/commands";
import { currentPath, goToNode, saveJSON } from "../../app/coreCommands";
import { layout } from "../../app/layout";
import { parseRef, type EntityRef } from "../../app/refs";
import { ui, useUI } from "../../app/store";
import { newId, updateWorkspace } from "../../app/workspace";
import type { ReviewRecord } from "../../engine/protocol";
import { reviewText } from "./records";
const hasSelection = () => !!useUI.getState().session.search && useUI.getState().session.node !== null;
register(
  { id: "review.open", title: "検討記録を開く", category: "検討", run: () => layout.reveal("review") },
  { id: "review.capture", title: "現在の経路と時刻を記録", category: "検討", keys: ["Ctrl+Shift+M"], enabled: hasSelection,
    run: async () => {
      const { session, playback } = useUI.getState();
      const path = await currentPath();
      if (!path || useUI.getState().session.search !== session.search) return;
      const record: ReviewRecord = {
        id: newId(), title: `局面 ${session.node}・${playback.time.toFixed(2)}秒`, note: "", status: "open",
        node: session.node!, path: [...path], selection: session.selection,
        time: playback.time, range: playback.range ? [...playback.range] : null, created: Date.now(),
      };
      await updateWorkspace(w => ({ ...w, reviews: [...(w.reviews ?? []), record] }));
      if (useUI.getState().session.search === session.search) layout.reveal("review", { selected: record.id, resetFilters: record.id });
    },
  },
  { id: "review.restore", title: "記録した経路を再生", category: "検討", hidden: true,
    run: async ({ args }) => {
      const r = args as ReviewRecord;
      const search = useUI.getState().session.search;
      await goToNode(r.node, [...r.path]);
      if (search !== useUI.getState().session.search) return;
      ui.patchPlayback({ time: r.time, range: r.range, playing: false });
      if (r.selection && parseRef(r.selection)) ui.select(r.selection as EntityRef);
    },
  },
  { id: "review.update", title: "記録を保存", category: "検討", hidden: true,
    run: ({ args }) => {
      const { id, patch } = args as { id: string; patch: Partial<Pick<ReviewRecord, "title" | "note" | "status">> };
      return updateWorkspace(w => ({ ...w, reviews: (w.reviews ?? []).map(r => r.id === id ? { ...r, ...patch } : r) }));
    },
  },
  { id: "review.delete", title: "記録を削除", category: "検討", hidden: true,
    run: async ({ args }) => {
      const r = args as ReviewRecord;
      const search = useUI.getState().session.search;
      await updateWorkspace(w => ({ ...w, reviews: (w.reviews ?? []).filter(x => x.id !== r.id) }));
      ui.toast("記録を削除しました", "info", { label: "元に戻す", command: "review.undoDelete", args: { search, record: r } });
    },
  },
  { id: "review.undoDelete", title: "記録の削除を取り消す", category: "検討", hidden: true,
    enabled: ({ args }) => (args as { search?: string } | undefined)?.search === useUI.getState().session.search,
    run: ({ args }) => {
      const { record } = args as { record: ReviewRecord };
      return updateWorkspace(w => ({ ...w, reviews: [...(w.reviews ?? []).filter(r => r.id !== record.id), record].sort((a, b) => a.created - b.created) }));
    },
  },
  { id: "review.copy", title: "表示中の検討記録をコピー", category: "検討", hidden: true,
    run: async ({ args }) => { await navigator.clipboard.writeText(reviewText(args as ReviewRecord[])); ui.toast("検討記録をコピーしました"); } },
  ...(["a", "b"] as const).map(side => ({
    id: `review.compare${side.toUpperCase()}`, title: `記録した経路を比較${side.toUpperCase()}に設定`, category: "検討", hidden: true,
    enabled: ({ args }: import("../../app/commands").CommandContext) => !!(args as ReviewRecord | undefined)?.path.length,
    run: ({ args }: import("../../app/commands").CommandContext) => {
      const r = args as ReviewRecord;
      const c = useUI.getState().session.compare;
      const label: [string, string] = [...c.label];
      label[side === "a" ? 0 : 1] = r.title;
      ui.patchSession({ compare: { ...c, [side]: [...r.path], label } });
      ui.toast(`比較${side.toUpperCase()}に設定しました`);
    },
  })),
);


register({ id: "review.export", title: "表示中の検討記録をJSON保存", category: "検討", hidden: true,
  run: ({ args }) => saveJSON({ version: 1, records: args as ReviewRecord[] }, "review-records.json") },
{ id: "review.duplicate", title: "記録を複製", category: "検討", hidden: true,
  run: async ({ args }) => {
    const original = args as ReviewRecord;
    const search = useUI.getState().session.search;
    const id = newId();
    let created = false;
    await updateWorkspace(w => {
      const latest = (w.reviews ?? []).find(record => record.id === original.id);
      if (!latest) return w;
      created = true;
      const record = { ...structuredClone(latest), id, title: `${latest.title}（複製）`, status: "open" as const, created: Date.now() };
      return { ...w, reviews: [...(w.reviews ?? []), record] };
    });
    if (created && useUI.getState().session.search === search) layout.reveal("review", { selected: id, resetFilters: id });
  },
});

register({ id: "review.view", title: "検討記録の表示を変更", category: "検討", hidden: true,
  run: ({ args }) => { const { area, patch } = args as { area: string; patch: Record<string, unknown> }; layout.setAreaState(area, patch); },
});
