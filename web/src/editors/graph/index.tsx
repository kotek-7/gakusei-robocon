import "./commands";
import { run } from "../../app/commands";
import { useQuery } from "../../app/data";
import { layout } from "../../app/layout";
import { usePath, useSearch } from "../../app/session";
import { ui, useUI } from "../../app/store";
import { Empty } from "../common/Empty";
import { followEdge } from "../common/navigate";
import { defineEditor } from "../registry";
import { Graph } from "./Graph";

function GraphEditor({ area }: import("../registry").EditorProps) {
  const search = useSearch();
  const run_ = useUI((s) => s.session.run);
  const offset = useUI((s) => s.session.offset);
  const node = useUI((s) => s.session.node);
  const path = usePath();
  const graph = useQuery("graph.page", search ? { search: search.id, run: run_, offset } : null).data;
  if (!search) return <Empty title="探索がありません" />;
  if (!graph) return null;
  return (
    <div className="editor-scroll graph-editor">
      <Graph
        scope={(area.state?.graphScope as import("./view").GraphScope) ?? "page"}
        onScope={(scope) => run("graph.scope", { area: area.id, scope })}
        data={graph}
        selected={node}
        path={path ?? []}
        select={(n) => run("nav.node", { node: n })}
        chooseEdge={(e) => followEdge(e).catch(ui.error)}
        onPage={(o) => run(o < offset ? "graph.previousPage" : "graph.nextPage")}
        onReveal={() => run("graph.revealSelection")}
      />
    </div>
  );
}
defineEditor({ type: "graph", title: "状態グラフ", group: "探索", Component: GraphEditor });
void layout;
