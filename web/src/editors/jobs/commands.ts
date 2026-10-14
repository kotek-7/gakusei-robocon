import { register } from "../../app/commands";
import { layout } from "../../app/layout";
import { saveJSON } from "../../app/coreCommands";
register({ id: "job.inspectRun", title: "この構成の候補を調べる", category: "探索", hidden: true, enabled: ({ args }) => Number.isInteger((args as { run?: number } | undefined)?.run), run: ({ args }) => layout.reveal("candidates", { run: String((args as { run: number }).run), runRequest: Date.now(), searchId: (args as { searchId: string }).searchId }) });
register({ id: "job.exportCoverage", title: "構成ごとの探索状況を書き出す", category: "探索", hidden: true, enabled: ({ args }) => !!args, run: ({ args }) => saveJSON(args, "discovery-coverage.json") });
