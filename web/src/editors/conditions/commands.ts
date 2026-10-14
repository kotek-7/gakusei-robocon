import { register } from "../../app/commands";
import { saveJSON } from "../../app/coreCommands";

register({
  id: "conditions.restoreDifference", title: "この条件を編集開始時に戻す", category: "条件", hidden: true,
  enabled: ({ args }) => typeof (args as { restore?: unknown } | undefined)?.restore === "function",
  run: ({ args }) => (args as { restore: () => void }).restore(),
});
register({
  id: "conditions.exportDifferences", title: "条件の差分を書き出す", category: "条件", hidden: true,
  enabled: ({ args }) => !!args,
  run: ({ args }) => saveJSON(args, "condition-differences.json"),
});
