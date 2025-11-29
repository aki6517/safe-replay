# SafeReply 実装計画・GitHub Issue一覧

## フェーズ構成

- **フェーズ1: Walking Skeleton** - 最小限の動作するシステム構築 / #1〜#7
- **フェーズ2: コア機能実装** - メッセージ取得・AI処理・通知の基本フロー / #8〜#18
- **フェーズ3: 自動化** - ポーリング・定期実行・監視の自動化 / #19〜#23
- **フェーズ4: 堅牢化** - セキュリティ・エラーハンドリング・運用保全 / #24〜#28

---

## 依存関係マップ

```
#1 → #2 → #3 → #4 → #5 → #6 → #7
                                    ↓
#8 → #9 → #10 → #11 → #12 → #13 → #14 → #15 → #16 → #17 → #18
                                    ↓
#19 → #20 → #21 → #22 → #23
                                    ↓
#24 → #25 → #26 → #27 → #28
```

**主要な依存関係**:
- #1（プロジェクト初期化）→ 全てのIssue
- #2（DB構築）→ #8以降のデータ操作系
- #3（LINE基本）→ #14（通知）、#17（アクション）
- #8（Gmail連携）→ #10（ポーリング）
- #11（AI基本）→ #12（トリアージ）、#13（ドラフト）
- #14（通知）→ #15（Flex Message）

---

## Issueアウトライン表

### Issue #1: プロジェクト初期化・環境構築

**概要**: Node.js + TypeScript + Honoプロジェクトの基本構造と開発環境を構築する

**依存**: -

**ラベル**: `infra`, `chore`

**受け入れ基準（AC）**:
- [ ] `package.json`に必要な依存パッケージを追加（Hono, Supabase, LINE SDK等）
- [ ] `tsconfig.json`でTypeScript設定を完了
- [ ] `.env.example`を作成し、必要な環境変数を列挙
- [ ] `.gitignore`を設定（node_modules, .env等）
- [ ] `README.md`にセットアップ手順を記載
- [ ] `npm install`で依存パッケージがインストールできる
- [ ] `npm run dev`で開発サーバーが起動する

---

### Issue #2: Supabaseデータベース構築

**概要**: PostgreSQLデータベースのスキーマ作成とマイグレーション実行

**依存**: #1

**ラベル**: `backend`, `database`

**受け入れ基準（AC）**:
- [ ] Supabaseプロジェクトを作成
- [ ] `supabase/migrations/001_initial_schema.sql`を作成（設計書準拠）
- [ ] 全テーブル（users, messages, message_drafts等）を作成
- [ ] インデックスを適切に設定
- [ ] RLSポリシーを設定（Service Role用）
- [ ] `updated_at`トリガーを設定
- [ ] マイグレーションがエラーなく実行できる

---

### Issue #3: Supabase・Redisクライアント設定

**概要**: SupabaseとUpstash Redisの接続クライアントを実装

**依存**: #2

**ラベル**: `backend`, `infra`

**受け入れ基準（AC）**:
- [ ] `src/db/client.ts`でSupabaseクライアントを初期化
- [ ] `src/db/redis.ts`でUpstash Redisクライアントを初期化
- [ ] 環境変数の検証ロジックを実装
- [ ] 接続エラー時のハンドリングを実装
- [ ] 型定義（`src/types/database.ts`）を作成

---

### Issue #4: 基本APIエンドポイント実装

**概要**: Honoアプリケーションの基本構造とルーティングを実装

**依存**: #3

**ラベル**: `backend`

**受け入れ基準（AC）**:
- [ ] `src/index.ts`でHonoアプリケーションを初期化
- [ ] ルートエンドポイント（`GET /`）を実装
- [ ] エラーハンドラーを実装
- [ ] CORS設定を追加
- [ ] ロガーミドルウェアを追加
- [ ] サーバーが起動し、ルートエンドポイントにアクセスできる

---

### Issue #5: ヘルスチェックAPI実装

**概要**: システムの生存確認と詳細ヘルスチェックエンドポイントを実装

**依存**: #4

**ラベル**: `backend`, `monitoring`

**受け入れ基準（AC）**:
- [ ] `GET /api/v1/health`を実装（シンプルな生存確認）
- [ ] `GET /api/v1/health/deep`を実装（DB・Redis接続確認）
- [ ] Service Key認証を実装
- [ ] 各コンポーネントの状態を返す
- [ ] エラー時に適切なHTTPステータスを返す

---

### Issue #6: Railwayデプロイ設定

**概要**: Railwayへのデプロイ設定とGitHub連携

**依存**: #4

**ラベル**: `infra`, `deployment`

**受け入れ基準（AC）**:
- [ ] `railway.toml`を作成
- [ ] Railwayプロジェクトを作成
- [ ] GitHubリポジトリと連携
- [ ] 環境変数をRailwayに設定
- [ ] 自動デプロイが動作する
- [ ] 本番環境でヘルスチェックが通る

---

### Issue #7: GitHub Actions基本ワークフロー作成

**概要**: CI/CDと定期実行のためのGitHub Actionsワークフローを作成

**依存**: #6

**ラベル**: `infra`, `ci`

**受け入れ基準（AC）**:
- [ ] `.github/workflows/deploy.yml`を作成（自動デプロイ）
- [ ] `.github/workflows/poll.yml`を作成（5分間隔ポーリング、スケルトン）
- [ ] `.github/workflows/health.yml`を作成（15分間隔ヘルスチェック、スケルトン）
- [ ] GitHub Secretsに必要な値を設定
- [ ] ワークフローが正常に実行される

---

### Issue #8: LINE Webhook基本実装

**概要**: LINE Messaging APIのWebhookエンドポイントと署名検証を実装

**依存**: #4, #3

**ラベル**: `backend`, `line`

**受け入れ基準（AC）**:
- [ ] `POST /api/v1/line/webhook`エンドポイントを実装
- [ ] LINE署名検証ロジックを実装
- [ ] イベントタイプ（message, postback, follow, unfollow）のルーティング
- [ ] エラーハンドリングを実装
- [ ] LINE Developer ConsoleでWebhook URLを設定できる
- [ ] テストメッセージを送信して受信できる

---

### Issue #9: LINE Bot基本応答実装

**概要**: LINE Botへの基本的なテキストメッセージ送信機能を実装

**依存**: #8

**ラベル**: `backend`, `line`

**受け入れ基準（AC）**:
- [ ] `src/services/line.ts`でLINE Bot SDKクライアントを初期化
- [ ] テキストメッセージ送信関数を実装
- [ ] followイベント時のウェルカムメッセージを実装
- [ ] エラーハンドリングを実装
- [ ] LINE Botにメッセージが送信できることを確認

---

### Issue #10: Gmail API連携実装

**概要**: Gmail APIを使用した未読メール取得機能を実装

**依存**: #3

**ラベル**: `backend`, `gmail`

**受け入れ基準（AC）**:
- [ ] `src/services/gmail.ts`でGmail APIクライアントを実装
- [ ] OAuth 2.0認証フローを実装（トークン取得・リフレッシュ）
- [ ] 未読メール取得機能を実装
- [ ] スレッド履歴取得機能を実装
- [ ] メッセージ本文抽出機能を実装
- [ ] エラーハンドリングを実装
- [ ] テスト用のGmailアカウントで動作確認

---

### Issue #11: Chatwork API連携実装

**概要**: Chatwork APIを使用した自分宛メッセージ取得機能を実装

**依存**: #3

**ラベル**: `backend`, `chatwork`

**受け入れ基準（AC）**:
- [ ] `src/services/chatwork.ts`でChatwork APIクライアントを実装
- [ ] APIトークン認証を実装
- [ ] ルーム一覧取得機能を実装
- [ ] 自分宛（To/Direct）メッセージ取得機能を実装
- [ ] 無限ループ防止（自身のBot発言除外）を実装
- [ ] エラーハンドリングを実装
- [ ] テスト用のChatworkアカウントで動作確認

---

### Issue #12: ファイル解析モジュール実装（PDF/DOCX/XLSX）

**概要**: PDF、DOCX、XLSXファイルからテキストを抽出する機能を実装

**依存**: #3

**ラベル**: `backend`, `parser`

**受け入れ基準（AC）**:
- [ ] `src/parsers/pdf.ts`でPDF解析を実装（pdf-parse使用）
- [ ] `src/parsers/docx.ts`でDOCX解析を実装（mammoth使用）
- [ ] `src/parsers/xlsx.ts`でXLSX解析を実装（xlsx使用）
- [ ] `src/parsers/index.ts`で統合インターフェースを実装
- [ ] ファイルサイズ10MB制限を実装
- [ ] エラーハンドリングを実装
- [ ] 各形式のサンプルファイルで動作確認

---

### Issue #13: PowerPoint解析実装（発表者ノート抽出）

**概要**: PPTXファイルからスライドテキストと発表者ノートを抽出する機能を実装

**依存**: #12

**ラベル**: `backend`, `parser`

**受け入れ基準（AC）**:
- [ ] `src/parsers/pptx.ts`でPPTX解析を実装（pptx-parser使用）
- [ ] スライド内テキスト抽出を実装
- [ ] **発表者ノート（プレゼンターメモ）抽出を実装**（必須要件）
- [ ] 抽出結果を統合インターフェースで返す
- [ ] エラーハンドリングを実装
- [ ] 発表者ノート付きPPTXファイルで動作確認

---

### Issue #14: AI Provider Interface実装（Model Agnostic）

**概要**: AIプロバイダーに依存しない抽象インターフェースを実装

**依存**: #3

**ラベル**: `backend`, `ai`

**受け入れ基準（AC）**:
- [ ] `src/ai/provider.ts`で`AIProvider`インターフェースを定義
- [ ] `triage()`と`generateDraft()`メソッドを定義
- [ ] 環境変数でプロバイダーを切り替え可能にする
- [ ] 型定義（`MessageContext`, `TriageResult`等）を作成
- [ ] 将来のGemini/Claude実装を容易にする設計

---

### Issue #15: OpenAI Provider実装

**概要**: OpenAI APIを使用したAI Providerの実装

**依存**: #14

**ラベル**: `backend`, `ai`

**受け入れ基準（AC）**:
- [ ] `src/ai/openai.ts`で`OpenAIProvider`クラスを実装
- [ ] `triage()`メソッドでトリアージ処理を実装
- [ ] `generateDraft()`メソッドでドラフト生成を実装
- [ ] プロンプトテンプレート（`src/ai/prompts/`）を作成
- [ ] レスポンスパース処理を実装
- [ ] エラーハンドリングとリトライロジックを実装
- [ ] テスト用のメッセージで動作確認

---

### Issue #16: AIトリアージ機能実装

**概要**: メッセージをType A/B/Cに分類するトリアージ機能を実装

**依存**: #15

**ラベル**: `backend`, `ai`

**受け入れ基準（AC）**:
- [ ] `src/ai/triage.ts`でトリアージロジックを実装
- [ ] スレッド履歴をコンテキストに含める処理を実装
- [ ] 添付ファイルテキストをコンテキストに含める処理を実装
- [ ] トリアージ結果をDBに保存する処理を実装
- [ ] エラーハンドリングを実装
- [ ] Type A/B/Cの各パターンでテスト

---

### Issue #17: AIドラフト生成機能実装

**概要**: Type A/Bメッセージに対する返信案生成機能を実装

**依存**: #16

**ラベル**: `backend`, `ai`

**受け入れ基準（AC）**:
- [ ] `src/ai/draft.ts`でドラフト生成ロジックを実装
- [ ] メッセージタイプに応じたプロンプトを選択
- [ ] トーン（formal/casual/brief）に対応
- [ ] 生成したドラフトをDBに保存する処理を実装
- [ ] エラーハンドリングを実装
- [ ] 各タイプ・トーンでテスト

---

### Issue #18: LINE通知サービス実装（基本）

**概要**: LINE Botへの通知送信機能を実装（テキストメッセージ版）

**依存**: #9, #17

**ラベル**: `backend`, `line`

**受け入れ基準（AC）**:
- [ ] `src/services/notifier.ts`で通知サービスを実装
- [ ] Type A通知送信機能を実装（テキスト + 返信案）
- [ ] Type B通知送信機能を実装（テキスト）
- [ ] Type Cは通知しない（ログのみ）
- [ ] 通知履歴をDBに記録
- [ ] エラーハンドリングを実装

---

### Issue #19: LINE Flex Message実装（Type A）

**概要**: Type A通知用のFlex Messageテンプレートを実装

**依存**: #18

**ラベル**: `backend`, `line`, `ui`

**受け入れ基準（AC）**:
- [ ] Type A用Flex Messageテンプレートを作成（設計書準拠）
- [ ] 返信案プレビューを表示
- [ ] [送信][修正][断る]ボタンを実装
- [ ] Postbackデータ形式を実装
- [ ] LINE Botで表示確認

---

### Issue #20: LINE Flex Message実装（Type B）

**概要**: Type B通知用のFlex Messageテンプレートを実装

**依存**: #18

**ラベル**: `backend`, `line`, `ui`

**受け入れ基準（AC）**:
- [ ] Type B用Flex Messageテンプレートを作成（設計書準拠）
- [ ] [既読][確認メール]ボタンを実装
- [ ] 静音通知設定に対応
- [ ] Postbackデータ形式を実装
- [ ] LINE Botで表示確認

---

### Issue #21: Gmailポーリング処理実装

**概要**: Gmail未読メールを定期的に取得・処理する機能を実装

**依存**: #10, #16, #17, #18

**ラベル**: `backend`, `gmail`, `automation`

**受け入れ基準（AC）**:
- [ ] `POST /api/v1/poll/gmail`エンドポイントを実装
- [ ] Service Key認証を実装
- [ ] 未読メール取得 → トリアージ → 通知のフローを実装
- [ ] Redisで処理済みID管理を実装（重複防止）
- [ ] エラーハンドリングとログ記録を実装
- [ ] レスポンスに処理サマリーを返す

---

### Issue #22: Chatworkポーリング処理実装

**概要**: Chatwork未読メッセージを定期的に取得・処理する機能を実装

**依存**: #11, #16, #17, #18

**ラベル**: `backend`, `chatwork`, `automation`

**受け入れ基準（AC）**:
- [ ] `POST /api/v1/poll/chatwork`エンドポイントを実装
- [ ] Service Key認証を実装
- [ ] 自分宛メッセージ取得 → トリアージ → 通知のフローを実装
- [ ] 無限ループ防止を実装
- [ ] Redisで処理済みID管理を実装
- [ ] エラーハンドリングとログ記録を実装

---

### Issue #23: LINE転送メッセージ処理実装

**概要**: LINE経由で転送されたメッセージを処理する機能を実装

**依存**: #8, #16, #17, #18

**ラベル**: `backend`, `line`

**受け入れ基準（AC）**:
- [ ] 転送メッセージ検出ロジックを実装
- [ ] 転送メッセージを「外部連絡」として処理
- [ ] AIトリアージとドラフト生成を実行
- [ ] Type A/Bの場合のみ通知
- [ ] エラーハンドリングを実装

---

### Issue #24: LINEアクションハンドラー実装（送信・修正・断る）

**概要**: LINE Botのアクションボタン（送信・修正・断る）の処理を実装

**依存**: #19, #10, #11

**ラベル**: `backend`, `line`

**受け入れ基準（AC）**:
- [ ] Postbackイベントのパース処理を実装
- [ ] `action=send`で返信送信処理を実装（Gmail/Chatwork）
- [ ] `action=edit`で編集モード開始処理を実装
- [ ] `action=dismiss`で却下処理を実装
- [ ] DBにアクションログを記録
- [ ] 完了通知をLINE Botに送信

---

### Issue #25: LINEアクションハンドラー実装（既読・確認メール）

**概要**: Type B用のアクションボタン（既読・確認メール）の処理を実装

**依存**: #20

**ラベル**: `backend`, `line`

**受け入れ基準（AC）**:
- [ ] `action=read`で既読処理を実装（ステータス更新）
- [ ] `action=ack`で確認メール送信処理を実装（Gmail）
- [ ] DBにアクションログを記録
- [ ] 完了通知をLINE Botに送信

---

### Issue #26: ホワイトリスト検証機能実装

**概要**: LINE User IDのホワイトリストチェック機能を実装

**依存**: #8

**ラベル**: `backend`, `security`

**受け入れ基準（AC）**:
- [ ] `src/utils/security.ts`でホワイトリスト検証関数を実装
- [ ] LINE Webhookでホワイトリストチェックを実装
- [ ] 未登録ユーザーは403を返す
- [ ] 環境変数からホワイトリストを読み込む
- [ ] DBからホワイトリストを取得する処理を実装（将来拡張用）

---

### Issue #27: 緊急通知機能実装

**概要**: システム異常時にユーザーへ緊急LINE通知を送信する機能を実装

**依存**: #9, #26

**ラベル**: `backend`, `monitoring`, `security`

**受け入れ基準（AC）**:
- [ ] `src/utils/notification.ts`で緊急通知関数を実装
- [ ] APIトークン失効検知時に通知
- [ ] システム停止検知時に通知
- [ ] 緊急通知用Flex Messageテンプレートを作成
- [ ] エラーハンドリングを実装

---

### Issue #28: GitHub Actionsポーリング・ヘルスチェック完成

**概要**: GitHub Actionsの定期実行ワークフローを完成させる

**依存**: #21, #22, #5

**ラベル**: `infra`, `automation`, `monitoring`

**受け入れ基準（AC）**:
- [ ] `.github/workflows/poll.yml`を完成（Gmail/Chatworkポーリング実行）
- [ ] `.github/workflows/health.yml`を完成（ヘルスチェック・異常時通知）
- [ ] Service Key認証を実装
- [ ] エラー時の通知処理を実装
- [ ] ワークフローが正常に実行される
- [ ] スケジュール実行が動作する

---

## 要確認事項

1. **Gmail OAuth認証フロー**: Web管理画面でのOAuth認証が必要か、初期設定のみで良いか
2. **Chatwork APIトークン取得方法**: ユーザーが手動で取得する想定か、自動化が必要か
3. **LINE Bot友だち追加フロー**: 認証コード方式か、QRコード読み取りのみか
4. **ファイル保存先**: Supabase Storageを使用するか、一時ファイルのみか
5. **エラーログ保存先**: Supabase DBか、外部サービス（Sentry等）か
6. **Web管理画面の実装タイミング**: MVPではLINE Botのみで良いか、Web画面も必要か




