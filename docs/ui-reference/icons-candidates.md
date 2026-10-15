# 候補一覧・検査のアイコン運用

## 対象と配置

候補、比較表、選択中の展開に対する操作だけを変更。候補名、点差、実行不可理由、機体、相手手順の意味は文字で保持する。検索の虫眼鏡と並び順の矢印は入力・選択欄の直前に置き、入力自身にも日本語の accessible name を付ける。

| 対象 | 操作と配置 | 判断 |
| --- | --- | --- |
| 表示候補 | 書出は download、表示条件は save＋短いラベル | 表示対象に作用する既存ツール列に保持。保存条件は固有機能なので文字を残す |
| 比較対象 | plus＋比較に追加、minus、列見出しの close | 一括対象と個別対象を場所で区別。データ削除ではないため trash は使わない |
| 選択候補 | inspect＋作戦詳細、search＋追加探索 | 閲覧と計算の入口は初見で区別する必要があり短い文字を残す |
| 選択展開 | ortho＋3D、pin＋A/B、splitH＋A/B | 表示先、割当先を文字で保持。割当と比較を開く操作を区別 |
| 実行不可 | back/forward、時刻＋ortho | 件数・時刻を残し、繰り返しの移動文を省く |
| 保存条件 | close、undo、trash | popover 内の保存条件を対象とする。新規保存と更新の違いは文字を維持 |
| フィルター | reset | 保存値へ戻す undo とは別の記号を使用 |

全アイコン操作は共有 IconButton の title、aria-label、キーボードフォーカス時のラベル表示を使う。既存コマンド・disabled 条件・保存・選択の契約を維持。

## 参照

- PDF パターン95、75–76ページ「Icon-only controls with labels on demand」：標準的な頻用操作をアイコン化し、未知の操作には文字を残す。パターン24/25の常設ツールバーと選択文脈ツールバーも参照。PDFは参考カタログとして扱う。
- [VS Code 1.105.0 searchIcons.ts](https://github.com/microsoft/vscode/blob/1.105.0/src/vs/workbench/contrib/search/browser/searchIcons.ts)：`searchRemoveIcon` は close、`searchViewIcon` は search、一覧/木構造を別記号として登録。表から外す操作に trash を使わない根拠。ソースを実読。
- [VS Code 1.105.0 searchActionsBase.ts](https://github.com/microsoft/vscode/blob/1.105.0/src/vs/workbench/contrib/search/browser/searchActionsBase.ts)：`getElementsToOperateOn` が選択範囲と現在フォーカスを区別。既存の表示中一括比較と列単位解除を同一の無文脈ツールバーへ移さない根拠。
- [VS Code UI公式資料](https://code.visualstudio.com/docs/editing/getting-started/userinterface)：Activity Bar／ビュー内操作の画面資料を参照。VS Code実機は操作していない。編集・検索置換の機能そのものは持ち込まない。

## 局所レビュー

1. 候補一覧の長い操作名・領域移動・保存条件を棚卸し。ドメインのデータラベルを無差別に図形へ変える案は不採用。
2. 候補の詳細／追加探索／3D／比較割当を短縮。計算と閲覧の区別が消える全アイコン化は不採用。
3. 比較表・実行不可・完了記録の反復操作へ展開。列から外す close と表示条件削除 trash を区別。
4. 検索・並び順・適用中条件の × を SVG に統一。検索欄の accessible name を追加。
5. CSSと型検査を確認。書出操作の既存右寄せ class を保持。共通 IconButton のキーボードラベルと統合し、実画面の操作・狭幅確認は親担当へ引継ぎ。

本枝はソース確認と実装の5巡で、実画面5巡ではない。型検査では候補領域のエラーなし（同時編集中の outliner の IconName エラーを親へ報告）。候補の動作ロジックは変更していない。追加の記号化より意味の保持が必要な固有ラベルを残した状態で終了。
