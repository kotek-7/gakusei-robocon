import { run } from "../../app/commands";
import { useSearch } from "../../app/session";
import { useModel } from "../common/hooks";
import { Empty } from "../common/Empty";
import { defineEditor, type EditorProps } from "../registry";
import { Candidates } from "./Candidates";

function CandidatesEditor({ area }: EditorProps) {
  const search = useSearch();
  const model = useModel();
  if (!search || !model) return <Empty title="探索がありません" />;
  return (
    <div className="editor-scroll">
      <Candidates
        key={search.id}
        search={search}
        model={model}
        requestedRun={area.state?.searchId === search.id ? area.state?.run as string | undefined : undefined}
        runRequest={area.state?.runRequest as number | undefined}
        onOpen={(_run, evidence) => {
          run("nav.node", { node: evidence.node, path: evidence.path });
        }}
      />
    </div>
  );
}
defineEditor({ type: "candidates", title: "作戦候補", group: "探索", Component: CandidatesEditor });
