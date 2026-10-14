import { run } from "../../app/commands";
import { useSearches } from "../../app/data";
import { layout } from "../../app/layout";
import { useSearch } from "../../app/session";
import { Empty } from "../common/Empty";
import { useModel } from "../common/hooks";
import { defineEditor, type EditorProps } from "../registry";
import { Evaluation } from "./Evaluation";

function Header({ area }: EditorProps) {
  const search = useSearch();
  const list = useSearches((s) => s.list);
  const baseline = (area.state?.baseline as string) ?? "";
  return (
    <label className="header-field">
      比較対象
      <select value={baseline} onChange={(e) => layout.setAreaState(area.id, { baseline: e.target.value })}>
        <option value="">なし</option>
        {list
          .filter((s) => s.id !== search?.id)
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
      </select>
    </label>
  );
}
function EvaluationEditor({ area }: EditorProps) {
  const search = useSearch();
  const model = useModel();
  const baseline = useSearches((s) => s.list.find((x) => x.id === area.state?.baseline) ?? null);
  if (!search || !model) return <Empty title="探索がありません" />;
  return (
    <div className="editor-scroll">
      <Evaluation search={search} baseline={baseline} model={model} onNode={(_r, node) => run("nav.node", { node })} />
    </div>
  );
}
defineEditor({ type: "evaluation", title: "評価・比較", group: "探索", Component: EvaluationEditor, Header });
