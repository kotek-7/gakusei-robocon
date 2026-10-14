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

# Design System: 学生ロボコン 作戦ノート

## Overview

**Creative North Star: "競技分析の作業台"**

白いページで機体条件、編集できる作戦、同条件の対戦比較を扱う。余白と細い罫線で領域を分け、数値から選んだ試合の動きまで追える密度を保つ。

**Key Characteristics:**
- 白い面と控えめな中間色で表と編集項目を読みやすくする。
- ティールは操作と選択、赤と青は競技上の所属を示す。
- 得点差の選択と試合表示を同じ条件でつなぐ。

## Colors

操作には落ち着いたティール、本文には緑みのある暗色を使う。白いページに淡い背景と罫線を組み合わせる。

### Primary

`accent`は主操作とフォーカス、`selected`は選択セルと選択ボタン、`selected-ink`はその文字色。主操作のホバーには`accent-hover`を使う。

### Secondary

`team-red`と`team-blue`は再生中のチーム得点の識別に使う。

### Neutral

`surface`はページと操作面、`ink`は本文、`muted`は補助説明、`line`は区切り。`wash`は表見出し・未計算試合の案内・通常ボタンのホバー、`control-line`は入力とボタンの境界に使う。

## Typography

日本語を含むシステムサンセリフを使う。通常本文はbody、主要見出しはheadline、小見出しはsection、表と補足はlabelを基準にする。表見出しと再生補足には11px、入力行には13pxも使う。650px以下ではアプリ名を19px、画面見出しを20pxにする。得点差と再生時刻は等幅数字で揃える。

## Layout

ページの最大幅は1800px、左右余白は28px。650px以下では16pxにする。比較画面は1100px以上で表と幅380pxの試合表示を28px間隔で並べ、試合表示は上端20pxに追従する。1099px以下では縦に並べる。

比較表の先頭列は横スクロール中も固定する。表の最小幅は通常620px、1099px以下では650px。650px以下では先頭列を150pxにし、横スクロールの案内を表示する。

編集画面の作戦一覧は235px、1099px以下では200px。650px以下では編集内容の上に2列で並べ、高さ230pxを超える一覧はスクロールさせる。

## Elevation & Depth

影は使わない。白い作業面を罫線と余白で区切る。比較表の選択行は淡い面、選択セルはティールの枠と面で示す。

## Shapes

入力・選択欄・通常ボタンはcontrolの角丸を使う。ナビゲーションは角丸を付けず、選択中のページを暗い下線と太字で示す。

## Components

主操作はティール地に白文字。通常操作は白地と細い枠。操作の最小高さは36pxを基本とし、比較条件の選択欄や再生操作などは用途に応じて小さくする。キーボードフォーカスはティールの2px枠を3px離して表示する。

ナビゲーションは「作戦比較」「作戦編集」「機体条件」のページ名で示す。作戦一覧は編集画面に置く。比較表では選択中の優先側の得点差を1セルに1つ表示し、優先側は選択欄で切り替える。未計算は「—」、選択セルは枠と押下状態で示す。650px以下では得点セルの最小高さを42pxにする。

比較条件、機体の詳細、得点と競合の履歴、適用範囲は折りたたみで開く。3D表示は暗い背景の独立した表示領域に置く。ボタンの背景色は0.15秒で変化し、動きを減らす設定では遷移を止める。

## Do's and Don'ts

- Do 数値に適用条件と単位を近接表示する。
- Do 狭い画面でも作戦名を追えるようにし、表の横スクロールを維持する。
- Do 選択と未計算の状態を枠や文字でも示す。
- Don't 赤青を操作の選択色として使う。
- Don't 影やカードの入れ子で作業領域を装飾する。
