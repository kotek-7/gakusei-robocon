# 解析領域のアイコン操作

対象: evaluation / graph / properties / score / timeline / events / outliner / compare / review。spots は既存の前後移動・継続区間への移動がアイコン化済みで、スポット番号や所有状態は読む対象なので維持した。

## 調査

- PDF `professional_high_density_ui_patterns.pdf` の項目 95、p. 75–76「Icon-only controls with labels on demand」。標準の反復操作をアイコンにし、名前を hover / focus で得る構造を採用。未知の業務操作を全て記号へ置き換える構造は採用しない。
- [Blender v4.3.0 `space_dopesheet.py`](https://github.com/blender/blender/blob/v4.3.0/scripts/startup/bl_ui/space_dopesheet.py) `dopesheet_filter`, `DOPESHEET_HT_editor_buttons.draw_header`。表示対象を絞る FILTER はヘッダーから開き、内容では名称を表示。今回はタイムラインと履歴のフィルター入口へ適用し、選択中のイベント種類は表示したままにした。[公式画面資料](https://docs.blender.org/manual/en/4.3/editors/dope_sheet/introduction.html)は取得失敗のため未確認。この根拠はソース確認に限定する。
- [VS Code 1.95.0 `debugToolBar.ts`](https://github.com/microsoft/vscode/blob/1.95.0/src/vs/workbench/contrib/debug/browser/debugToolBar.ts) の DebugToolBar。操作名・実行可否とコンパクトなツールバーを組み合わせる構造を、時間移動・表示対象への移動・ファイル出力に適用。[公式デバッグ画面資料](https://code.visualstudio.com/docs/debugtest/debugging)も参照。VS Code / Blender のローカル実機操作は行っていない。

## 操作ごとの配置

| 対象 | 意味・状態 | 変更理由 |
|---|---|---|
| 区間解析の時刻欄の隣 | 区間表示へ fit / 解除 | 数値は残し、反復する操作名だけを除く。解除の無効条件を維持。 |
| 各機体の最長待機 | 行に属する時刻への移動 | 時計。機体名をアクセス可能名へ含め、どの行に作用するか保持。 |
| 動作の区間設定 | 行の開始〜終了を解析対象へ | range。元の時刻・秒数は常に見える。 |
| 得点・比較の開始／終了 | 表示区間の端へ移動 | first / last を並べ、時刻値は残す。 |
| 局面保存・差分保存 | 対象をJSONとしてダウンロード | download。局面と差分それぞれの内容に隣接。 |
| プロパティの履歴・区間 | 別の解析領域を開く | history / range。元の選択を変更しない。 |
| 評価結果の書出し・解除 | 現在の表示集合への操作 | download / reset をフィルターの隣に固定。結果指標の名称は保持。 |
| 検討記録の複製・削除 | 選択された記録への操作 | copy / trash を詳細のフッターへ。記録作成・表示は短いテキスト付きのまま。 |
| 記録の一覧書出し | 表示中の集合への操作 | copy / download を一覧ツールバーの右端へ直接置き、書出しだけの折り畳みを廃止。 |
| タイムラインの対象機体 | 表示機体の選択 | robot。絞られている場合は押下状態、名称には表示機体数を含む。 |
| アウトライナーの機体 | 対象種類の識別 | 物体と同じ cube から robot に変更。名前・状態はテキストを保持。 |
| グラフの次の未展開局面 | 順送り | nextEvent を未展開件数に隣接。未展開ゼロで無効。 |

標準操作は共通 IconButton を用い、title / aria-label / キーボードフォーカス時の名前表示を共通化。数値、チーム、試合展開、構成の選択肢、評価の前提はアイコンへ変換しない。

## 実施した巡回

本枝は 4 回のソース・レイアウト契約確認を実施。これはブラウザーでの実操作回数ではない。

1. 既存操作を抽出。既にアイコンの領域と、標準操作名が反復する領域を識別。
2. 区間・比較・得点・プロパティ・評価・記録の動作を置換。既存ハンドラーと disabled 条件を保持。
3. ヘッダーの絞り込み・機体選択・グラフへ展開。選択中イベント名、機体数、アクセス可能名を再点検。
4. 物体と機体が同じアイコンだったアウトライナーを修正。厳密な IconName 型を伝播。履歴を開く操作が機体絞り込みまで保証しないため、その名称から誤った限定を除去。

実操作、狭いパネル、保存済み状態の確認は統合担当のブラウザー確認へ接続する。モデル・探索処理には変更なし。本枝ではコミットしない。
