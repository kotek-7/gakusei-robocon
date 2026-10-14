import { run } from "../../app/commands";
import { useDetail, useSearch } from "../../app/session";
import { ui, useUI } from "../../app/store";
import { Empty } from "../common/Empty";
import { followEdge, stepActions } from "../common/navigate";
import { defineEditor } from "../registry";
import { Inspector } from "./Inspector";
import { SelectionInspector } from "./SelectionInspector";

function PropertiesEditor() {
  const search = useSearch();
  const selection = useUI(s => s.session.selection);
  const detail = useDetail().data;
  const busy = useUI((s) => !!s.busy.step) || search?.status === "running" || search?.status === "evaluating";
  if (!search) return <Empty title="探索がありません" />;
  if (!detail) return <Empty title="局面を選択してください" />;
  return (
    <div className="editor-scroll">
      {selection && /^(robot|obj|spot):/.test(selection) ? <SelectionInspector /> : <Inspector
        detail={detail}
        busy={!!busy}
        onStep={(a) => stepActions(a)}
        onEdge={(e) => followEdge(e).catch(ui.error)}
        onExpand={() => run("job.exactHere")}
      />}
    </div>
  );
}
defineEditor({ type: "properties", title: "プロパティ", group: "解析", Component: PropertiesEditor });
