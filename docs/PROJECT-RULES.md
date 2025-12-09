# SafeReply プロジェクトルール・開発ガイドライン

このドキュメントでは、SafeReplyプロジェクトの開発ルール、コーディング規約、ベストプラクティスを定義します。

## 📋 目次

- [基本方針](#基本方針)
- [コミットメッセージ規約](#コミットメッセージ規約)
- [コードスタイルルール](#コードスタイルルール)
- [セキュリティルール](#セキュリティルール)
- [設計原則](#設計原則)
- [ドキュメントルール](#ドキュメントルール)
- [品質管理](#品質管理)
- [AIアシスタント向け作業プロセス](#aiアシスタント向け作業プロセス)
- [重要な注意事項](#重要な注意事項)
- [パフォーマンス考慮](#パフォーマンス考慮)
- [参考資料](#参考資料)

---

## 🎯 基本方針

### ルールファイル参照時の発言

**🔴 必須**: このファイル（`PROJECT-RULES.md`）を参照した際は、**必ずファイル名を発言すること**。

**例**: 「`PROJECT-RULES.md`を参照しました。」

### 言語・コミュニケーション

**🔴 必須**: 全ての回答・コメント・ドキュメントは**日本語**で記述すること。

- コード内のコメントは日本語
- コミットメッセージは日本語
- ドキュメントは日本語
- AIアシスタントとの対話も日本語

**理由**: プロジェクトの一貫性と、非エンジニア1人での運用・保守を考慮。

---

## 📝 コミットメッセージ規約

### フォーマット

```
<type>: <subject>

[optional body]

[optional footer]
```

### Type（必須）

| Type | 説明 | 例 |
|------|------|-----|
| `feat` | 新機能の追加 | `feat: Gmailポーリング機能の実装` |
| `fix` | バグ修正 | `fix: LINE署名検証エラーの修正` |
| `docs` | ドキュメントの変更 | `docs: API設計書の更新` |
| `style` | コードスタイルの変更（動作に影響なし） | `style: インデントの統一` |
| `refactor` | リファクタリング | `refactor: AI EngineのModel Agnostic化` |
| `perf` | パフォーマンス改善 | `perf: Redisキャッシュの追加` |
| `test` | テストの追加・修正 | `test: ファイル解析のユニットテスト追加` |
| `chore` | ビルド・設定変更 | `chore: package.jsonの依存関係更新` |
| `ci` | CI/CD設定の変更 | `ci: GitHub Actionsワークフローの追加` |

### Subject（必須）

- **50文字以内**で簡潔に記述
- **動詞で始める**（「実装」「追加」「修正」など）
- **現在形**で記述
- **句読点は使わない**（文末の「。」は不要）

### Body（任意）

- 変更の理由や背景を説明
- 72文字で改行
- 箇条書きで記述可能

### Footer（任意）

- 関連するIssue番号を記載
- `Closes #123` の形式

### 良い例

```bash
feat: Gmail未読メール取得機能の実装

- Gmail API連携の追加
- 未読メールの取得とパース処理
- スレッド履歴の取得に対応

Closes #10
```

```bash
fix: Chatwork無限ループ防止の修正

自身のBot発言を除外するロジックを追加
```

```bash
docs: データベース設計書の更新

messagesテーブルにpriority_scoreカラムを追加
```

### 悪い例

```bash
# ❌ 悪い例
fix
update
WIP
色々修正
feat: 実装
fix: バグ修正（何のバグか不明）
```

---

## 💻 コードスタイルルール

### TypeScript / Node.js

#### [RULE-001] 型定義は必須

**優先度**: 🔴 必須

```typescript
// ✅ 良い例：明示的な型定義
interface Message {
  id: string;
  source_type: 'gmail' | 'chatwork' | 'line_forward';
  subject: string | null;
  body_plain: string | null;
  triage_type: 'A' | 'B' | 'C' | null;
}

async function processMessage(message: Message): Promise<void> {
  // ...
}

// ❌ 悪い例：anyの使用
function processMessage(message: any): any {
  // ...
}
```

**ルール**:
- `any`の使用は原則禁止（やむを得ない場合は`unknown`を使用）
- 関数の引数・戻り値は必ず型定義
- オブジェクトは`interface`または`type`で定義

#### [RULE-002] エラーハンドリング

**優先度**: 🔴 必須

```typescript
// ✅ 良い例：try-catchでエラーハンドリング
async function fetchGmailMessages(): Promise<Message[]> {
  try {
    const messages = await gmailService.getUnreadMessages();
    return messages;
  } catch (error) {
    console.error('Gmail取得エラー:', error);
    // エラーログを記録
    await logError('gmail_fetch', error);
    // 空配列を返す（フォールバック）
    return [];
  }
}

// ✅ 良い例：エラー型の定義
class GmailApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'GmailApiError';
  }
}

// ❌ 悪い例：エラーハンドリングなし
async function fetchGmailMessages() {
  const messages = await gmailService.getUnreadMessages();
  return messages; // エラー時にクラッシュ
}
```

#### [RULE-003] 非同期処理の扱い

**優先度**: 🔴 必須

```typescript
// ✅ 良い例：async/awaitを使用
async function processMessages(): Promise<void> {
  const messages = await fetchMessages();
  for (const message of messages) {
    await processMessage(message);
  }
}

// ✅ 良い例：並列処理が必要な場合
async function processMessagesParallel(): Promise<void> {
  const messages = await fetchMessages();
  await Promise.all(
    messages.map(message => processMessage(message))
  );
}

// ❌ 悪い例：コールバック地獄
function processMessages(callback: Function) {
  fetchMessages((messages) => {
    messages.forEach((message) => {
      processMessage(message, () => {
        // ...
      });
    });
  });
}
```

#### [RULE-004] 環境変数の扱い

**優先度**: 🔴 必須

```typescript
// ✅ 良い例：環境変数の検証
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

// ✅ 良い例：デフォルト値の設定
const port = Number(process.env.PORT) || 3000;
const maxResults = Number(process.env.MAX_RESULTS) || 50;

// ❌ 悪い例：環境変数の検証なし
const url = process.env.SUPABASE_URL; // undefinedの可能性
```

#### [RULE-005] 命名規則

**優先度**: 🟡 推奨

| 種類 | 規則 | 例 |
|------|------|-----|
| 変数・関数 | camelCase | `getUnreadMessages`, `messageId` |
| クラス | PascalCase | `GmailService`, `MessageProcessor` |
| 定数 | UPPER_SNAKE_CASE | `MAX_FILE_SIZE`, `DEFAULT_PORT` |
| ファイル名 | kebab-case | `line-webhook.ts`, `message-processor.ts` |
| 型・インターフェース | PascalCase | `Message`, `TriageResult` |

```typescript
// ✅ 良い例
const MAX_FILE_SIZE_MB = 10;
const messageId = 'uuid-123';
class GmailService { }
interface MessageData { }

// ❌ 悪い例
const max_file_size = 10; // スネークケース
const MessageId = 'uuid-123'; // 変数はPascalCaseではない
```

#### [RULE-006] コメントの書き方

**優先度**: 🟡 推奨

```typescript
/**
 * Gmail未読メールを取得して処理する
 * 
 * @param userId - ユーザーID（オプション、指定なしで全ユーザー）
 * @param maxResults - 取得する最大件数（デフォルト: 50）
 * @returns 処理結果のサマリー
 */
async function pollGmail(
  userId?: string,
  maxResults: number = 50
): Promise<PollResult> {
  // 環境変数の検証
  if (!process.env.GMAIL_CLIENT_ID) {
    throw new Error('Gmail credentials not configured');
  }

  // 未読メールを取得
  const messages = await gmailService.getUnreadMessages(maxResults);
  
  // TODO: エラーハンドリングの強化
  // FIXME: レート制限の考慮が必要
}
```

**ルール**:
- 関数にはJSDocコメントを記述
- 複雑なロジックには説明コメントを追加
- `TODO`、`FIXME`、`NOTE`などのマーカーを使用
- 自明なコードにはコメント不要

---

### Python（既存実装用）

既存のPython実装（`safereply/`）がある場合のルール。

#### [RULE-007] Pythonコードスタイル

**優先度**: 🟡 推奨

```python
# ✅ 良い例：型ヒントを使用
from typing import List, Dict, Optional

def process_message(
    message_id: str,
    source: MessageSource
) -> Optional[Dict[str, Any]]:
    """
    メッセージを処理する
    
    Args:
        message_id: メッセージID
        source: メッセージソース
    
    Returns:
        処理結果の辞書、失敗時はNone
    """
    try:
        # 処理ロジック
        return result
    except Exception as e:
        logger.error(f"メッセージ処理エラー: {str(e)}")
        return None

# ❌ 悪い例：型ヒントなし
def process_message(message_id, source):
    return result
```

**ルール**:
- PEP 8に準拠
- 型ヒントを使用（Python 3.9+）
- docstringは日本語で記述
- インデントは4スペース

---

## 🔐 セキュリティルール

### [RULE-008] 環境変数の管理

**優先度**: 🔴 必須

```bash
# ✅ .env.example（リポジトリに含める）
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_key_here
LINE_CHANNEL_ACCESS_TOKEN=your_token_here

# ✅ .env（.gitignoreに追加、リポジトリに含めない）
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=actual_secret_key
LINE_CHANNEL_ACCESS_TOKEN=actual_token
```

```typescript
// ✅ 良い例：環境変数の検証
function validateEnv(): void {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'LINE_CHANNEL_ACCESS_TOKEN'
  ];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

// ❌ 悪い例：環境変数をハードコーディング
const supabaseUrl = 'https://xxx.supabase.co'; // 絶対にダメ！
```

**ルール**:
- 機密情報は必ず環境変数で管理
- `.env`ファイルは`.gitignore`に追加
- `.env.example`を用意して必要な変数を明示
- 本番環境では環境変数を適切に設定

### [RULE-009] API認証・認可

**優先度**: 🔴 必須

```typescript
// ✅ 良い例：LINE署名検証
import crypto from 'crypto';

function verifyLineSignature(body: string, signature: string): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    return false;
  }

  const hash = crypto
    .createHmac('sha256', channelSecret)
    .update(body)
    .digest('base64');

  return hash === signature;
}

// ✅ 良い例：ホワイトリストチェック
async function checkWhitelist(userId: string): Promise<boolean> {
  const allowedIds = process.env.LINE_ALLOWED_USER_IDS?.split(',') || [];
  return allowedIds.includes(userId);
}

// ✅ 良い例：Service Key認証
function verifyServiceKey(authHeader: string | undefined): boolean {
  const serviceKey = process.env.SERVICE_KEY;
  if (!serviceKey) {
    return false;
  }
  return authHeader === `Bearer ${serviceKey}`;
}
```

### [RULE-010] SQLインジェクション対策

**優先度**: 🔴 必須

```typescript
// ✅ 良い例：パラメータ化クエリ（Supabaseが自動で対応）
const { data, error } = await supabase
  .from('messages')
  .select('*')
  .eq('user_id', userId) // パラメータ化される
  .eq('status', 'pending');

// ❌ 悪い例：文字列結合（絶対にダメ！）
const query = `SELECT * FROM messages WHERE user_id = '${userId}'`;
```

### [RULE-011] ファイルアップロードの検証

**優先度**: 🔴 必須

```typescript
// ✅ 良い例：ファイルサイズ・形式の検証
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['.pdf', '.docx', '.xlsx', '.pptx'];

function validateFile(file: File): boolean {
  // サイズチェック
  if (file.size > MAX_FILE_SIZE) {
    return false;
  }

  // 拡張子チェック
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_TYPES.includes(ext)) {
    return false;
  }

  return true;
}
```

---

## 🏗️ 設計原則

### [RULE-012] Model Agnostic設計

**優先度**: 🔴 必須

AIプロバイダー（OpenAI、Anthropic等）に依存しない設計を維持する。

```typescript
// ✅ 良い例：インターフェースで抽象化
interface AIProvider {
  triage(context: MessageContext): Promise<TriageResult>;
  generateDraft(context: MessageContext, type: TriageType): Promise<string>;
}

class OpenAIProvider implements AIProvider {
  async triage(context: MessageContext): Promise<TriageResult> {
    // OpenAI実装
  }
}

class AnthropicProvider implements AIProvider {
  async triage(context: MessageContext): Promise<TriageResult> {
    // Anthropic実装
  }
}

// 環境変数で切り替え
const aiProvider: AIProvider = 
  process.env.AI_PROVIDER === 'anthropic'
    ? new AnthropicProvider()
    : new OpenAIProvider();

// ❌ 悪い例：直接OpenAIに依存
import OpenAI from 'openai';
const openai = new OpenAI();
// 他のプロバイダーに切り替えられない
```

### [RULE-013] エラーハンドリングの統一

**優先度**: 🟡 推奨

```typescript
// ✅ 良い例：統一されたエラーレスポンス
interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

function createErrorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ApiError {
  return {
    code,
    message,
    details
  };
}

// 使用例
return c.json({
  status: 'error',
  error: createErrorResponse(
    'INVALID_SIGNATURE',
    'LINE署名検証に失敗しました'
  )
}, 401);
```

### [RULE-014] 冗長なコードの回避

**優先度**: 🟡 推奨

```typescript
// ✅ 良い例：DRY原則（Don't Repeat Yourself）
function createMessageNotification(
  type: 'A' | 'B',
  message: Message
): NotificationData {
  const base = {
    userId: message.user_id,
    subject: message.subject || '',
    sender: message.sender_name || message.sender_identifier
  };

  if (type === 'A') {
    return {
      ...base,
      type: 'A',
      draft: message.draft_reply
    };
  } else {
    return {
      ...base,
      type: 'B'
    };
  }
}

// ❌ 悪い例：重複コード
function createTypeANotification(message: Message) {
  return {
    userId: message.user_id,
    subject: message.subject || '',
    sender: message.sender_name || message.sender_identifier,
    type: 'A',
    draft: message.draft_reply
  };
}

function createTypeBNotification(message: Message) {
  return {
    userId: message.user_id,
    subject: message.subject || '',
    sender: message.sender_name || message.sender_identifier,
    type: 'B'
  };
}
```

### [RULE-015] 単一責任の原則

**優先度**: 🟡 推奨

```typescript
// ✅ 良い例：責務を分離
class MessageProcessor {
  async process(message: Message): Promise<void> {
    // メッセージ処理のオーケストレーション
    const triageResult = await this.triage(message);
    const draft = await this.generateDraft(message, triageResult);
    await this.notify(message, triageResult, draft);
  }
}

class TriageService {
  async triage(message: Message): Promise<TriageResult> {
    // トリアージ専用のロジック
  }
}

class DraftService {
  async generateDraft(message: Message, type: TriageType): Promise<string> {
    // ドラフト生成専用のロジック
  }
}

// ❌ 悪い例：1つのクラスに全ての責務
class MessageService {
  async process() { /* 処理 */ }
  async triage() { /* トリアージ */ }
  async generateDraft() { /* ドラフト生成 */ }
  async notify() { /* 通知 */ }
  async sendReply() { /* 返信送信 */ }
  // 全てが1つのクラスに...
}
```

### [RULE-016] 重複実装の防止

**優先度**: 🔴 必須

**理由**: 重複コードは保守性を低下させ、バグの温床となる。実装前に既存機能を確認し、共通化を優先する。

**ルール**:
実装前に以下の確認を行ってください：

- 既存の類似機能の有無
- 同名または類似名の関数やコンポーネント
- 重複するAPIエンドポイント
- 共通化可能な処理の特定

**確認方法**:
```bash
# 関数名で検索
grep -r "functionName" src/

# 類似機能の検索
codebase_search "類似機能の説明"
```

**例**:
```typescript
// ❌ 悪い例：既存の関数と重複
function sendNotification(userId: string, message: string) {
  // 既にnotifier.tsに同様の関数が存在
}

// ✅ 良い例：既存関数を再利用
import { sendNotification } from './services/notifier';
sendNotification(userId, message);
```

---

## 📚 ドキュメントルール

### [RULE-017] 設計書への参照

**優先度**: 🔴 必須

プロジェクトの設計書は`docs/`配下に配置されている。実装時は必ず参照すること。

- `docs/01_requirements.md` - 要件定義書
- `docs/02_architecture.md` - アーキテクチャ設計書
- `docs/03_database.md` - データベース設計書
- `docs/04_api.md` - API設計書
- `docs/05_sitemap.md` - サイトマップ・画面設計書

**ルール**:
- 実装前に設計書を確認
- 設計書と実装が乖離しないよう注意
- 設計書の変更時は実装も更新

### [RULE-018] コードコメントの記述

**優先度**: 🟡 推奨

```typescript
/**
 * Gmail未読メールをポーリングして処理する
 * 
 * 設計書参照: docs/04_api.md - 4.2 ポーリングAPI
 * 
 * @param userId - ユーザーID（オプション、指定なしで全ユーザー）
 * @param maxResults - 取得する最大件数（デフォルト: 50）
 * @returns 処理結果のサマリー
 * 
 * @throws {GmailApiError} Gmail API呼び出しエラー時
 */
async function pollGmail(
  userId?: string,
  maxResults: number = 50
): Promise<PollResult> {
  // 実装
}
```

### [RULE-019] READMEの更新

**優先度**: 🟡 推奨

新機能追加時は`README.md`を更新すること。

- セットアップ手順の更新
- 新機能の説明追加
- 環境変数の追加
- APIエンドポイントの追加

---

## 🧪 品質管理

### [RULE-020] コミット前の確認

**優先度**: 🔴 必須

コミット前に以下を確認:

```bash
# 1. 型チェック
npm run type-check

# 2. Lintチェック
npm run lint

# 3. ビルド確認
npm run build

# 4. 動作確認（可能な場合）
npm run dev
```

**チェックリスト**:
- [ ] TypeScriptエラーがない
- [ ] ESLintエラーがない
- [ ] ビルドが通る
- [ ] 実装した機能が動作する
- [ ] 既存機能が壊れていない
- [ ] 環境変数の設定が正しい

### [RULE-021] エラーログの記録

**優先度**: 🟡 推奨

```typescript
// ✅ 良い例：構造化ログ
import { logger } from './utils/logger';

logger.error('Gmail API呼び出しエラー', {
  userId,
  error: error.message,
  stack: error.stack,
  timestamp: new Date().toISOString()
});

// ❌ 悪い例：console.logのみ
console.log('エラー発生');
```

### [RULE-022] こまめなコミット確認

**優先度**: 🔴 必須

**理由**: こまめにコミットすることで、変更履歴を明確にし、問題発生時のロールバックを容易にする。

**ルール**:
- **1作業項目が完了するごとに**、AIアシスタントはユーザーにコミット確認を求めること
- 作業項目とは、1つのAC（受け入れ基準）の完了、または1つの機能単位を指す
- ユーザーがコミットを承認した場合のみ、次の作業項目に進む

**例**:
```
作業項目1完了 → 「この変更をコミットしますか？」→ 承認 → コミット実行
作業項目2完了 → 「この変更をコミットしますか？」→ 承認 → コミット実行
```

### [RULE-023] エラー原因と改善対応の記録

**優先度**: 🔴 必須

**理由**: エラーの原因と対応を記録することで、同様の問題の再発を防ぎ、知識を蓄積する。

**ルール**:
- エラー等が発生し、修正完了した際は、**作業完了後に必ず**以下を記録すること
  1. **エラーの原因**: 何が原因でエラーが発生したか
  2. **改善対応**: どのように修正・改善したか
  3. **再発防止策**: 同様のエラーを防ぐための対策

**記録場所**:
- コミットメッセージのBodyに記載
- または、`docs/troubleshooting.md`などのトラブルシューティングドキュメントに追記

**例**:
```markdown
## エラー記録

### 2025-01-XX: Gmail API認証エラー

**原因**: OAuth 2.0トークンのリフレッシュ処理で、有効期限切れのトークンを使用していた

**改善対応**: トークン使用前に有効期限をチェックし、切れている場合は自動リフレッシュする処理を追加

**再発防止策**: トークン管理ユーティリティ関数を作成し、全てのAPI呼び出しで統一して使用
```

### [RULE-024] 長時間タスクの中断と報告

**優先度**: 🔴 必須

**理由**: タスクが進行しない場合、無駄な時間を費やすことを防ぎ、早期に対応策を検討する。

**ルール**:
- タスク実行時、以下のいずれかの状況が**5分以上**続く場合は、**一時そのタスクを中断**して現状を報告すること
  1. ループして進行しない
  2. 長時間レスポンスを待っている（API呼び出し等）
  3. ビルドやテストが完了しない
  4. その他、タスクが進行・完了しない状況

**報告内容**:
- 現在の状況（何を実行しているか）
- 経過時間
- 想定される原因
- 次のアクション案（リトライ、別アプローチ、ユーザー確認等）

**例**:
```
「Gmail API呼び出しが5分以上応答がありません。ネットワークエラーの可能性があります。
このまま待機を続けますか？それとも中断して別のアプローチを試しますか？」
```

### [RULE-025] 問題対応プロセス

**優先度**: 🔴 必須

**理由**: エラーや不整合が発生した際の対応プロセスを明確化し、迅速かつ適切な対応を実現する。

**ルール**:
エラーや不整合が発生した場合は、以下のプロセスで対応してください：

1. **問題の切り分けと原因特定**
   - ログ分析
   - デバッグ情報の確認
   - エラーメッセージの詳細確認

2. **対策案の作成と実施**
   - 原因に基づいた対策案を提示
   - ユーザー承認を得てから実施

3. **修正後の動作検証**
   - 修正内容が正しく動作することを確認
   - 既存機能への影響を確認

4. **デバッグログの確認と分析**
   - エラーが再発しないことを確認
   - 必要に応じてログを改善

**検証結果の記録形式**:
- 検証項目と期待される結果
- 実際の結果と差異
- 必要な対応策（該当する場合）

---

## 🤖 AIアシスタント向け作業プロセス

### [RULE-026] タスク分析と計画

**優先度**: 🔴 必須

**理由**: 指示を正確に理解し、効率的にタスクを遂行するため。

**プロセス**:

#### 1. 指示の分析と計画

<タスク分析>

- **主要なタスクを簡潔に要約**してください
- **記載された守るべきルールのディレクトリ/ファイル**を必ずチェックしてください
  - `./cursor/rules/dev-rules/*.mdc` のルールを厳守
  - `docs/PROJECT-RULES.md` のルールを厳守
- **重要な要件と制約を特定**してください
- **潜在的な課題をリストアップ**してください
- **タスク実行のための具体的なステップを詳細に列挙**してください
- **それらのステップの最適な実行順序を決定**してください

### 重複実装の防止

実装前に以下の確認を行ってください：

- 既存の類似機能の有無
- 同名または類似名の関数やコンポーネント
- 重複するAPIエンドポイント
- 共通化可能な処理の特定

このセクションは、後続のプロセス全体を導くものなので、時間をかけてでも、十分に詳細かつ包括的な分析を行ってください。

</タスク分析>

#### 2. タスクの実行

- 特定したステップを一つずつ実行してください
- 各ステップの完了後、簡潔に進捗を報告してください
- 実装時は以下の点に注意してください：
  - 適切なディレクトリ構造の遵守
  - 命名規則の一貫性維持
  - 共通処理の適切な配置

#### 3. 最終確認

- すべてのタスクが完了したら、成果物全体を評価してください
- 当初の指示内容との整合性を確認し、必要に応じて調整を行ってください
- 実装した機能に重複がないことを最終確認してください

#### 4. 結果報告

以下のフォーマットで最終的な結果を報告してください：

```markdown
# 実行結果報告

## 概要

[全体の要約を簡潔に記述]

## 実行ステップ

1. [ステップ1の説明と結果]
2. [ステップ2の説明と結果]
...

## 最終成果物

[成果物の詳細や、該当する場合はリンクなど]

## 課題対応（該当する場合）

- 発生した問題と対応内容
- 今後の注意点

## 注意点・改善提案

- [気づいた点や改善提案があれば記述]
```

---

## ⚠️ 重要な注意事項

### [RULE-027] 明示的指示外の変更禁止

**優先度**: 🔴 必須

**理由**: 予期しない変更による不具合や混乱を防ぐため。

**ルール**:
- **明示的に指示されていない変更は行わないでください**
- 必要と思われる変更がある場合は、まず提案として報告し、承認を得てから実施してください

### [RULE-028] UI/UXデザイン変更の禁止

**優先度**: 🔴 必須

**理由**: デザインの一貫性を保ち、予期しない見た目の変更を防ぐため。

**ルール**:
- **UI/UXデザインの変更（レイアウト、色、フォント、間隔など）は禁止**とします
- 変更が必要な場合は必ず事前に理由を示し、承認を得てから行ってください

### [RULE-029] 技術スタック変更の禁止

**優先度**: 🔴 必須

**理由**: プロジェクトの安定性と互換性を保つため。

**ルール**:
- **技術スタックに記載のバージョン（APIやフレームワーク、ライブラリ等）を勝手に変更しないでください**
- 変更が必要な場合は、その理由を明確にして承認を得るまでは変更を行わないでください

### [RULE-030] 不明点・重要判断時の確認

**優先度**: 🔴 必須

**理由**: 誤った判断による問題を防ぐため。

**ルール**:
- 不明点がある場合は、作業開始前に必ず確認を取ってください
- 重要な判断が必要な場合は、その都度報告し、承認を得てください
- 予期せぬ問題が発生した場合は、即座に報告し、対応策を提案してください

---

## 📊 パフォーマンス考慮

### [RULE-031] データベースクエリの最適化

**優先度**: 🟡 推奨

```typescript
// ✅ 良い例：必要なカラムのみ取得
const { data } = await supabase
  .from('messages')
  .select('id, subject, status') // 必要なカラムのみ
  .eq('user_id', userId)
  .limit(50);

// ❌ 悪い例：全カラム取得
const { data } = await supabase
  .from('messages')
  .select('*') // 不要なデータも取得
  .eq('user_id', userId);
```

### [RULE-032] キャッシュの活用

**優先度**: 🟡 推奨

```typescript
// ✅ 良い例：Redisキャッシュの使用
async function getProcessedMessageIds(): Promise<Set<string>> {
  if (!redis) {
    return new Set();
  }

  const cached = await redis.get('processed:message_ids');
  if (cached) {
    return new Set(JSON.parse(cached));
  }

  // キャッシュがない場合はDBから取得
  const ids = await fetchMessageIds();
  await redis.set('processed:message_ids', JSON.stringify(Array.from(ids)), {
    ex: 3600 // 1時間の有効期限
  });

  return ids;
}
```

---

## 🔄 ルールの更新プロセス

1. **提案**: 新しいルールが必要な場合、このドキュメントに追加を提案
2. **検討**: ルールの必要性・実現可能性を検討
3. **追加**: このドキュメントに追加
4. **周知**: チーム（または開発者）に周知
5. **レビュー**: 定期的にルールを見直し、不要なものは削除

---

## 📖 参考資料

### 設計書

- [要件定義書](../docs/01_requirements.md)
- [アーキテクチャ設計書](../docs/02_architecture.md)
- [データベース設計書](../docs/03_database.md)
- [API設計書](../docs/04_api.md)
- [サイトマップ・画面設計書](../docs/05_sitemap.md)

### 技術ドキュメント

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Hono Documentation](https://hono.dev/)
- [Supabase Documentation](https://supabase.com/docs)
- [LINE Messaging API Documentation](https://developers.line.biz/ja/docs/messaging-api/)
- [OpenAI API Documentation](https://platform.openai.com/docs)

### 守るべきルールファイル

AIアシスタントは以下のルールファイルを必ず参照し、厳守してください：

- `./cursor/rules/dev-rules/*.mdc` - 開発ルール（Cursor設定）
- `docs/PROJECT-RULES.md` - プロジェクトルール（このファイル）

**ルールファイル参照時の発言**: ルールファイルを参照した際は、必ずファイル名を発言してください。

---

**最終更新**: 2025-01-XX  
**次回レビュー**: プロジェクト完了時  
**ルール総数**: 32

