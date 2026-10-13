# 構成と依存方向

旧Webカタログ・Worker・独自シミュレータ、旧Pythonマクロ実験と生成結果は撤去。ルール原典、提供CAD、Three.jsの描画部品は維持。

## 計算の所有者

- `explorer/model/config.py`: 有限の構成ドメイン、入力検証、ルール解釈設定。
- `explorer/model/field.py`: 有限の操作地点と経路、役割・能力による通行条件。
- `explorer/model/state.py`: 局面、物体、得点、資格、不変条件。
- `explorer/model/actions.py`: 合法操作の列挙と所要時間。
- `explorer/model/transition.py`: 同時選択、競合、開始・完了イベント。
- `explorer/search/store.py`: SQLiteの状態グラフ、全入出辺、展開カーソル。バッチの遷移とカーソルを同一トランザクションで確定。
- `explorer/search/discovery.py`: ルールと状態からの階層目標生成、候補と相手の対応の探索、保存済み経路への接続。詳細モデルの遷移を使う限定探索。
- `explorer/search/evaluation.py`: 経路と構造分類の集計、同時行動ゲームの線形計画。
- `explorer/runtime.py`: ローカルの計算ジョブの実行・停止。ブラウザから独立。
- `explorer/presentation.py`: 保存した状態・遷移から描画用フレームへの射影。再シミュレーションしない。
- `explorer/server.py`: localhost専用JSON APIとdist配信。

依存方向はAPI/実行制御 → 探索/表示射影 → モデル。モデルはDB、HTTP、React、Three.jsをimportしない。SciPyは評価だけが使用。

## Webの所有者

`explorer/App.tsx`は保存済み探索の選択、API購読、グラフ・詳細・再生の接続を担う。条件編集はConditions、グラフ描画はGraph、局面操作はInspector、集計表示はEvaluation、候補と相手の対応の比較はCandidates。3Dはviewport以下でフレームを描画する。

正本はSQLite。ブラウザが所有するのは編集中の条件、選択ノード/経路、表示ページと再生時刻。計算結果をブラウザで別の競技モデルにかけ直さない。取得リクエストは切替時にabortし、古い局面応答を採用しない。

React・TypeScript・Vite・Three.jsを維持し、Worker計算をローカルPython/SQLiteへ置き換えた。計算の継続・チェックポイント・数値計算が目的。SSR、クラウド、汎用プラグイン機構は導入していない。
