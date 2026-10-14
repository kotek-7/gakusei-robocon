---
name: 学生ロボコン 作戦ノート
description: 機体条件と作戦を編集し、同条件の対戦を比較する作業画面
colors:
  accent: "#006b65"
  surface: "#ffffff"
  ink: "#24312e"
  muted: "#58645f"
  line: "#dce2de"
  selected: "#e5f1ed"
  wash: "#f5f7f5"
  control-line: "#bcc7c1"
  selected-ink: "#004e47"
  accent-hover: "#00544e"
  team-red: "#a52e35"
  team-blue: "#2855ae"
typography:
  headline:
    fontFamily: 'system-ui, "Noto Sans JP", sans-serif'
    fontSize: "21px"
    fontWeight: 650
    lineHeight: 1.45
  section:
    fontFamily: 'system-ui, "Noto Sans JP", sans-serif'
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.45
  body:
    fontFamily: 'system-ui, "Noto Sans JP", sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: 'system-ui, "Noto Sans JP", sans-serif'
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  control: "4px"
spacing:
  small: "8px"
  medium: "16px"
  section: "24px"
  workspace: "28px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "7px 11px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "7px 11px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "7px 11px"
  navigation:
    textColor: "{colors.muted}"
    padding: "10px 2px"
  score-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.selected-ink}"
    rounded: "{rounded.control}"
    padding: "7px 4px"
---

# 学生ロボコン 作戦ノートの画面設計

## 基本構成

白い作業面を文字、余白、細い罫線で区切る。機体条件と作戦を編集し、比較表から選んだ試合を3Dで調べる。普段の操作を増やさず、対象に関する補助操作をその場で開ける構成とする。

主要な移動先は「作戦比較」「作戦編集」「機体条件」。ファイル、編集、表示の共通操作は上部のメニューへ置く。計算は比較領域、再生は3D領域で操作する。

## 色と文字

操作と選択にはティールを使う。`accent`は主操作とフォーカス、`selected`は選択面、`selected-ink`はその文字色。赤と青は競技上の所属を表す。

`surface`は作業面、`ink`は本文、`muted`は補助説明、`line`は区切り、`wash`は見出しやホバーの背景、`control-line`は入力とボタンの境界に使う。

日本語を含むシステムサンセリフを使う。通常本文は14px、主要見出しは21px、小見出しは16px、表と補足は12pxを基準にする。得点と再生時刻は等幅数字で揃える。表示密度は設定から変更できる。

## 配置

ページの最大幅は1800px。幅1100px以上では比較・編集の右に再生領域を置く。再生領域の初期幅は480pxで、境界のドラッグまたは矢印キーで調整できる。狭い画面では縦に並べる。

比較表は横スクロールに対応し、作戦名の列を固定する。650px以下では横スクロールの案内を表示する。表の数値から選んだ試合の条件と名称を再生領域の近くに置く。

3Dの「広げる」は再生領域を画面いっぱいに表示する。戻ると比較画面の選択とスクロール位置を保持する。対象の状態は右側、操作履歴・得点推移・メモは下側で開く。対象詳細の幅も変更でき、狭い画面では3Dに重ねて表示する。

## 補助操作

3D上部に全体表示、視点、表示、対象の操作を置き、その下に再生、時刻、タイムライン、速度を並べる。イベントへの移動、区間、詳細、基準比較はメニューから開く。

追従、選択対象以外の薄い表示、区間指定、履歴の絞り込みは使用中の状態と解除操作を示す。右クリックで開く対象メニューはボタンからも利用できる。重なる対象は候補から選択する。

作戦や条件のコピー・復元・派生案などは対象の近くに置く。入力値には単位と適用範囲を添える。作戦の取り消しと視点を戻す操作は分ける。

## 面と状態

通常の作業面は罫線と余白で区切る。影は開いたメニュー、拡大ビュー、重なる詳細パネルに限定する。入力と通常ボタンの角丸は4px。ナビゲーションの現在地は下線と太字で示す。

主操作はティール地に白文字、通常操作は白地と細い枠。標準の操作高さは36pxを基準とし、表や再生領域では用途に合わせて調整する。キーボードフォーカスを明示し、幅調整・メニュー・対象選択をキーボードでも操作できるようにする。

未計算、計算中、失敗、基準不足は文字で区別する。選択は枠と押下状態でも示す。空欄にゼロ点を補わない。動きを減らす設定では装飾的な遷移を止める。
