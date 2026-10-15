# ワークスペース間の共通文脈

## 対象と観察

対象は候補一覧で見ている候補、3Dへ開いた経路、比較へ固定した経路の識別と、その表示元への移動。ワークスペースは配置を切り替えるため、作業対象の寿命とは分ける。

変更前の `TopBar.tsx` は探索名、`StatusBar.tsx` は選択物・局面・再生時刻を別々に表示していた。候補一覧の選択と表示経路の由来を結ぶ情報がなく、これらを新しい帯へそのまま追加すると上下の重複になる。

## 参照したパターン

PDF `docs/professional_high_density_ui_patterns.pdf` は参考資料として扱った。抽出テキストと p21、p45 の図を確認した。図は資料が再構成したもので、製品のスクリーンショットそのものではない。

- p21 #16 Breadcrumbs: 現在地の短い一行から周辺の対象へ移動する。常に全候補を並べない。
- p24 #20 Reveal: 対象から別の表現へ移動する。選択のたびに表示を強制移動せず、明示操作にする。
- p35 #36 Selection truth: 選択の伝播を一つの状態として扱う。ただし、固定済みの比較や表示経路を一覧選択と同一視しない。
- p45 #51 Inspector: 対象名は内容の直前、固定はその対象名の近くに置く。

### VS Code: 現在地を入口へ集約

公式の [Breadcrumbs説明](https://code.visualstudio.com/docs/editing/editingevolved#_breadcrumbs)、[一行の画面](https://code.visualstudio.com/assets/docs/editing/editingevolved/breadcrumbs.png)、[選択時の画面](https://code.visualstudio.com/assets/docs/editing/editingevolved/breadcrumb-folder-dropdown.png) を確認した。現対象の位置を細い行で示し、選択時だけ兄弟対象を出す。

固定タグ [1.95.3 `breadcrumbsControl.ts`](https://github.com/microsoft/vscode/blob/1.95.3/src/vs/workbench/browser/parts/editor/breadcrumbsControl.ts) の `BreadcrumbsControl.update`、`_onSelectEvent`、`_onFocusEvent`、`breadcrumbs.escape` を読んだ。表示可否はactive editorのresourceに従う。選択時はpickerかrevealへ分岐し、popupのblurとEscapeを扱う。選択せず閉じた場合はpickerのview stateを戻す。画面幅と下端からpopup位置・高さを制限している。

採用する構造は、現在表示中の対象を短い入口へまとめ、必要時だけ詳細と移動操作を出すこと。探索・候補・相手は必ずしも木構造ではないため、すべてを階層記号で結んだ偽のパンくずにはしない。VS Code本体は実操作していない。

### Blender: 表示対象の由来と固定を近接

公式 [4.3 Properties](https://docs.blender.org/manual/en/4.3/editors/properties_editor.html) と [上部の画面](https://docs.blender.org/manual/en/4.3/_images/editors_properties-editor_top.png) を確認した。画面は `Cube > Material` と右端のpinを同じ行に置く。manual本文はpin中のeditorが後続の選択変化に追従しないことを説明している。web fetchでは402となったため、公式ページをcurlで取得して読んだ。

固定タグ [v4.3.0 `buttons_context.cc`](https://github.com/blender/blender/blob/v4.3.0/source/blender/editors/space_buttons/buttons_context.cc) の `buttons_context_path` は `pinid` がある場合に固定IDをpath rootへ設定し、なければactive sceneを使う。`buttons_context_draw` はpathとpin操作を同じ行へ描画する。

採用する構造は、比較A/Bの由来を各列の見出しや表示経路の切替に置き、現在の選択から独立したsnapshotとして扱うこと。新しい固定機能やglobalな比較カードは追加しない。Blender本体は実操作していない。

## 配置判断

| 情報・操作 | 使用場面・状態 | 配置と理由 |
| --- | --- | --- |
| 探索名 | 全作業の対象識別 | 既存タイトル位置を利用し、別の常設欄に複製しない |
| 表示中の経路の由来 | workspace切替後に試合を確認 | 一つの共通入口。経路に由来がない場合は「不明」や手動操作を正直に示す |
| 一覧で選択中の候補 | 候補の比較・開く判断 | 候補一覧に残す。表示経路との違いがある時だけ違いを共通入口で伝える |
| 構成・相手条件・詳細ID | 結果の前提を調べる | 共通入口の詳細。表示中経路の取得時の値を用い、現在編集値と混ぜない |
| 局面と再生位置 | 切替先で同じ時間を追う | 共通文脈内で現在値を残す場合、既存StatusBarから重複を削る。再生操作自体はTimeline |
| 表示元へ戻る | 経路から候補一覧へ戻る | 文脈の近くの明示Reveal。元候補が存在しない場合は無効理由を示す |
| 比較A/B | 固定した二つの経路を照合 | 比較列と3D経路selectorに属する。global帯へ並べない |
| 計算進捗 | 別作業中の実行監視 | 下部status。対象文脈と役割を分ける |

## 調査枝の記録

1巡目はPDFと変更前shellを照合し、各値を並列に追加する案を棄却した。2巡目は公式画面と固定タグのコードを確認し、入口への集約・明示Reveal・固定snapshotの三つの異なる役割を各担当へ共有した。新しい常設Inspector、比較A/Bのglobalカード、常時の五連ボタンは対象の重複が増えるため採用しない。

実装後レビューは別担当のブラウザー検証結果と変更コードを照合する。メニューのEscape、フォーカス復帰、狭幅で現在対象が残ること、表示元へ戻っても経路が変わらないことを確認対象とする。

3巡目は実装中の `ReplayContext.tsx`、`TopBar.tsx`、`StatusBar.tsx`、比較列の差分を独立レビューした。既存の探索selectorに単一入口を接続し、再生位置は下部へ残す構成は常設情報の重複を抑えている。popup内の探索・局面は展開時のみなので現在値の確認に使える。

追加で見つけた点は担当へ直接送った。狭幅で「表示中」を消すと一覧選択との区別が弱まるため文脈名を残すこと、popoverのキーボード開始・Escape後の復帰を操作で確認すること、比較snapshotのbaselineを「相手待機」と明示すること、候補名へ圧縮するとき構成の由来を落とさないこと。ブラウザー実操作は統合担当の検証範囲とし、この調査枝では実施済みとは扱わない。

この枝は研究資料と独立コードレビューを3巡実施した。追加委譲はなし。実装の修正と実操作確認はsurface・comparison・統合担当へ接続済みであり、独立した新UIをこの調査枝から追加する未処理案はない。
