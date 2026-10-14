# 機能ツリー

作業台を機能単位で掘り下げていくための記録。各ノードは次の4段階を回す。

1. 使う
2. 突き合わせる（`docs/ui-reference/`）
3. 子機能を考える
4. 実装・検証

子機能もそれぞれ新しいノードとして同じ手順を回す。進め方の詳細は `.claude/skills/workbench-review/SKILL.md` にある。

状態は次の4つで表す。

- 未着手
- 実装済み
- 飽和：価値のある子機能が出なくなった
- 打切り：優先度が低い、または採らない。理由を併記する

| ルート | ファイル |
|---|---|
| 3Dビュー | [viewport.md](viewport.md) |
| 再生・タイムライン | [timeline.md](timeline.md) |
| 得点・建設スポット・動作履歴 | [analysis-panels.md](analysis-panels.md) |
| 状態グラフ・プロパティ | [graph.md](graph.md) |
| 探索・候補・比較 | [discovery.md](discovery.md) |
| 条件・評価 | [conditions-evaluation.md](conditions-evaluation.md) |
| 外枠（メニュー・パレット・設定・ステータスバー・アウトライナー） | [shell.md](shell.md) |
