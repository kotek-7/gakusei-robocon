# 比較経路の表示元

## 対象と配置

A/B比較は保存した2経路、通常の3Dは共通の現在経路を表示する。候補一覧の選択と比較経路は独立している。比較表の既存列見出しに「A 固定」「B 固定」と候補・相手名を置く。3Dでは既存の経路選択欄を「現在の経路 / A 固定 / B 固定」に変更し、由来は同じ欄のtooltipとaria-descriptionへ収める。説明カードや別の状態行は追加しない。

固定操作は既存の列見出し内pinを使う。現在の経路がない場合は無効。比較表の導入説明を削除し、その内容を実データの列見出しへ移した。

## 参照

- `professional_high_density_ui_patterns.pdf` p45、#51 Inspector図を画像で確認。対象名と固定操作を領域上端へ集約する構造を参照。PDFは再構成図であり、Unity実機確認ではない。
- Blender v4.3.0 `source/blender/editors/space_buttons/buttons_context.cc`。調査担当context_patternsが確認した `buttons_context_path` はpinidがあれば固定IDをrootにし、なければactive sceneをrootにする。`buttons_context_draw` はcontext pathとpinを同じ行に収める。https://github.com/blender/blender/blob/v4.3.0/source/blender/editors/space_buttons/buttons_context.cc
- 採用範囲は固定対象と追従対象の明確な区別。比較表や3DへInspector全体を追加する案は、別の情報列が増えるため採用しない。

## 巡回

1. 列見出しと経路selectorを再構成。候補・相手のsource snapshotを使用し、A/Bを変更しても一覧選択と混同しない文言へ変更。
2. 呼出経路を読み直し、比較A未設定時に現在経路へfallbackしていた点を修正。`useFrame(null)`が現在局面を返す問題も修正し、明示経路の読み込み待ちには他の局面を表示しない。canvasは以前のframeを保持するため、未読込時は隠す。既存の未設定noteをA/B共通にする。
3. 空探索でnoteが重複する条件を除去し、WebGLエラーは隠さない。比較表の操作不能状態、由来欄の長文折返し、selectorのaccessible descriptionを確認。context_patterns担当の独立レビューを受け、baselineの「相手待機」が比較側で欠ける点も修正。

4. 統合レビューで同名候補・異なる構成の識別不足を確認し、既存列見出し内に「構成 C番号 · 候補ID」を追加。3Dの由来tooltipとaccessible descriptionにも同じ識別情報を追加。初回は候補ID全文を表示した。

5. 統合スクリーンショットでID全文が比較表を押し広げ、B列が見えない不具合を確認。候補IDは共通欄と同じ先頭14文字、相手IDは先頭10文字に短縮し、全文をtitleへ保持。表を固定列幅にしてA/B両列を常時同じ表示幅に収める。

## 検証と残件

`npm --prefix web run typecheck` 成功。対象差分の `git diff --check` 成功。実ブラウザのA/B固定、未設定から現在経路への復帰、再読み込みの確認は統合担当の同一画面検証へ接続する。ローカルでブラウザ確認済みとは扱わない。

担当context_comparison、下位委譲なし。独立した新規機能は追加しない。今回の範囲は比較表示の由来と固定状態であり、比較評価の条件やカメラ操作は変更しない。
