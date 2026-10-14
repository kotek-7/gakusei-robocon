# Webアプリの構成

Reactの画面、Workerの試合計算、競技モデル、Three.jsの表示で構成する。

## 依存関係

`study → engine`、`study → viewport`。競技モデルはReact・Worker・保存APIに依存しない。

- `src/engine/types.ts`：競技物体、機体、局面、条件、方策の型。
- `src/engine/model.ts`：条件検証、合法行動、採点、取得権。
- `src/engine/transition.ts`：行動開始・完了、競合処理。
- `src/engine/planner.ts`：経路と目標から各機体の合法コマンドを選ぶ。
- `src/engine/policy.ts`：初期方策と局面に応じた目標選択。
- `src/engine/presentation.ts`：局面から描画フレームを作る。
- `src/study/state.ts`：ノートのスキーマ、読込検証、比較用の別案生成。
- `src/study/match.ts`：方策同士の1試合。採点・イベント・再生を同時に生成する。
- `src/study/worker.ts`：1試合単位のWorkerプロトコル。
- `src/study/persistence.ts`：条件の完全一致を確かめて結果を保存・復元する。
- `src/study/App.tsx`：選択状態、試合キュー、中断、ファイル入出力、比較と再生。
- `src/study/Conditions.tsx`、`StrategyEditor.tsx`：条件と方策の編集。
- `src/viewport`：フィールドと機体の3D表示。

## 状態の所有者

ノートと対戦結果はAppが所有する。Workerには条件と両方策のコピーを送り、完了したMatchだけを受け取る。中断時はWorkerを終了し、完了済みMatchを残す。未完了の試合は再開時に最初から計算する。

結果はノート全体のJSONと照合して復元する。条件編集時には表示中の結果を破棄し、新しい条件で保存された結果だけを読む。再生は計算で得たフレームを使用する。

## 検証

`npm test`で参照遷移・方策・保存・CAD寸法を確認し、`npm run build`で型と配信物を検証する。WorkerはViteが独立バンドルにする。フィールド原典は`../rulebook/field-2027.step`。
