import { call } from "../../app/client";
import { goToRoot } from "../../app/coreCommands";
import { upsertSearch } from "../../app/data";
import { layout } from "../../app/layout";
import { useSearch } from "../../app/session";
import { act, ui, useUI } from "../../app/store";
import type { Config } from "../../engine/types";
import { useModel } from "../common/hooks";
import { defineEditor } from "../registry";
import { Conditions } from "./Conditions";

function ConditionsEditor() {
  const model = useModel();
  const search = useSearch();
  const busy = useUI((s) => !!s.busy.create);
  if (!model) return null;
  const initial = search?.config ?? model.defaults;
  return (
    <div className="editor-scroll">
      <Conditions
        key={search?.id ?? "new"}
        model={model}
        initial={initial}
        busy={busy}
        onCreate={(config: Config) =>
          act("create", async () => {
            await navigator.storage?.persist?.();
            const s = await call("search.create", { config });
            upsertSearch(s);
            ui.openSearch(s.id);
            await goToRoot(0);
            layout.activate("discover");
            ui.toast(`「${s.name}」を作成しました。F5で候補探索を開始します。`);
          })
        }
      />
    </div>
  );
}
defineEditor({ type: "conditions", title: "条件", group: "設定", Component: ConditionsEditor });
