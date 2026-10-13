# 作戦探索 Web画面

NHK学生ロボコン2027の作戦検討用。競技ルールはABUロボコン2027と同一と仮定します。用語は手元の日本語参考訳（非公式）に合わせています。

探索計算は `python3 -m explorer` が担当します。このディレクトリはReact / TypeScriptの操作画面とThree.jsによる状態表示です。

```sh
npm ci
npm run dev
```

APIはlocalhost:4174へ接続します。完成ビルドは `npm run build` で作成し、Pythonサーバーが配信します。詳細はルートREADMEを参照してください。

`npm test` はCAD資産などの検証、`npm run typecheck` は型検査です。`npm run import:field` は提供STEPから表示資産を再生成します。
