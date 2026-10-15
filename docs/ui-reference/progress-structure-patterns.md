# 計算と進捗を構造で読む

対象: 候補探索・全探索・評価の開始後、現在の処理、保存済みの結果、過去の実行を取り違えずに確認する。2026-10-15調査。

## 観察と配置

変更前の `CurrentJob.tsx` は見出し、事実の文章列、バー、注意書き、結果リンクという文書順で積まれていた。`SearchProgress.tsx` も累計の見出し、四つの指標、履歴の折り畳み、集計文、表、注意書きが続いた。同じ意味の状態が複数の見出しへ現れ、今回の実行と累計を文章で読み分ける必要があった。

| 対象・意味 | 使用場面・頻度 | 配置と状態 | 採用しない構造 |
| --- | --- | --- | --- |
| 今回の処理名・実行状態・停止 | 計算中に確認する | 単一ジョブの先頭行。停止処理中/保存中は操作条件と一致させる | 見出しと別カードに同じ状態を重複 |
| 今回の制限時間/行動組数 | 計算中に予算との関係を見る | 単位を明記したメーターの値と終端 | 探索範囲全体の達成率への変換 |
| 評価の構成と現段階の件数 | 評価の現在地を追う | 構成単位の親と、現在の処理段階の子 | 均等な所要時間を暗示する固定ステッパー |
| 保存状態・結果移動 | 中断後の成果を使う | 当該ジョブのフッタ。未保存/失敗を完了と区別 | 常時通知や別の大きな成功カード |
| 過去の実行時間・増分・終了理由 | 同じ予算で続ける回を選ぶ | 比較可能な列を持つ行。再開操作はその行に属する | 全行のカード化・各行の見出し/説明/折り畳み |
| 構成別の到達範囲 | 結果を比較する | 構成を行、比較属性を列 | 局面や遷移を同じ大きさの数値カードへ展開 |

## PDFの確認

`professional_high_density_ui_patterns.pdf` p.69 の **85 Non-blocking progress** と **86 Background job queue** を `pdftoppm` でレンダーし、図を確認した。図はAutodesk Fusionの実UIを基にした再構成であり、Fusionの実操作証拠ではない。

85は主作業を継続できる小さな進捗入口、86はName/Status/Action列と処理に属する子段階を示している。本アプリには既存の計算パネルがあるため、常設の新しいキューや通知カードを足さず、そのパネル内の一つのジョブへ対応させる。複数処理の同時実行や優先順位変更は現行エンジンにないため持ち込まない。

## VS Code:文脈内の進捗と詳細への入口

- 公式画面: [Progress notification](https://code.visualstudio.com/assets/api/ux-guidelines/examples/notification-progress.png)。画像を実際に開き、処理名・現在状態・detailsリンク・細いメーターが一つの通知に収まることを確認。
- 公式ガイド: [Notifications](https://code.visualstudio.com/api/ux-guidelines/notifications)。進捗は関連するview/editor内を優先し、グローバル通知を増やさない指針。
- 固定コード: [1.95.3 progressService.ts](https://github.com/microsoft/vscode/blob/1.95.3/src/vs/workbench/services/progress/browser/progressService.ts)。`withNotificationProgress` 内の `createNotification` / `updateProgress` は通知に操作と測定値を所属させ、incrementがなければinfiniteへ分岐する。`onVisibilityChange` は通知を閉じた場合にwindow progressへ入口を移し、表示中の重複を解消する。`updateWindowProgress` は処理名と現在メッセージを一つのstatus entryへ更新する。
- 採用:処理に近い場所へ進捗をまとめる。測定値がない場合に%を生成しない。詳細や結果は対象の入口から移動。
- 不採用:通知の外観をそのまま移植すること。jobsパネル内で実行できる本アプリにtoastを追加すると表示が重複する。
- 確認範囲:公式画像と固定タグのソース。VS Code本体を操作していない。

## Blender:処理名・メーター・取消を一体化

- 公式画面: [Blender 4.3 status center](https://docs.blender.org/manual/en/4.3/_images/interface_window-system_status-bar_ui-center.png)。画像を開き、Sequence Render、94%のメーター、取消の三つが隣接する一行を確認。
- 公式説明: [4.3 Status Bar](https://docs.blender.org/manual/en/4.3/interface/window_system/status_bar.html)。web取得は402になったためcurlで同じ公式ページ・画像を取得した。
- 固定コード: [v4.3.0 interface_templates.cc](https://github.com/blender/blender/blob/v4.3.0/source/blender/editors/interface/templates/interface_templates.cc#L6142)。`uiTemplateRunningJobs` は所有者のジョブ名と `WM_jobs_progress` を読み、progress barとcancelを連結したrowへ配置する。停止中は名前がCancelingへ変わり、rowをinactiveにする。interface lock中は取消を出さない。
- 採用:取消対象がメーターと同じ処理だと配置で分かること。停止操作後の状態変化もその場所へ反映。
- 不採用:Blenderの実測完了率を探索の完全性に置換すること。本アプリの候補探索は時間予算で中断し、全作戦の網羅率を測っていない。
- 確認範囲:公式画像と固定タグのソース。Blender本体を操作していない。

## 巡回記録

1. 既存のCurrentJob/SearchProgress/indexを読み、今回/累計/履歴の混在を確認。PDF p.69をレンダーして現行データに対応する構造を選別。
2. VS Code/Blenderの公式画像と固定revisionコードを確認。ライブ進捗・履歴・配置担当へ直接、採用条件と不採用点を伝達。履歴の再開は「過去の結果の復元」ではなく「同じ予算で現在の累計を続ける」ため、結果snapshotの入口と誤認させないことも共有。

この調査枝はコード実装を所有しない。画面の最終操作検証と実装後の独立レビューは続きへ記録する。

3. 更新後の `CurrentJob` / `EvaluationProgress` / `DiscoveryHistory` を独立コードレビュー。時間枠→値/限度→メーター、構成→現段階の子行、履歴→選択回の得点差という所属を確認した。履歴の得点更新セルから選択へ到達しにくい点を担当へ返却し、同一選択操作への直接入口を提案。停止保存中に状態名が実行中へ戻らないか、ライブ担当へ契約確認を依頼した。

未着手キュー:実機OSS操作はこの枝の範囲外。追加のジョブキュー、履歴の優先順位変更、架空の完了率は現在の処理モデルにないため実装候補から除外した。独立コードレビューで見つけた二点は各実装担当へ直接引き継ぎ、最終ブラウザー検証は統合担当の記録を参照する。
