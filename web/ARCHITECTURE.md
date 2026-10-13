# 構成と依存方向

計算・保存・3D表示をブラウザで完結させる。Python、HTTP API、SQLite、SciPyの実行環境は使用しない。

## 計算の所有者

- `src/engine/model-data.json`: 初期値、ルール解釈、有限フィールドの地点・経路。ビルド時にもPythonを必要としない静的データ。
- `src/engine/model.ts`: 条件・局面の検証、得点、合法行動、物体の属性による選択肢の同値化。
- `src/engine/transition.ts`: 同時選択、接触時の資源競合、動作開始・完了。
- `src/engine/store.ts`: 局面DAG、全入出辺、詳細全探索のカーソル。
- `src/engine/planner.ts`: 最短経路、独立したロボットの選択、固定手順の再実行、候補を除外しない順序のヒント。
- `src/engine/discovery.ts`: 候補・対抗手・共通手順の比較、全裁定分岐の継続、未選択分岐のカーソル。
- `src/engine/classification.ts`: 時刻付き履歴、構造分類、作戦ID。
- `src/engine/evaluation.ts`: 重複を除いた履歴集計、構造ごとの分布、後ろ向きの同時行動ゲーム評価。
- `src/engine/linear.ts`: HiGHS WebAssemblyの読込みと線形計画。WasmはViteが同梱する。1回のソルバー呼出しは2秒上限で、最適解が得られなければ評価エラーとし、保証値を確定しない。
- `src/engine/presentation.ts`: 保存局面・遷移を描画フレームへ射影する。再シミュレーションしない。
- `src/engine/persistence.ts`: IndexedDBの原子的なチェックポイント、バックアップの読込み・書出し。
- `src/engine/runtime.ts`: 計算開始・停止・中断復旧、時間・行動数・状態数の上限。
- `src/engine/worker.ts`: Worker RPCとタブ間のWeb Lock。

依存方向はWorker/実行制御 → 探索・保存・表示射影 → 競技モデル。競技モデルはIndexedDB、React、Three.js、ネットワークに依存しない。

## UIとの接続

`explorer/api.ts` はWorkerへのローカルRPC。`api()`という名前と操作パスは画面側の呼出しをまとめるために残しているが、fetchやHTTP通信は行わない。リクエストIDで応答を対応付け、画面切替時にabortされた読取り結果を捨てる。計算中もWorkerがイベントループへ制御を戻すため、進捗読取りと停止が可能。

`explorer/App.tsx` は探索の選択、進捗購読、グラフ・詳細・再生の接続を担う。条件編集はConditions、グラフ描画はGraph、局面操作はInspector、集計表示はEvaluation、候補比較はCandidates。3Dはviewport以下でフレームを描画する。

## 保存と寿命

Worker内のグラフを計算中の正本とし、探索全体と一覧用サマリーをIndexedDBの同一readwriteトランザクションで保存する。カーソルだけが進む／遷移だけが保存される状態を作らない。保存はおおむね1秒間隔と停止・完了時。容量不足はエラーとして停止し、メモリ内の結果を書出し可能にする。

ブラウザ終了後の計算は行わない。起動時は保存されたrunning/evaluatingを中断状態へ直し、自動では再開しない。評価結果は全工程の完了時だけ置き換える。メモリ上限に到達した探索は未完了のまま中断する。

Web LockはWorkerの寿命中保持し、別タブでの二重書込みを拒否する。保存形式は `browser-1`、バックアップ形式は `robocon-browser` v1。旧保存データの変換・互換処理は持たない。

## 検証

`npm test` は競技モデルの参照遷移、独立列挙とのグラフ照合、保存・再開、候補生成、HiGHS、集計、実行制御、CAD資産を検証する。

`engine/reference.json.gz` は移植前のPython実装から採取した129件の入出力で、競合・受け渡し・反転・試合経路を含む。テストだけがNodeのgzipで読み込み、製品ビルドには含めない。採取元はコミット `8a3f0dd`。旧実装はGit履歴で参照できる。
