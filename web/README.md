# 作戦探索 Webアプリ

React / TypeScript / Three.jsの画面と、Web Worker内のTypeScript探索エンジンです。保存はIndexedDB、完全探索済みの構成の数理最適化はHiGHS WebAssemblyを使います。バックエンドは不要です。

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Node.js 22.12以上は開発・ビルド時のみ必要です。`dist/` をHTTPSの静的ホスティングへ配置します。Wasmを含め、必要な資産はビルドに同梱します。

`npm run import:field` は提供STEPから表示資産を再生成する開発用コマンドです。通常の実行・ビルドには不要です。

保存・再開の動作と制限は[ルートREADME](../README.md)、機能ごとの責務は[ARCHITECTURE.md](ARCHITECTURE.md)を参照してください。
