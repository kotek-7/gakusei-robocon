# 構成と依存方向

## 技術選定（2026-10-13）

全体を「カタログを閲覧しながら条件を変える対話UI」「CAD経路上の試合計算」「Pythonのマクロ実験」に分けて再評価した。UIはReact 19・TypeScript、開発と静的ビルドはVite 8に変更した。Three.js、CSS、Python/SciPy、ブラウザ内Workerの実行方式は維持した。

| 対象・候補 | 判断と具体的な理由 |
| --- | --- |
| 素のJSで責務分割 | 小規模な独立操作には適するが、この画面では分類・展開・工数・計算進捗・詳細が同時に変わる。文字列HTMLの再生成、フォーカスの復元、DOMからの状態読み戻しを引き続き自作する必要があるためUIでは採用しない |
| React + TypeScript | 採用。再帰的な分類をキー付きコンポーネントにし、入力・開閉状態と描画を結びつける。型で分類、機体条件、Worker要求と応答を確認する。各機能の状態はその機能内に置き、汎用ストアは導入しない |
| Svelte 5 + TypeScript | 宣言的UIとコンパイル方式はこの用途に適合する。ただしReactと比べて、このリポジトリで不要になる追加の処理は見つからなかった。今回は通常のTS関数で計算を所有し、Reactの購読APIでUIにつなぐ構成を選択した。性能の優劣を実測した判断ではない |
| Next.jsなどSSR付きフレームワーク | 現状は単一のローカル操作画面で、認証・サーバーデータ取得・公開ページのSEOがない。SSRとサーバーの運用を追加する根拠がないため不採用 |
| esbuildと自作配信サーバー | Viteに置換。開発時の再ビルド、JSX、WorkerのURLと別バンドル、ハッシュ付きアセット、distの掃除、preview配信を既製の仕組みに任せる。独自build.mjs/serve.mjsを削除 |
| Three.js / React Three Fiber | 既存の描画はフレームを受け取り、カメラとGPUリソースを所有する境界がある。Three.jsを維持。全メッシュのReact化で削除できる業務上の結合はなく、描画層の再検証が増える。3Dを初めて開く際に別チャンクを読み込む |
| CSS / Tailwind / UIキット | 現行CSSを維持。今回の問題は状態と更新の結合であり、スタイル方式を変えても解決しない。使われなくなった段階選択・比較画面のルールを削除 |
| ブラウザWorker / サーバー計算 | Workerを維持。データはローカルの有限カタログで、共有保存や常駐ジョブはない。サーバーへ移すとAPI・ジョブ管理・運用が必要になる。多数ユーザーで同じ重い計算を共有する要求が生じたら再評価 |
| JS計算エンジン / Rust・Wasm | 計算式とイベント処理は既存JSを維持。WorkerとUIとの契約にTypeScriptを適用した。Wasm移植による実測の速度改善やメモリ削減は未確認で、移植・データ変換・別ツールチェーンの負担を正当化できない |
| Python・SciPy / ブラウザへの一本化 | Pythonを維持。108方策の全対戦、到達状態探索、SciPyの線形計画はCLI実験の責務。CAD版297方策とは行動集合・時間モデルが異なるため、共通実装に見せかけると結果の意味を変える。モデル名・出力先を区別する |
| DB / IndexedDB / localStorage | 編集する工数表は小さいためlocalStorageを維持。計算結果は従来どおりJSONとして書き出す。共有・履歴・大規模保存の要求がない段階でDBを追加しない |
| テスト | Nodeのテストランナーを継続し、tsxでTSも同じ経路で実行。型検査をbuild前に必須化。Pythonはunittestを継続。Workerは小さいポート契約へテスト用の実装を渡し、古い応答・中止・起動失敗を検査 |

公式資料: [Reactの既存プロジェクトへの導入](https://react.dev/learn/add-react-to-an-existing-project)、[Reactのクライアントアプリ構成](https://react.dev/learn/build-a-react-app-from-scratch)、[ViteのTS・Worker対応](https://vite.dev/guide/features.html)、[Svelteの概要](https://svelte.dev/docs/svelte/overview)、[TypeScriptの絞り込み](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)、[SciPyの線形計画](https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.linprog.html)。導入したバージョンはpackage-lock.jsonに固定。既存Three.js・CAD変換器・SciPyのバージョンは変更していない。

## 所有者と追加先

| 変更対象 | 公開口・所有者 |
| --- | --- |
| 起動と機能間の接続 | `main.tsx` → `workspace/App.tsx`。画面モードとヘルプの開閉だけを所有。カタログ内部の条件は渡さない |
| 作戦の組合せ・行動条件の同値性 | `catalog/plans.ts`、`decisions.ts`。DOM・React・Workerに依存しない |
| 分類・工数・候補集合 | `catalog/navigation.ts`、`effort.ts`。部分木の分割とフィルタはここへ追加 |
| カタログのUI状態 | `catalog/Catalog.tsx`。分類、機体条件、工数、選択ID、展開集合が正本。候補と選択作戦は導出する |
| カタログの表示 | `CatalogTree.tsx`、`Filters.tsx`、`Outlook.tsx`、`PlanDetail.tsx`。狭いpropsで必要な値と操作だけを受け取る |
| 非同期計算 | `catalog/calculation.ts`。計算1件のWorker、進捗、結果、中止・エラーを所有。Reactには依存しない |
| Workerと保存の実装 | `catalog/browser.ts`。Worker生成とlocalStorage。`protocol.ts`が要求・応答の判別可能な共用型。`worker.ts`は計算を実行し、UIをimportしない |
| Reactへの購読 | `catalog/useCalculation.ts`。計算状態をuseSyncExternalStoreで購読し、アンマウントで解放 |
| 選択した試合と保存 | `workspace/session.ts`。作戦・相手・性能・実行結果の正本。更新を検証してから交換。`export.js`はJSONダウンロードだけを担当 |
| 再生 | `replay/playback.ts`は時刻・速度・補間、`usePlayback.ts`は時計とキー入力の寿命、`Replay.tsx`は操作とタイムライン |
| 競技計算 | `simulation/engine.js`、`movement.js`、`field.js`。Reactをimportしない。公開データ契約は`types.ts`と`engine.d.ts` |
| 3D | `viewport/Viewport.tsx`がReactとの接続。`scene.js`以下はWebGL・カメラ・CAD・機体を所有し、受け取ったフレームだけを描画。アンマウントで解放 |
| 相手・性能・状態表示 | `conditions/Conditions.tsx`。試合更新をAppへ通知し、結果をpropsで受け取る |

コード依存は `App → 各機能の公開口`、`Catalogの表示 → 分類・工数ルール`、`worker → protocol + simulation + decisions`、`session → simulation`、`viewport → simulation/field`。ルールからReact、DOM、Workerの生成処理への逆依存は持たせない。Pythonとブラウザのモデル間に実行時依存はない。

## 互換性と移行範囲

画面の分類順、作戦IDと元設定ID、工数の加算、得点計算式、モデル識別子、URL `/`、保存キー`strata-effort-v1`を維持。結果JSONのトップレベルは`selected`、`enemy`、`cfg`、`events`、`finalScores`、`modelVersion`、`winner`、`ranks`、`catalogAnalysis`。後者は`classification`、`hardware`、`estimates`、`budget`、`remaining`、`results`、`responses`を維持する。

実際の利用者を失った探索Worker、比較基準、Pareto・能力群一覧、段階選択用処理と旧DOMパネルは削除した。それらだけを検査していたテストも削除し、現在の階層分割・非同期計算・保存互換性を検査する。旧Workerの出力URLはアプリ内実装で、外部公開APIとして維持しない。

計算・Three.js内部はテスト済みのJSを維持し、TSの対象はUI、カタログルール、再生状態、セッション、実行環境をまたぐ契約。`allowJs`を使うが`checkJs`は無効であり、エンジン内部まで静的型検査できたとは扱わない。競技計算を変更する際には既存の資源保存・対称性・資格・終端テストを必ず実行する。

Viteの出力は引き続き`dist/`。静的ホスティング設定もそのまま利用できる。`vite preview`はローカル確認用であり、本番サーバーではない。独自サーバー・ルーター・DIコンテナ・イベントバスは追加しない。
