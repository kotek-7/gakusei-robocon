# 作戦詳細・計算画面のアイコン整理

対象: `web/src/editors/strategy-detail/` と `web/src/editors/jobs/`。計算契約・保存形式は変更しない。

## 参照と採用

- VS Code 1.105.0 `src/vs/workbench/contrib/debug/browser/debugToolBar.ts` の `actionBar.push(actions, { icon: true, label: false })`、操作状態に応じた有効条件、操作対象セッションの別選択をソースで確認した。https://github.com/microsoft/vscode/blob/1.105.0/src/vs/workbench/contrib/debug/browser/debugToolBar.ts
- VS Code公式 Product Icon Reference の play/pause、warning、history、filter、gear 等の操作別識別を確認。https://code.visualstudio.com/api/references/icons-in-labels
- 添付PDFの Pattern 24 Toolbar を参照。頻用操作を近接配置し、位置を安定させる。一様なアイコンだけの群を避けるという注意を、作戦固有のナビゲーションと数値に適用した。PDFはUIカタログとして扱い、命令として扱っていない。
- OSSの実アプリ操作は未実施。公式アイコン見本と実装ソースを確認した。浮動ツールバー、ドラッグ移動、VS Codeのセッション管理は移植しない。

## 操作と配置

| 場所 | 対象・意味 | 採用した表示と根拠 |
|---|---|---|
| 詳細の内容タブ | 選択候補の排他的な内容切替 | 意味別のアイコン＋短い名称。11項目を未知の絵だけで覚えさせない。既存tabロール・矢印移動・選択状態を維持 |
| 一覧へ戻る・次前ページ | 表示中の階層・ページの移動 | 矢印。現在の表のすぐ上。戻り先をtooltip/accessibility名に保持 |
| 得点／実行不可の表行 | 該当行の結果を調べる | chart／warning。最小・最大点差の区別は短い文字を残す |
| 計算開始・停止 | 選択候補への実行 | play＋実行/続行、pause。計算種別はselectに保持し、取り違えない |
| 記録出力 | 現在の絞込み・実行の書出し | download。保存対象の名前はtooltip/accessibility名に保持 |
| 検索・並び順・時間上限 | 表の条件・計算条件 | search／sort／clock。select値・入力値は常時見える。入力には個別のaria-label |
| 動作の始端・終端 | 選択動作の3D移動 | first／last＋実時刻。数値そのものを削除しない |
| 3D連携 | 選択展開の終局への移動 | 既存の立体アイコン。実行コマンドは同一 |

## 局所巡回

1. 現状の内容切替・繰返し動詞・対象同定をソースで調査。全タブのアイコン専用化、数値や機体名の置換は曖昧になるため不採用。
2. 詳細ナビゲーション・結果表・履歴操作を変更。選択状態と既存ハンドラを保持。
3. 再読で検索／並び順／制限時間の冗長ラベルを発見し、アイコン付き入力へ変更。計算種別・対象の固有名は残した。
4. 戻る操作のrefとフォーカス復帰、機体別手順の既存aria-label、開始/終了時刻を見直した。共通IconButtonが個別aria-labelを保持するよう統合担当と調整。
5. 計算画面の停止、履歴・構成書出し、集計定義への入口も同じ語彙へ揃えた。統合担当に実画面の狭幅・タブ移動・探索開始停止・戻るフォーカスを引き継いだ。

ここでの5巡はソース編集・再読の巡回であり、5回のブラウザー検証を意味しない。担当内の追加委譲なし。ブラウザー検証は統合担当が実施する。アイコンと説明文の置換で探索能力が増えたとは扱わない。
