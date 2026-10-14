import { register } from "../../app/commands";
import { saveJSON } from "../../app/coreCommands";
register({ id: "evaluation.exportConditionDifferences", title: "比較条件の差分を書き出す", category: "評価", hidden: true, enabled: ({ args }) => !!args, run: ({ args }) => saveJSON(args, "comparison-conditions.json") });
