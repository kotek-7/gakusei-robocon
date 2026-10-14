# エディタ操作の改善

2026-10-15。既存の表、経路、選択、再生位置を使って検討を速めるための変更。3Dの表現や競技モデル、探索アルゴリズムは変更していない。

## 調査したOSS

見た目の模倣より、既存の対象に操作を付ける実装を参照した。

- [Blender Preferences](https://github.com/blender/blender/blob/main/scripts/startup/bl_ui/space_userpref.py)：検索、変更状態、設定復元。条件の検索・変更行抽出・復元に採用。
- [Blender property context menu](https://github.com/blender/blender/blob/main/source/blender/editors/interface/interface_context_menu.cc)：プロパティの復元と複数対象への操作。条件の行復元と候補の一括選択に応用。
- [Blender Outliner](https://github.com/blender/blender/blob/main/scripts/startup/bl_ui/space_outliner.py)、[tree implementation](https://github.com/blender/blender/blob/main/source/blender/editors/space_outliner/outliner_tree.cc)：検索、フィルタ、階層操作。候補検索とアウトライナー操作に応用。
- [Blender Dope Sheet](https://github.com/blender/blender/blob/main/scripts/startup/bl_ui/space_dopesheet.py)：現在の対象を絞って移動する操作。履歴と変化点の前後移動に応用。
- [VS Code diff commands](https://github.com/microsoft/vscode/blob/main/src/vs/editor/browser/widget/diffEditor/commands.ts)：同じ箇所を隠して差分をたどる操作。A/Bの同値行非表示と点差変化への移動に応用。

参照したのは操作の構成で、ソースコードは転載していない。

## 確認と再検討

各担当が画面・コードを確認して実装し、その結果を再確認した。最後に別担当が横断レビューした。

| 対象 | 最初の観察と変更 | 再確認で追加・修正した点 |
|---|---|---|
| 条件 | 数値候補を毎行選び直していたため、一括選択と取り消しを追加 | 変更行を追いづらいため、検索・変更のみ表示・行復元を追加。数値が両チーム共通であることも明示 |
| 候補 | 一覧から比較すべき経路を探す負担があったため、検索・並び替え・最小点差経路への直接移動を追加 | 探索切替時は表示条件をリセットし、存在しない構成で空表示にならないよう修正 |
| A/B・評価 | 同値の行が多いため差のある項目だけの表示と変化点移動を追加。相手構成表から構成を切替可能に変更 | 同経路比較では差なしを明示。移動対象は両経路の共通時間内に限定 |
| 履歴・得点・スポット | 目的の時刻を探す負担を、表示対象の前後移動で削減 | 得点変化点をメモ化し、狭い得点表の横溢れを修正 |
| アウトライナー | 検索とピン抽出を折畳み越しに適用、矢印キーで階層移動 | 構成間で同じ候補IDが使われるため行IDに構成を含めた。初回クリックで閉じない不具合も修正 |
| グラフ・プロパティ | 幅合わせと遷移検索を追加 | 長いグラフでも収まるよう倍率下限を撤廃。検索語がある間は検索欄を隠さない |
| 計算履歴・前提 | 更新のあった計算回を抽出、用語・前提を検索 | 定義を直接開く導線、空結果、ルール値の日本語表示、狭幅の縦配置を追加 |
| 共通操作 | コマンド検索で実行可能な操作を抽出 | キー選択のスクロール追従、日本語変換中のEnter保護、狭幅での上部メニュー切れを修正 |

## 検証

`npm test` はエディタ配下も含めて再帰的にテストを収集する。取り消し履歴、比較時刻の境界、階層検索とピン、参照先の表示を検証する。`npm run build` で型検査と配信用ビルドを実施する。

実ブラウザでは、条件の一括変更と取り消し・やり直し、候補検索と最小点差経路への移動、保存した経路のA/B比較、履歴・得点への移動、階層検索とキーボード移動、グラフ幅合わせ、用語検索、履歴抽出を確認した。追加した候補操作の順位検査には小さいテスト用データも使用した。

比較する相手手順が限定される点、未探索分岐が残る点は従来と同じ。操作の追加によって最適性や実大会の勝率を保証するものではない。
