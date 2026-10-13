---
name: 学生ロボコン 作戦探索器
description: 条件・局面・遷移を照合する競技分析の作業面
colors:
  accent: "#006b65"
  paper: "#f4f5f3"
  surface: "#fff"
  ink: "#202c30"
  muted: "#536168"
  line: "#d4dcda"
  control-line: "#aebbb8"
  control-hover: "#e6eeeb"
  selected: "#d6e9e4"
  selected-ink: "#00554f"
  focus: "#009d92"
  header: "#20342f"
  table-head: "#eef2ef"
  team-red: "#af292e"
  team-blue: "#2855ae"
typography:
  headline:
    fontFamily: "\"Noto Sans JP\", \"Yu Gothic\", system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 650
  title:
    fontFamily: "\"Noto Sans JP\", \"Yu Gothic\", system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 650
  section:
    fontFamily: "\"Noto Sans JP\", \"Yu Gothic\", system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 650
  body:
    fontFamily: "\"Noto Sans JP\", \"Yu Gothic\", system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.75
  score:
    fontFamily: "\"Noto Sans JP\", \"Yu Gothic\", system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
rounded:
  control: "4px"
  flat: "0"
spacing:
  step-4: "4px"
  step-8: "8px"
  step-12: "12px"
  step-16: "16px"
  step-24: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "7px 11px"
  button-primary-hover:
    backgroundColor: "{colors.selected-ink}"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "7px 11px"
  button-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.selected-ink}"
    rounded: "{rounded.control}"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "7px 9px"
  navigation:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.flat}"
    padding: "13px 16px"
  work-surface:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.flat}"
    padding: "24px"
---

# Design System: 学生ロボコン 作戦探索器

## Overview

**Creative North Star: "競技分析の作業台"**

競技の条件表、状態遷移グラフ、3D、選択局面を同じ作業面で扱う操作画面。淡い紙色に白い作業領域を置き、細い境界と見出しで区切る。ヒーロー、装飾的な指標カード、作戦の解釈名は設けない。

日本語を読んで条件を編集し、数値と局面を照合できる密度を保つ。システムサンセリフはOperateモードの既存方針であり、実際のCADを描く3Dが機体と競技場の視覚資料になる。

**Key Characteristics:**
- 白い表とグラフを中心にした作業面。
- 選択を青緑、チームを赤と青で表示。
- 数値の桁を揃え、状態を文字と枠線でも区別。
- 狭い画面では作業領域を縦に並べ、グラフと表はスクロールで読む。

## Colors

紙色、白、深い墨色を基調に、青緑を操作の目印にする。値はfrontmatterを正本とする。

### Primary
- **操作の青緑** (`accent`): 主操作、選択経路、選択局面、現在のタブ、リンク。
- **選択の淡色と文字** (`selected`, `selected-ink`): 視点やチームの押下状態。
- **フォーカスの青緑** (`focus`): キーボード操作位置を示す輪郭。

### Secondary
- **赤チームと青チーム** (`team-red`, `team-blue`): 得点とチーム識別。エラー表示は別の文脈で暖色を使う。

### Neutral
- **紙色と白い作業面** (`paper`, `surface`): ページ全体と表・条件編集・局面詳細。
- **墨色と補助文字** (`ink`, `muted`): 本文と説明。
- **領域境界と操作境界** (`line`, `control-line`): 領域の区切りとフォーム輪郭。
- **操作のホバー面** (`control-hover`): 通常ボタンの反応。
- **深緑のヘッダー** (`header`): 探索名と共通操作を載せる帯。
- **表見出しの淡色** (`table-head`): 列見出しとコードを読む面。

**The State Meaning Rule.** 青緑は操作・選択に使う。赤と青の組はチームの識別に使い、選択局面は太枠と「選択」の文字も併記する。

## Typography

**Body Font:** Noto Sans JP、Yu Gothic、system-ui、sans-serifの順。外部フォントの読み込みを前提としない。独立した装飾用書体はない。

### Hierarchy
- **Headline:** 探索名。狭い画面では18px。
- **Title:** 選択局面などの領域見出し。
- **Section:** 領域内の小見出し。
- **Body:** 通常の操作と本文。段落の行高は1.75、最大幅は78ch。
- **Score:** 選択局面の両チーム得点。点差は16px。

本文14px以上という既存方針を維持する。現状のグラフラベルは13px、補助表示・一部フォーム・詳細表は12px、遷移の補助説明には11pxがある。これらは実装上の密度と既存方針の差であり、今後の本文縮小を認める規則にはしない。得点、時刻、表、数値入力はtabular-numsで揃える。

## Layout

最上部に探索名と共通操作、その下に探索操作、実行状態、表示切替を置く。条件編集は最大980pxの専用領域。標準の作業面は可変幅グラフと400pxの詳細領域を並べ、1600px以上では詳細を470px、1050px以下では350pxにする。760px以下では縦並びになる。

余白の基準は4・8・12・16・24px。ヘッダーと探索操作の左右余白は通常24px、詳細内部は16px。フォームは折り返し、評価の比較列は狭い画面で1列になる。比較表は最小650pxを保って横スクロールする。

グラフは時刻の列と局面の行を使い、時刻列間185px、行間90px。100局面単位の表示範囲とページ外への遷移数を併記する。実際のスクロール枠の高さは内容の高さ×倍率、65vh、650pxの最小値で決まる。これはCSSの固定高さより優先される。倍率は利用者が選び、選択局面を枠内へ移動する操作を備える。

## Elevation & Depth

影は使わない。作業面の白、背景の紙色、細い境界で領域を分ける。暗い3D領域は競技場を読むための描画面であり、装飾的な奥行き効果ではない。

**The Flat Workbench Rule.** 作業領域は白い面と細い境界で区切る。影や多重カードで階層を増やさない。

## Shapes

ボタン・入力・グラフ局面は小さな角丸。作業領域とタブは角を丸めない。領域と操作の輪郭は通常1px。グラフでは未展開に破線、展開済みに実線、180秒の局面に内側の枠、選択に太い青緑の枠を用いる。

## Components

### Buttons

小さくても操作できるネイティブボタン。通常は白い面と墨色の文字で、主操作は青緑の面と白文字。最小高さは36px。視点やチームの選択はaria-pressedで示す。無効状態は不透明度0.5、通常カーソル。主操作のホバーは濃い青緑（selected-ink）に変わり、白文字を保つ。ホバーとフォーカスは別の状態として扱う。

### Inputs / Fields

ネイティブの入力と選択欄。白い面、細い輪郭、小さな角丸。数値は等幅数字、チェックボックスと範囲入力の操作色は青緑。キーボードフォーカスには3pxの輪郭と3pxの外側余白を使い、summaryとグラフの操作要素にも適用する。

### Navigation

グラフ・評価・モデルを横並びの標準タブで切り替える。現在位置はaria-current、文字の青緑、650の太さ、3pxの下線で示す。タブは角丸カードにしない。狭い画面では左右の余白を減らす。

### Cards / Containers

条件編集、グラフ、詳細は白い作業領域。独立した装飾カード部品はない。条件編集の内側余白は通常24px、狭い画面では上下16px・左右12px。表はセル下の境界で行を区切り、見出しだけ淡色を敷く。

### State Graph

局面は128×56pxの長方形で、IDと両チーム得点を表示。遷移は矢印付き曲線。選択経路は線幅2.5px、選択局面は3pxで強調し、遷移には12px幅の透明な操作領域を重ねる。破線・二重枠の意味を凡例に残す。局面と遷移はキーボードでも選択できる。

### Replay and Inspector

3Dには表示時刻とその時刻の得点を付け、再生中はその時刻の機体状態表を表示する。選択局面の見出し、得点、合法行動は別の詳細領域に保持する。場所は日本語名で表示する。3Dの高さは通常290px、1600px以上340px、1050px以下250px、760px以下310px。描画開始に失敗した場合も表と得点を読める。装飾アニメーションはなく、再生操作が状態の変化を説明する。

## Do's and Don'ts

### Do:
- **Do** 本文は14px以上を基本にし、日本語の読みやすさを優先する。
- **Do** 数値には等幅数字を使い、得点・時刻・局面IDを照合できるようにする。
- **Do** 未展開、展開済み、終了、選択を文字や枠線でも区別する。
- **Do** 再生時刻の得点・機体状態と選択局面の情報を別の見出しで示す。
- **Do** 狭い画面では操作を折り返し、グラフと比較表にスクロール領域を残す。

### Don't:
- **Don't** ヒーローや装飾的な指標カードを追加する。
- **Don't** 作戦の解釈名を画面の分類として発明する。
- **Don't** グラフ全体を収めるためにラベルを自動縮小する。
- **Don't** 色だけで局面や操作の状態を伝える。
- **Don't** 影やカードの入れ子で作業領域を装飾する。
