# Online Typing

リアルタイムで入力されたテキストを共有するWebSocketを使ったアプリケーションです。

## 構成

- フロントエンド: Next.js (Page Routerを使用)
- バックエンド: Go (Echo framework)
- 通信: WebSocket

## セットアップと実行方法

### バックエンドの起動

```bash
cd online-typing/backend
go run main.go
```

これでバックエンドサーバーが `http://localhost:8080` で起動します。

### フロントエンドの起動

```bash
cd online-typing/frontend
npm install
npm run dev
```

これでフロントエンドサーバーが `http://localhost:3000` で起動します。

## 使い方

1. ブラウザで `http://localhost:3000` にアクセスします
2. テキストエリアに入力すると、その内容がリアルタイムでサーバーに送信されます
3. 複数のブラウザやタブで同じページを開くと、入力されたテキストがすべてのクライアントに反映されます

## 機能

- リアルタイムでのテキスト共有
- 接続状態の表示
- シンプルなナビゲーション (ページルーティング)