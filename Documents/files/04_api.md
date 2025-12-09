# AutoTracker API設計書

**バージョン:** 1.0  
**作成日:** 2025年12月10日  
**参照:** 01_requirements.md, 02_architecture.md, 03_database.md

---

## 目次

1. [API概要](#1-api概要)
2. [IPC API一覧](#2-ipc-api一覧)
3. [Tracking API](#3-tracking-api)
4. [Project API](#4-project-api)
5. [Entry API](#5-entry-api)
6. [Rule API](#6-rule-api)
7. [Report API](#7-report-api)
8. [Settings API](#8-settings-api)
9. [Screenshot API](#9-screenshot-api)
10. [AI Usage API](#10-ai-usage-api)
11. [イベント API](#11-イベント-api)
12. [エラーハンドリング](#12-エラーハンドリング)
13. [型定義](#13-型定義)

---

## 1. API概要

### 1.1 アーキテクチャ

AutoTrackerはElectronアプリケーションのため、REST APIではなくIPC（Inter-Process Communication）を使用してRenderer ProcessとMain Process間で通信します。

```
┌─────────────────────────────────────────────────────────┐
│                  Renderer Process                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │              React Application                   │    │
│  │                      │                           │    │
│  │              window.api.xxx()                    │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│                         ▼                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Preload Script                      │    │
│  │         contextBridge.exposeInMainWorld         │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                          │
                    IPC Channel
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Main Process                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │              IPC Handlers                        │    │
│  │         ipcMain.handle('channel', ...)          │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│                         ▼                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Services / Database                 │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 1.2 通信パターン

| パターン | 用途 | Electron API |
|---------|------|-------------|
| Request/Response | データ取得・更新 | `ipcRenderer.invoke` / `ipcMain.handle` |
| One-way (R→M) | アクション実行 | `ipcRenderer.send` / `ipcMain.on` |
| One-way (M→R) | イベント通知 | `webContents.send` / `ipcRenderer.on` |

### 1.3 命名規則

```
{domain}:{action}
```

例:
- `tracking:start` - トラッキング開始
- `project:get-all` - 全プロジェクト取得
- `entry:update` - エントリー更新

---

## 2. IPC API一覧

### 2.1 チャンネル一覧

| カテゴリ | チャンネル | 方向 | 説明 |
|---------|-----------|------|------|
| **Tracking** | `tracking:start` | R→M | トラッキング開始 |
| | `tracking:stop` | R→M | トラッキング停止 |
| | `tracking:pause` | R→M | トラッキング一時停止 |
| | `tracking:resume` | R→M | トラッキング再開 |
| | `tracking:get-status` | R→M | ステータス取得 |
| | `tracking:entry-created` | M→R | エントリー作成通知 |
| | `tracking:entry-updated` | M→R | エントリー更新通知 |
| | `tracking:confirmation-needed` | M→R | 確認依頼通知 |
| | `tracking:confirmation-response` | R→M | 確認応答 |
| **Project** | `project:get-all` | R→M | 全プロジェクト取得 |
| | `project:get-by-id` | R→M | ID指定取得 |
| | `project:create` | R→M | プロジェクト作成 |
| | `project:update` | R→M | プロジェクト更新 |
| | `project:delete` | R→M | プロジェクト削除 |
| | `project:archive` | R→M | アーカイブ |
| | `project:restore` | R→M | アーカイブ解除 |
| **Entry** | `entry:get-by-date-range` | R→M | 期間指定取得 |
| | `entry:get-today` | R→M | 今日のエントリー取得 |
| | `entry:get-current` | R→M | 現在のエントリー取得 |
| | `entry:create` | R→M | エントリー作成 |
| | `entry:update` | R→M | エントリー更新 |
| | `entry:delete` | R→M | エントリー削除 |
| | `entry:split` | R→M | エントリー分割 |
| | `entry:merge` | R→M | エントリー結合 |
| **Rule** | `rule:get-by-project` | R→M | プロジェクト別ルール取得 |
| | `rule:create` | R→M | ルール作成 |
| | `rule:update` | R→M | ルール更新 |
| | `rule:delete` | R→M | ルール削除 |
| | `rule:test` | R→M | ルールテスト |
| **Report** | `report:generate-daily` | R→M | 日次レポート生成 |
| | `report:generate-weekly` | R→M | 週次レポート生成 |
| | `report:generate-monthly` | R→M | 月次レポート生成 |
| | `report:generate-custom` | R→M | カスタム期間レポート |
| | `report:export-pdf` | R→M | PDFエクスポート |
| | `report:export-csv` | R→M | CSVエクスポート |
| **Settings** | `settings:get` | R→M | 全設定取得 |
| | `settings:get-by-key` | R→M | キー指定取得 |
| | `settings:update` | R→M | 設定更新 |
| | `settings:reset` | R→M | 設定リセット |
| **Screenshot** | `screenshot:get-by-entry` | R→M | エントリー別取得 |
| | `screenshot:get-image` | R→M | 画像データ取得 |
| | `screenshot:delete` | R→M | 削除 |
| **AI Usage** | `ai-usage:get-monthly` | R→M | 月間使用状況 |
| | `ai-usage:get-budget-status` | R→M | 予算状況 |
| **System** | `system:get-app-info` | R→M | アプリ情報取得 |
| | `system:open-external` | R→M | 外部リンクを開く |
| | `system:show-notification` | R→M | システム通知表示 |

---

## 3. Tracking API

### 3.1 tracking:start

トラッキングを開始します。

**Request:**
```typescript
// パラメータなし
window.api.tracking.start()
```

**Response:**
```typescript
interface StartResponse {
  success: boolean;
  status: TrackingStatus;
}

interface TrackingStatus {
  isRunning: boolean;
  isPaused: boolean;
  startedAt: string | null;      // ISO8601
  currentEntryId: number | null;
  currentProjectId: number | null;
  currentProjectName: string | null;
  elapsedSeconds: number;
  confidence: number;
}
```

**Example:**
```typescript
const result = await window.api.tracking.start();
// { success: true, status: { isRunning: true, isPaused: false, ... } }
```

---

### 3.2 tracking:stop

トラッキングを停止します。

**Request:**
```typescript
window.api.tracking.stop()
```

**Response:**
```typescript
interface StopResponse {
  success: boolean;
  finalEntry: Entry | null;  // 最後のエントリー
}
```

---

### 3.3 tracking:pause / tracking:resume

トラッキングを一時停止/再開します。

**Request:**
```typescript
window.api.tracking.pause()
window.api.tracking.resume()
```

**Response:**
```typescript
interface PauseResumeResponse {
  success: boolean;
  status: TrackingStatus;
}
```

---

### 3.4 tracking:get-status

現在のトラッキング状態を取得します。

**Request:**
```typescript
window.api.tracking.getStatus()
```

**Response:**
```typescript
TrackingStatus
```

---

### 3.5 tracking:confirmation-response

AI判定の確認応答を送信します。

**Request:**
```typescript
interface ConfirmationResponse {
  entryId: number;
  action: 'confirm' | 'change' | 'split';
  newProjectId?: number;     // action === 'change' の場合
  splitTime?: string;        // action === 'split' の場合
}

window.api.tracking.respondConfirmation(response)
```

**Response:**
```typescript
interface ConfirmationResult {
  success: boolean;
  updatedEntry: Entry;
}
```

---

## 4. Project API

### 4.1 project:get-all

全プロジェクトを取得します。

**Request:**
```typescript
interface GetAllProjectsParams {
  includeArchived?: boolean;  // デフォルト: false
}

window.api.projects.getAll(params?)
```

**Response:**
```typescript
Project[]
```

**Example:**
```typescript
const projects = await window.api.projects.getAll({ includeArchived: true });
```

---

### 4.2 project:get-by-id

ID指定でプロジェクトを取得します。

**Request:**
```typescript
window.api.projects.getById(id: number)
```

**Response:**
```typescript
Project | null
```

---

### 4.3 project:create

プロジェクトを作成します。

**Request:**
```typescript
interface CreateProjectDTO {
  name: string;              // 必須
  clientName?: string;
  color?: string;            // デフォルト: #E5C890
  icon?: string;             // デフォルト: 📁
  hourlyRate?: number;
  budgetHours?: number;
}

window.api.projects.create(data: CreateProjectDTO)
```

**Response:**
```typescript
Project
```

**Validation:**
- `name`: 1-100文字、必須
- `color`: HEX形式（#RRGGBB）
- `hourlyRate`: 0以上
- `budgetHours`: 0以上

**Example:**
```typescript
const project = await window.api.projects.create({
  name: 'TEPCO LINE Marketing',
  clientName: '東京電力',
  color: '#4CAF50',
  hourlyRate: 5000,
  budgetHours: 40
});
```

---

### 4.4 project:update

プロジェクトを更新します。

**Request:**
```typescript
interface UpdateProjectDTO {
  name?: string;
  clientName?: string | null;
  color?: string;
  icon?: string;
  hourlyRate?: number | null;
  budgetHours?: number | null;
}

window.api.projects.update(id: number, data: UpdateProjectDTO)
```

**Response:**
```typescript
Project
```

---

### 4.5 project:delete

プロジェクトを削除します。関連するルールも削除されます。エントリーのproject_idはNULLになります。

**Request:**
```typescript
window.api.projects.delete(id: number)
```

**Response:**
```typescript
{ success: boolean }
```

---

### 4.6 project:archive / project:restore

プロジェクトをアーカイブ/復元します。

**Request:**
```typescript
window.api.projects.archive(id: number)
window.api.projects.restore(id: number)
```

**Response:**
```typescript
Project
```

---

## 5. Entry API

### 5.1 entry:get-by-date-range

期間指定でエントリーを取得します。

**Request:**
```typescript
interface GetEntriesParams {
  startDate: string;         // ISO8601 (YYYY-MM-DD)
  endDate: string;           // ISO8601 (YYYY-MM-DD)
  projectId?: number;        // プロジェクトでフィルタ
  includeNonWork?: boolean;  // 非業務含む（デフォルト: false）
}

window.api.entries.getByDateRange(params: GetEntriesParams)
```

**Response:**
```typescript
EntryWithProject[]

interface EntryWithProject extends Entry {
  projectName: string | null;
  projectColor: string | null;
}
```

**Example:**
```typescript
const entries = await window.api.entries.getByDateRange({
  startDate: '2025-12-01',
  endDate: '2025-12-31',
  projectId: 1
});
```

---

### 5.2 entry:get-today

今日のエントリーを取得します。

**Request:**
```typescript
window.api.entries.getToday()
```

**Response:**
```typescript
EntryWithProject[]
```

---

### 5.3 entry:get-current

現在進行中のエントリーを取得します。

**Request:**
```typescript
window.api.entries.getCurrent()
```

**Response:**
```typescript
EntryWithProject | null
```

---

### 5.4 entry:create

エントリーを手動作成します。

**Request:**
```typescript
interface CreateEntryDTO {
  projectId?: number;
  startTime: string;         // ISO8601
  endTime?: string;          // ISO8601（省略で進行中）
  subtask?: string;
  isWork?: boolean;          // デフォルト: true
}

window.api.entries.create(data: CreateEntryDTO)
```

**Response:**
```typescript
Entry
```

---

### 5.5 entry:update

エントリーを更新します。

**Request:**
```typescript
interface UpdateEntryDTO {
  projectId?: number | null;
  startTime?: string;
  endTime?: string | null;
  subtask?: string | null;
  isWork?: boolean;
}

window.api.entries.update(id: number, data: UpdateEntryDTO)
```

**Response:**
```typescript
Entry
```

---

### 5.6 entry:delete

エントリーを削除します。

**Request:**
```typescript
window.api.entries.delete(id: number)
```

**Response:**
```typescript
{ success: boolean }
```

---

### 5.7 entry:split

エントリーを指定時刻で分割します。

**Request:**
```typescript
interface SplitEntryParams {
  entryId: number;
  splitTime: string;         // ISO8601
}

window.api.entries.split(params: SplitEntryParams)
```

**Response:**
```typescript
{
  before: Entry;   // 分割前半
  after: Entry;    // 分割後半
}
```

---

### 5.8 entry:merge

複数のエントリーを結合します。

**Request:**
```typescript
interface MergeEntriesParams {
  entryIds: number[];        // 2つ以上
  projectId?: number;        // 結合後のプロジェクト
}

window.api.entries.merge(params: MergeEntriesParams)
```

**Response:**
```typescript
Entry  // 結合後のエントリー
```

---

## 6. Rule API

### 6.1 rule:get-by-project

プロジェクトのルール一覧を取得します。

**Request:**
```typescript
window.api.rules.getByProject(projectId: number)
```

**Response:**
```typescript
Rule[]
```

---

### 6.2 rule:create

ルールを作成します。

**Request:**
```typescript
interface CreateRuleDTO {
  projectId: number;
  type: RuleType;
  pattern: string;
  priority?: number;         // デフォルト: 0
  isEnabled?: boolean;       // デフォルト: true
}

type RuleType = 'window_title' | 'url' | 'keyword' | 'app_name' | 'file_path';

window.api.rules.create(data: CreateRuleDTO)
```

**Response:**
```typescript
Rule
```

**Pattern Format by Type:**

| Type | Pattern Format | Example |
|------|---------------|---------|
| window_title | 正規表現 | `.*Slack.*` |
| url | 正規表現 | `https://github.com/.*` |
| keyword | JSON配列 | `["TEPCO", "東京電力"]` |
| app_name | 完全一致 | `Figma` |
| file_path | 正規表現 | `.*\/projects\/.*` |

---

### 6.3 rule:update

ルールを更新します。

**Request:**
```typescript
interface UpdateRuleDTO {
  type?: RuleType;
  pattern?: string;
  priority?: number;
  isEnabled?: boolean;
}

window.api.rules.update(id: number, data: UpdateRuleDTO)
```

**Response:**
```typescript
Rule
```

---

### 6.4 rule:delete

ルールを削除します。

**Request:**
```typescript
window.api.rules.delete(id: number)
```

**Response:**
```typescript
{ success: boolean }
```

---

### 6.5 rule:test

ルールのマッチングをテストします。

**Request:**
```typescript
interface TestRuleParams {
  type: RuleType;
  pattern: string;
  testData: {
    windowTitle?: string;
    url?: string;
    appName?: string;
    filePath?: string;
  };
}

window.api.rules.test(params: TestRuleParams)
```

**Response:**
```typescript
{
  matched: boolean;
  matchedText?: string;
}
```

---

## 7. Report API

### 7.1 report:generate-daily

日次レポートを生成します。

**Request:**
```typescript
interface DailyReportParams {
  date: string;              // YYYY-MM-DD
}

window.api.reports.generateDaily(params: DailyReportParams)
```

**Response:**
```typescript
interface DailyReport {
  date: string;
  totalHours: number;
  totalRevenue: number;
  projectBreakdown: ProjectBreakdown[];
  entries: EntryWithProject[];
  anomalies: Anomaly[];
}

interface ProjectBreakdown {
  projectId: number | null;
  projectName: string;
  projectColor: string;
  hours: number;
  percentage: number;
  revenue: number;
}

interface Anomaly {
  type: 'short_entry' | 'long_gap' | 'frequent_switch';
  message: string;
  entryIds: number[];
}
```

---

### 7.2 report:generate-weekly

週次レポートを生成します。

**Request:**
```typescript
interface WeeklyReportParams {
  weekStart: string;         // YYYY-MM-DD（週の開始日）
}

window.api.reports.generateWeekly(params: WeeklyReportParams)
```

**Response:**
```typescript
interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  totalHours: number;
  totalRevenue: number;
  dailyHours: { date: string; hours: number }[];
  projectBreakdown: ProjectBreakdown[];
  comparison: {
    previousWeekHours: number;
    changePercent: number;
  };
}
```

---

### 7.3 report:generate-monthly

月次レポートを生成します。

**Request:**
```typescript
interface MonthlyReportParams {
  year: number;
  month: number;             // 1-12
}

window.api.reports.generateMonthly(params: MonthlyReportParams)
```

**Response:**
```typescript
interface MonthlyReport {
  year: number;
  month: number;
  totalHours: number;
  totalRevenue: number;
  weeklyHours: { weekStart: string; hours: number }[];
  dailyHours: { date: string; hours: number }[];
  projectBreakdown: ProjectBreakdown[];
  comparison: {
    previousMonthHours: number;
    changePercent: number;
  };
  billableHours: number;
}
```

---

### 7.4 report:generate-custom

カスタム期間のレポートを生成します。

**Request:**
```typescript
interface CustomReportParams {
  startDate: string;
  endDate: string;
  projectId?: number;
}

window.api.reports.generateCustom(params: CustomReportParams)
```

**Response:**
```typescript
interface CustomReport {
  startDate: string;
  endDate: string;
  totalHours: number;
  totalRevenue: number;
  dailyHours: { date: string; hours: number }[];
  projectBreakdown: ProjectBreakdown[];
}
```

---

### 7.5 report:export-pdf

レポートをPDFでエクスポートします。

**Request:**
```typescript
interface ExportPDFParams {
  reportType: 'daily' | 'weekly' | 'monthly' | 'custom';
  reportData: DailyReport | WeeklyReport | MonthlyReport | CustomReport;
  options?: {
    includeDetails?: boolean;
    language?: 'ja' | 'en';
  };
}

window.api.reports.exportPDF(params: ExportPDFParams)
```

**Response:**
```typescript
{
  filePath: string;
}
```

---

### 7.6 report:export-csv

レポートをCSVでエクスポートします。

**Request:**
```typescript
interface ExportCSVParams {
  startDate: string;
  endDate: string;
  projectId?: number;
  format?: 'detailed' | 'summary';
}

window.api.reports.exportCSV(params: ExportCSVParams)
```

**Response:**
```typescript
{
  filePath: string;
}
```

---

## 8. Settings API

### 8.1 settings:get

全設定を取得します。

**Request:**
```typescript
window.api.settings.get()
```

**Response:**
```typescript
interface Settings {
  tracking: {
    captureInterval: number;
    metadataInterval: number;
    aiJudgmentMode: 'aggressive' | 'standard' | 'conservative';
    autoStartOnBoot: boolean;
    breakDetectionThreshold: number;
  };
  notifications: {
    confirmationMode: 'always' | 'low-confidence' | 'never';
    anomalyAlerts: boolean;
    reportReminders: boolean;
    reportReminderTime: string;
  };
  privacy: {
    screenshotStorage: 'local' | 'cloud';
    screenshotRetention: number;
    passwordDetection: boolean;
    excludeKeywords: string[];
  };
  appearance: {
    theme: 'dark' | 'light' | 'auto';
    accentColor: 'amber' | 'blue' | 'green' | 'purple';
    fontSize: 'small' | 'medium' | 'large';
  };
  ai: {
    monthlyBudget: number;
    batchMode: boolean;
  };
}
```

---

### 8.2 settings:update

設定を更新します。

**Request:**
```typescript
window.api.settings.update(settings: Partial<Settings>)
```

**Response:**
```typescript
Settings
```

---

## 9. Screenshot API

### 9.1 screenshot:get-by-entry

エントリーに紐づくスクリーンショット一覧を取得します。

**Request:**
```typescript
window.api.screenshots.getByEntry(entryId: number)
```

**Response:**
```typescript
ScreenshotMeta[]

interface ScreenshotMeta {
  id: number;
  entryId: number;
  timestamp: string;
  windowTitle: string | null;
  url: string | null;
  appName: string | null;
}
```

---

### 9.2 screenshot:get-image

スクリーンショット画像を取得します（復号化して返却）。

**Request:**
```typescript
window.api.screenshots.getImage(id: number)
```

**Response:**
```typescript
{
  data: string;              // Base64エンコード
  mimeType: 'image/jpeg';
}
```

---

## 10. AI Usage API

### 10.1 ai-usage:get-monthly

今月のAI使用状況を取得します。

**Request:**
```typescript
window.api.aiUsage.getMonthly()
```

**Response:**
```typescript
interface AIUsageMonthly {
  month: string;
  totalTokens: number;
  totalCost: number;
  byModel: {
    model: string;
    tokens: number;
    cost: number;
    requestCount: number;
  }[];
}
```

---

### 10.2 ai-usage:get-budget-status

予算状況を取得します。

**Request:**
```typescript
window.api.aiUsage.getBudgetStatus()
```

**Response:**
```typescript
interface BudgetStatus {
  monthlyBudget: number;
  currentUsage: number;
  remaining: number;
  percentUsed: number;
  isOverBudget: boolean;
}
```

---

## 11. イベント API

Main ProcessからRenderer Processへのプッシュ通知です。

### 11.1 tracking:entry-created

```typescript
window.api.tracking.onEntryCreated((entry: EntryWithProject) => {
  console.log('New entry:', entry);
});
```

### 11.2 tracking:confirmation-needed

```typescript
interface ConfirmationRequest {
  entryId: number;
  suggestedProject: { id: number | null; name: string };
  confidence: number;
  reasoning: string;
  alternatives: { id: number; name: string; score: number }[];
}

window.api.tracking.onConfirmationNeeded((request: ConfirmationRequest) => {
  // 確認ダイアログを表示
});
```

### 11.3 ai-usage:budget-warning

```typescript
window.api.aiUsage.onBudgetWarning((status: BudgetStatus) => {
  // 警告を表示
});
```

---

## 12. エラーハンドリング

### 12.1 エラー形式

```typescript
interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
}
```

### 12.2 エラーコード一覧

| コード | 説明 |
|--------|------|
| `VALIDATION_ERROR` | 入力値バリデーションエラー |
| `NOT_FOUND` | リソースが見つからない |
| `DATABASE_ERROR` | DB操作エラー |
| `AI_API_ERROR` | OpenAI APIエラー |
| `AI_RATE_LIMIT` | APIレート制限 |
| `AI_BUDGET_EXCEEDED` | AI予算超過 |
| `ENCRYPTION_ERROR` | 暗号化/復号化エラー |
| `TRACKING_ALREADY_RUNNING` | 既にトラッキング中 |
| `TRACKING_NOT_RUNNING` | トラッキングが開始されていない |

---

## 13. 型定義

### 13.1 共有型定義

```typescript
// shared/types/index.ts

export interface Project {
  id: number;
  name: string;
  clientName: string | null;
  color: string;
  icon: string | null;
  hourlyRate: number | null;
  budgetHours: number | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Entry {
  id: number;
  projectId: number | null;
  startTime: string;
  endTime: string | null;
  confidence: number;
  aiReasoning: string | null;
  subtask: string | null;
  isManual: boolean;
  isWork: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EntryWithProject extends Entry {
  projectName: string | null;
  projectColor: string | null;
}

export interface Rule {
  id: number;
  projectId: number;
  type: RuleType;
  pattern: string;
  priority: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RuleType = 'window_title' | 'url' | 'keyword' | 'app_name' | 'file_path';
```

---

**END OF DOCUMENT**
