# 学ロボ / ABU 2027 作戦探索

ルールを動かせる形にし、ロボット性能を変えながら作戦候補を比較するPython製の実験環境です。Python 3.10以上、標準ライブラリのみで動作します。

- [ルールモデル・仮定・未解決事項](docs/model.md)
- [初回結果の要点](results/baseline/summary.md)
- [初回実験レポート](results/baseline/report.md)
- [作戦の着眼点と時間収支](docs/strategy.md)
- [変更可能な所要時間](configs/performances.json)
- [公式資料との照合記録](docs/sources.json)

```sh
python3 -m unittest discover -s tests -v
python3 -m abu2027.experiment
```

実行場所はこのフォルダ。実験は108作戦×108相手作戦×2優先順×5性能条件の116,640試合、信頼性の有限サンプル、短い終盤の完全探索を実行します。結果は `results/baseline/` に保存します。再実行時は同名ファイルを更新します。別の試行は `--config configs/performances.json --output results/my-run` で保存できます。

所要時間は仮定です。108作戦の総当たりを「全戦略の全探索」とは呼びません。合法操作を省略したマクロモデルであり、経路・衝突・観測誤差・公式リトライの詳細などは未実装です。詳細と次の検証条件はモデル文書を参照してください。

## 構成

- `abu2027/model.py`: 得点、資格、合法マクロ行動、4台並列のイベント処理、物体数の保存検査
- `abu2027/search.py`: 108方策、試合実行、打ち切りを明示する到達状態の完全探索
- `abu2027/experiment.py`: 全対戦表・順位・動作時系列・再現条件の出力
- `tests/test_model.py`: ルール境界、同時競合、失敗時の物体保存、探索完了判定

`winner=0`は定量タイブレークでも決まらず審判判断が必要な状態です。実大会での引き分けを意味しません。

## 追加実験

```sh
python3 -m abu2027.sensitivity
python3 -m pip install -r requirements-game.txt
python3 -m abu2027.game
```

感度分析は先に基本実験を実行してから使います。基準条件で選んだ3作戦を固定して、一系統の所要時間だけを変え、108相手に対して再評価します。追加で16,200試合を実行します。

`game`のみ追加依存SciPyが必要です。短い終盤の同時行動ゲームを、混合戦略を許した線形計画と後ろ向き計算で解きます。目的は期待得点差であり勝率ではありません。現在の例題は6秒・71状態で、競技全体の解ではありません。

## 局面を指定する

`configs/endgame.json`を複製して時刻・塔の状態・在庫・性能を編集します。物体数が保存されていなければ実行時にエラーになります。

```sh
python3 -m abu2027.explore configs/endgame.json --mode reachable --max-states 10000 --output results/my-endgame.json
python3 -m abu2027.explore configs/endgame.json --mode game --max-states 10000 --output results/my-game.json
```

`reachable`は到達可能な状態を列挙し、`game`は相手の最善応答を含めて期待得点差を解きます。`complete=false`の結果を完全探索の結果として扱わないでください。`--priority 0`と`--priority 1`で同時競合の扱いを比較できます。

```sh
python3 -m abu2027.portfolio
```

全対戦表が揃った後、候補作戦を確率的に選ぶ場合の最大最小値も計算できます。SciPyを使います。相手は候補作戦と同時競合の優先順を選べる仮定です。実大会の勝率予測とは区別してください。
