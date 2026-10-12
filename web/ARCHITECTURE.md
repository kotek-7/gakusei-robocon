# 構成と依存方向

ブラウザ内で計算・再生する単一画面のアプリケーション。JavaScript、Three.js、esbuildを使用する。業務ルールはDOMやThree.jsに依存しない。画面領域ごとに表示とイベントを所有し、起動点で機能間を接続する。

## 変更先

| 対象 | 場所 | 所有する状態・契約 |
| --- | --- | --- |
| 作戦の組合せ、名称、絞り込み | `src/catalog/` | 階層分類・対応範囲・工数・得点分布・相手応答。navigation.jsが分割規則、panel.jsが表示、worker.jsが計算を所有 |
| 競技状態、得点、資源、移動時間 | `src/simulation/` | 1回の試合の状態。`simulate()` が結果を返す |
| カメラ、フィールド、機体の表示 | `src/viewport/` | WebGLリソース。受け取ったフレームを描画 |
| 再生、一時停止、時刻補間、イベント表示 | `src/replay/` | 時刻、再生速度、再生状態 |
| カタログ計算と相手応答 | `src/catalog/worker.js` | 計算条件の変更時にWorkerと古い結果を破棄 |
| 性能と相手の選択 | `src/conditions/` | 入力を通知し、確定した実行条件を表示 |
| 選択した作戦、実行結果、保存 | `src/workspace/` | セッションの正本。更新はメソッド経由 |
| 利用方法とモデルの適用範囲 | `src/help/` | 利用者向け説明 |

`src/app.js` は機能を接続する。依存は `app → 各機能`、`workspace/session → simulation`、`catalog/worker → catalog/decisions + simulation`、`viewport → simulation/field` の方向。計算モデルから画面やWorkerへの逆依存は持たせない。再生中のフレームと得点差は保存せず、実行結果と現在時刻から導出する。

表示のみの変更は各パネルへ、ルール変更はsimulationへ追加する。ライブラリの置換より、現在の結合を分けることが必要な規模のため現行スタックを維持している。ルーター、サーバー、汎用状態管理は導入していない。

## 実行環境

`build.mjs` が `app.js` と `catalog-worker.js` を別々にバンドルする。書き出すJSONのキーは `selected`、`enemy`、`cfg`、`events`、`finalScores`、`modelVersion`、`winner`、`ranks`。`catalogAnalysis`に分類フィルター・対応範囲・見積もり・集計結果を追加する。Workerの寿命はカタログ機能、アニメーションとイベント購読の解除は各所有者が管理する。

テストは対象機能の隣に置く。スタイルの入口は `src/style.css`。画面共通のスタイルと幅別レイアウトは `src/workspace/`、機能専用のスタイルは各機能内に置く。

CAD変換は `scripts/import-field.mjs`。入力STEPのSHA-256を生成JSONに保存し、テストで一致を確認する。フィールドの形状は生成メッシュ、経路・操作地点とワーク寸法は `simulation/field.js` が所有する。新しいイベント時刻は連続値で処理し、再生用フレームは0.5秒間隔で記録する。
