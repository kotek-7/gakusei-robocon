# 構成と依存方向

計算・保存・3D表示はブラウザ内で完結する。Python、HTTP API、SQLite、SciPyは使わない。

```
engine/   競技モデル・探索・評価・保存・Worker（DOM・React・Three.jsに依存しない）
app/      UI側の基盤：RPCクライアント、読取りキャッシュ、UI状態、コマンド、設定、ルーター
shell/    作業台の外枠：メニューバー、ワークスペース、ドック、ステータスバー、パレット、設定画面
editors/  ドックの領域に入るエディタ。1種類につき1ディレクトリ
viewport/ Three.jsのシーン（型付き）。editors/viewport が操作する
```

依存の向きは次のとおり。

- editors → app → engine/protocol
- shell → app

エディタどうしは直接 import しない。共通部品は `editors/common` に置く。

## API（UI ⇔ Worker）

`engine/protocol.ts` が唯一の契約で、判別できる型付きのメソッド名で定義する。HTTP風のパス文字列は使わない。

- **Query（読取り）**: `search.list`、`search.get`、`graph.page`、`graph.locate`、`node.get`、`path.toNode`、`replay.get`、`analysis.match`、`search.export`、`workspace.get`、`model.get`、`config.validate`
  - Workerは受け取った順に並行して処理する。計算中でも読める。
- **Command（変更）**: `search.create`、`search.import`、`search.duplicate`、`search.rename`、`search.delete`、`run.ensure`、`node.step`、`job.start`、`job.pause`、`workspace.put`
  - 書込みの順序を保つため直列化する。
- **Event（push）**: `search.changed`、`search.removed`、`job.finished`
  - 自動保存のたびに、変化した探索のサマリーだけを送る。UIはポーリングしない。

`engine/runtime.ts` はメソッド名からハンドラへの対応表を持つ。`engine/worker.ts` はQueryとCommandを振り分け、Eventを転送する。

`analysis.match` は保存済みの経路から次を導出する。再シミュレーションはしない（`engine/analysis.ts`、純関数）。

- 得点内訳の推移
- 機体ごとの動作区間
- イベント（設置・反転・搬送・リトライ・実行不可・取得条件・競合分岐）
- 建設スポットの積み上げ履歴
- 共有物体の在庫推移

## パス（URL）

hashルーティングを使う。静的配信やサブディレクトリ配信のまま動く。

```
#/s/<探索ID>/<ワークスペース>?node=<局面>&path=<遷移列>&t=<再生秒>&sel=<選択>
```

- `path` は連続区間に圧縮する（例: `1-40.42.44-90`）。
- 選択・時刻の変更は `replaceState` で記録する。
- 探索とワークスペースの切替は `pushState` で記録し、ブラウザの戻る・進むで移動できる。

選択の参照は `app/refs.ts` の `種類:ID` 形式で統一する（`node:12`、`edge:5`、`robot:1`、`spot:6`、`obj:41`）。同じ形式を次の箇所で使う。

- 3Dの選択
- タイムライン
- プロパティ
- ステータスバー
- リンク

## データ管理

### 保存形式 `browser-2`（IndexedDB `robocon-browser-2`）

| store | キー | 内容 |
|---|---|---|
| `searches` | id | 局面・遷移を除く探索本体（条件、構成、候補探索の継続状態、評価） |
| `summaries` | id | 一覧用サマリー |
| `nodes` | [search, id] | 局面の行。追記と、展開カーソルが進んだ行の更新 |
| `edges` | [search, id] | 遷移の行。追記のみ |
| `workspaces` | id | 探索ごとの注釈（マーカー、保存した視点、ピン、比較A/B、メモ） |

チェックポイントでは前回から増えた行と、変更された局面だけを書き込む。本体・サマリーと同じ readwrite トランザクションで書くので、途中で止まった状態は残らない。旧形式 `browser-1` からの移行処理はない。

- バックアップ形式は `robocon-browser` v2 で、探索と注釈を含む。
- 計算中の正本は Worker 内のグラフ。保存はおおむね1秒ごとと、停止・完了時に行う。
- Web Lock で別タブの二重書込みを拒否する。

### UI側の保持先

| 保持するもの | 場所 |
|---|---|
| 読取り結果 | `app/data.ts` のキャッシュ（メソッド＋引数がキー）。Eventで該当探索だけ再取得し、古い応答は世代番号で捨てる |
| 選択・再生位置・ダイアログ | `app/store.ts`（zustand） |
| ワークスペースの配置・各領域の表示状態（カメラ、オーバーレイ、絞り込み） | `app/layout.ts`、localStorage |
| 設定値・キー割当て・最近使ったコマンド | `app/prefs.ts`、`app/commands.ts`、localStorage |

## コマンドと画面

操作はすべて `app/commands.ts` に登録する。登録項目は id、表題、分類、既定キー、対象エディタ、有効条件、チェック状態。次の5つの経路は、どれもこの登録から生成する。

- メニューバー
- 領域ヘッダーのボタン
- 右クリックメニュー
- コマンドパレット（Ctrl+Shift+P / F3）
- キー割当て

キーは、ポインタ下の領域のエディタに限定したもの（`scope`）を先に照合し、次に全体のものを照合する。設定画面でキーを変更でき、重複があれば表示する。

設定項目は `definePrefs` でスキーマとして宣言する。設定画面は、このスキーマから検索・分類・変更表示を自動生成する。

エディタは `defineEditor({type, title, group, Component, Header})` で登録する。

- 各領域のヘッダーで種類を差し替えられる。
- 領域は分割、サイズ変更、最大化（Ctrl+Space）、閉じることができる。
- ワークスペースは切り替えてもマウントしたままにするので、3Dシーンは作り直さない。

## 検証

`npm test` は次を検証する。

- エンジン：参照遷移、独立列挙との照合、差分保存と再開、バックアップ v2、候補生成、HiGHS、集計、実行制御、CAD資産
- `analysis.match`：得点内訳と `scores()` の一致、動作区間に重なりがないこと
- リンク形式の往復

`engine/reference.json.gz` は移植前のPython実装から採取した129件の入出力。テストだけが読み込む。
