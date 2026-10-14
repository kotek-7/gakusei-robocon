---
name: workbench-review
description: このリポジトリの作戦探索アプリ（web/）のUIを機能単位でレビュー・拡充するときに使う。機能ノードごとの「使う→考案→実装→検証」サイクル、プロツール準拠の機能密度チェック、anti-slop チェック（impeccable の Operate モード、taste-skill の lint、humanizer による文言確認）をまとめる。
---

# 作業台レビュー

対象は Operate モードのアプリ画面（impeccable の分類）。taste-skill はマーケティングページ向けなので、使うのは lint と tells の禁止項目だけにする。画像枚数、ヒーロー、モーションの規則はこのアプリには適用しない。

## 機能単位サイクル

1. **使う**: `npm run build && npm run preview` を起動し、Playwright（`executablePath: '/opt/pw-browsers/chromium'`）でその機能だけを実際に操作する。タスクは競技の文脈で決める（例：「反転の瞬間を探して寄る」）。スクリーンショットを撮って Read で見る。
2. **突き合わせる**: `docs/ui-reference.md` から同種の UI 位置にある項目を引く。対象はヘッダー、右クリック、端のボタン、設定、ショートカット。
3. **考案する**: 子機能を次の4観点で挙げる。
   - 速さ: ショートカット、一括操作、直前操作の繰り返し
   - 深さ: 詳細設定、詳細ビュー、数値入力
   - つながり: 選択の同期、他エディタへのジャンプ、A/B
   - 見通し: オーバーレイ、凡例、状態表示

   挙げたものは `docs/feature-tree.md` のノード配下に書く。採らなかった案は理由も残す。
4. **実装する**: 操作はすべて `app/commands` に登録する。メニュー、ツールバー、右クリック、キーマップ、パレットには登録したコマンドから出す。
5. **検証する**: `npm test && npm run typecheck && npm run build` を通し、Playwright で再操作する。
6. **再帰する**: 実装した子機能をそれぞれ新しいノードとして 1 に戻る。価値ある子機能が出なくなったら「飽和」と記録して止める。

## anti-slop チェック（毎サイクル）

- `node .claude/skills/taste-skill/scripts/lint.mjs web/src` を実行する。次の WARN/FAIL は Operate 画面では許容し、`taste-skill-ignore` は付けない。
  - 表、ツールバー、パネルの境界線（hairline、outlined-box）
  - メニュー、ダイアログ、ポップオーバーの影
  - 数値表示の tabular と等幅（数値列、局面 ID）

  それ以外の FAIL は修正する。対象は emoji、gradient、紫、装飾番号、eyebrow など。
- impeccable の `reference/operate.md` と `reference/craft-floor.md` の禁止事項に照らしてスクリーンショットを確認する。
- 次のものは削除する。
  - 説明文の段落
  - 同じ情報の重複表示
  - 装飾的な指標カード
  - 意味のないアイコン
  - 「〜できます」調の案内文
- UI 文言は humanizer の観点で短くする。ボタンには動詞を書き、状態は事実だけを書く。

## 守る原則（PRODUCT.md）

- 未探索、未完了、保証なしを隠さない。
- 作戦の解釈名を発明しない。
- 色だけで状態を伝えない。
