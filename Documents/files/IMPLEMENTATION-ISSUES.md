### フェーズ構成

- **Phase 1: Walking Skeleton** - 最小限の動作するアプリケーション構築 / #1〜#5
- **Phase 2: コア機能実装** - 自動トラッキング機能の実装 / #6〜#12
- **Phase 3: UI実装** - フロントエンド機能の実装 / #13〜#18
- **Phase 4: 統合・完成** - 機能統合とMVP完成 / #19〜#22

### 依存関係マップ

```
#1 → #2 → #3 → #4 → #5
                ↓
#6 → #7 → #8 → #9 → #10 → #11 → #12
                ↓
#13 → #14 → #15 → #16 → #17 → #18
                ↓
#19 → #20 → #21 → #22
```

#### Issueアウトライン表

##### Issue #1: Electron + React + TypeScript プロジェクトセットアップ

**概要**: Electron 28 + React 18 + TypeScript 5の基本プロジェクト構造を作成。Viteビルド設定とディレクトリ構造を構築する。

**依存**: -

**ラベル**: infra, setup

**受け入れ基準（AC）**:
- [ ] Electron 28 + React 18 + TypeScript 5のプロジェクト作成完了
- [ ] Vite設定ファイル（vite.config.ts）の作成とElectron統合
- [ ] 基本ディレクトリ構造の作成（electron/, src/, shared/）
- [ ] package.jsonに必要なスクリプト追加（dev, build, start）
- [ ] TypeScript設定ファイル（tsconfig.json）の作成
- [ ] ESLint + Prettier設定の追加
- [ ] 開発サーバー起動確認（npm run devでアプリが起動）

##### Issue #2: SQLiteデータベースセットアップ

**概要**: better-sqlite3を使用したSQLiteデータベースの初期化とマイグレーションシステムの実装。

**依存**: #1

**ラベル**: backend, database

**受け入れ基準（AC）**:
- [ ] better-sqlite3のインストールとDB接続実装
- [ ] マイグレーションシステム（Migratorクラス）の実装
- [ ] 初期スキーママイグレーション（001_initial.ts）の作成
- [ ] テーブル作成確認（projects, entries, rules, screenshots, settings, ai_usage_logs）
- [ ] インデックス作成確認
- [ ] デフォルト設定データの挿入確認
- [ ] DBファイルが{userData}/autotracker.dbに作成されることを確認

##### Issue #3: IPC通信基盤の実装

**概要**: Preload ScriptとIPC Handlersの基本構造を実装。RendererとMain Process間の通信基盤を構築。

**依存**: #1, #2

**ラベル**: backend, frontend, ipc

**受け入れ基準（AC）**:
- [ ] Preload Script（electron/preload.ts）の作成
- [ ] contextBridgeでAPI公開（window.api）
- [ ] IPC Handlers基本構造（electron/ipc/index.ts）の作成
- [ ] テスト用IPCチャンネル（test:ping/pong）の実装
- [ ] Renderer側IPCクライアント（src/lib/ipc.ts）の作成
- [ ] IPC通信の動作確認（Renderer → Main → Renderer）

##### Issue #4: フロントエンド基盤の実装

**概要**: React Router設定、レイアウトコンポーネント、基本UIコンポーネントライブラリのセットアップ。

**依存**: #1, #3

**ラベル**: frontend, ui

**受け入れ基準（AC）**:
- [ ] React Router設定（react-router-dom）
- [ ] 基本レイアウトコンポーネント（Layout, Sidebar, Header）の作成
- [ ] shadcn/uiのセットアップと基本コンポーネント追加（Button, Card, Input）
- [ ] Tailwind CSS設定とカラーパレット定義
- [ ] ダークテーマの適用確認
- [ ] ルーティング動作確認（/dashboard, /timeline, /projects, /reports, /settings）

##### Issue #5: プロジェクト管理機能（CRUD）

**概要**: プロジェクトの作成・読み取り・更新・削除機能を実装。IPC経由でDB操作を行う。

**依存**: #2, #3, #4

**ラベル**: backend, frontend, feature

**受け入れ基準（AC）**:
- [ ] ProjectRepositoryの実装（CRUD操作）
- [ ] IPC Handler（project:get-all, project:create, project:update, project:delete）の実装
- [ ] プロジェクト一覧画面（/projects）の実装
- [ ] プロジェクト作成フォームの実装
- [ ] プロジェクト編集機能の実装
- [ ] プロジェクト削除機能の実装（確認ダイアログ含む）
- [ ] DB操作の動作確認（作成・更新・削除が正常に動作）

##### Issue #6: スクリーンキャプチャ機能の実装

**概要**: screenshot-desktopを使用した画面キャプチャ機能を実装。画像圧縮と暗号化処理を含む。

**依存**: #2

**ラベル**: backend, core

**受け入れ基準（AC）**:
- [ ] screenshot-desktopのインストール
- [ ] ScreenCaptureServiceの実装（captureメソッド）
- [ ] Sharpを使用した画像圧縮（200KB以下目標）
- [ ] AES-256暗号化処理の実装
- [ ] スクリーンショット保存先の設定（{userData}/screenshots/）
- [ ] DBへのメタデータ保存（screenshotsテーブル）
- [ ] 手動テストでスクリーンショット取得・保存を確認

##### Issue #7: ウィンドウ監視機能の実装

**概要**: active-winを使用したアクティブウィンドウ情報の取得機能を実装。5秒間隔でメタデータを収集。

**依存**: #2, #6

**ラベル**: backend, core

**受け入れ基準（AC）**:
- [ ] active-winのインストール
- [ ] WindowMonitorServiceの実装（getActiveWindowメソッド）
- [ ] メタデータ収集（windowTitle, url, appName）
- [ ] 5秒間隔での自動収集機能
- [ ] ブラウザURL取得機能（Chrome/Edge/Safari対応）
- [ ] メタデータの一時保存機能
- [ ] 手動テストでウィンドウ情報取得を確認

##### Issue #8: ルールマッチングエンジンの実装

**概要**: プロジェクトの自動検出ルール（正規表現、キーワード、アプリ名）に基づくマッチング機能を実装。

**依存**: #2, #5, #7

**ラベル**: backend, core

**受け入れ基準（AC）**:
- [ ] RuleMatchingServiceの実装
- [ ] ルールタイプ別マッチング処理（window_title, url, keyword, app_name, file_path）
- [ ] 優先度によるルール評価順序の実装
- [ ] キーワードマッチング（JSON配列のOR条件）
- [ ] 正規表現マッチング（window_title, url, file_path）
- [ ] ルールテスト機能（rule:test IPC）の実装
- [ ] マッチング動作確認（テストルールでマッチ/不一致を確認）

##### Issue #9: AI判定サービス（OpenAI API連携）

**概要**: OpenAI APIを使用した1次判定（gpt-5-nano）と2次判定（gpt-5-mini）の実装。コスト管理とレート制限対応を含む。

**依存**: #2, #6, #7

**ラベル**: backend, ai

**受け入れ基準（AC）**:
- [ ] OpenAI APIクライアントの実装
- [ ] 1次判定（変化検知）の実装（gpt-5-nano）
- [ ] 2次判定（プロジェクト判定）の実装（gpt-5-mini）
- [ ] レート制限対応（60req/min）
- [ ] リトライロジック（指数バックオフ）
- [ ] AI使用ログ記録（ai_usage_logsテーブル）
- [ ] コスト計算機能の実装
- [ ] API動作確認（テストリクエストで応答確認）

##### Issue #10: 変化検知エンジンの実装

**概要**: 5層の変化検知（タイトル/OCR/画像/ルール/AI）を統合したChangeDetectorの実装。

**依存**: #6, #7, #8, #9

**ラベル**: backend, core

**受け入れ基準（AC）**:
- [ ] ChangeDetectorクラスの実装
- [ ] 5層の変化検知ロジック（Layer 1-5）
- [ ] OCR処理（Tesseract.js）の統合
- [ ] 画像ハッシュ比較機能
- [ ] ルールマッチングとの統合
- [ ] AI判定との統合
- [ ] 変化検知の動作確認（画面変更時に検知）

##### Issue #11: トラッキングエンジン（メインループ）の実装

**概要**: スクリーンショット取得、変化検知、AI判定を統合したTrackingEngineの実装。30秒〜2分間隔での自動実行。

**依存**: #6, #7, #9, #10

**ラベル**: backend, core

**受け入れ基準（AC）**:
- [ ] TrackingEngineクラスの実装
- [ ] スクリーンショット取得ループ（30秒〜2分間隔）
- [ ] メタデータ収集ループ（5秒間隔）
- [ ] 変化検知との統合
- [ ] AI判定との統合
- [ ] エントリー作成ロジック（信頼度85%以上で自動保存）
- [ ] トラッキング開始/停止/一時停止機能
- [ ] IPC Handler（tracking:start, tracking:stop, tracking:get-status）の実装
- [ ] 動作確認（トラッキング開始で自動実行）

##### Issue #12: エントリー管理機能の実装

**概要**: 時間エントリーの作成・更新・削除・分割・結合機能を実装。EntryRepositoryとIPC Handlersを含む。

**依存**: #2, #3, #11

**ラベル**: backend, frontend, feature

**受け入れ基準（AC）**:
- [ ] EntryRepositoryの実装（CRUD操作）
- [ ] エントリー分割機能（entry:split）
- [ ] エントリー結合機能（entry:merge）
- [ ] IPC Handlers（entry:get-by-date-range, entry:update, entry:delete等）の実装
- [ ] 日付範囲でのエントリー取得機能
- [ ] 現在進行中エントリー取得機能
- [ ] DB操作の動作確認（作成・更新・削除・分割・結合）

##### Issue #13: ダッシュボード画面の実装

**概要**: 現在の作業状況と今日の統計を表示するダッシュボード画面を実装。

**依存**: #4, #11, #12

**ラベル**: frontend, ui

**受け入れ基準（AC）**:
- [ ] Dashboardページコンポーネントの作成
- [ ] CurrentTaskコンポーネント（現在の作業表示）
- [ ] TodayStatsコンポーネント（統計カード）
- [ ] RecentTimelineコンポーネント（直近のタイムライン）
- [ ] リアルタイム更新機能（IPCイベント受信）
- [ ] トラッキング開始/停止ボタンの実装
- [ ] 画面表示確認（データが正しく表示される）

##### Issue #14: タイムライン画面の実装

**概要**: 時系列での作業記録表示と編集機能を実装。日付選択、フィルター、エントリー編集を含む。

**依存**: #4, #12

**ラベル**: frontend, ui

**受け入れ基準（AC）**:
- [ ] Timelineページコンポーネントの作成
- [ ] DatePickerコンポーネントの実装
- [ ] TimelineFilterコンポーネントの実装
- [ ] TimelineEntryコンポーネントの実装
- [ ] エントリー編集モーダルの実装
- [ ] エントリー分割機能のUI実装
- [ ] エントリー削除機能の実装
- [ ] 手動エントリー追加機能の実装
- [ ] 画面表示確認（タイムラインが正しく表示される）

##### Issue #15: プロジェクト管理画面の実装

**概要**: プロジェクト一覧、作成、編集、ルール設定画面を実装。

**依存**: #4, #5, #8

**ラベル**: frontend, ui

**受け入れ基準（AC）**:
- [ ] Projectsページコンポーネントの作成
- [ ] ProjectCardコンポーネントの実装
- [ ] ProjectFormコンポーネントの実装（新規作成/編集）
- [ ] RuleEditorコンポーネントの実装
- [ ] ルール追加モーダルの実装
- [ ] ルールテスト機能のUI実装
- [ ] 予算進捗バーの表示
- [ ] 画面表示確認（プロジェクト一覧が正しく表示される）

##### Issue #16: 日次レポート機能の実装

**概要**: 日次レポートの生成と表示機能を実装。プロジェクト別集計、グラフ表示を含む。

**依存**: #2, #4, #12

**ラベル**: backend, frontend, feature

**受け入れ基準（AC）**:
- [ ] ReportRepositoryの実装（日次集計クエリ）
- [ ] IPC Handler（report:generate-daily）の実装
- [ ] Reportsページコンポーネントの作成
- [ ] 日次サマリー表示（総時間、請求可能時間、売上）
- [ ] プロジェクト別内訳表示
- [ ] Rechartsを使用したグラフ表示（円グラフ/棒グラフ）
- [ ] 日付選択機能の実装
- [ ] 画面表示確認（レポートが正しく表示される）

##### Issue #17: 確認通知機能の実装

**概要**: AI判定の信頼度が85%未満の場合のユーザー確認機能を実装。通知表示と応答処理を含む。

**依存**: #3, #9, #11

**ラベル**: backend, frontend, feature

**受け入れ基準（AC）**:
- [ ] IPCイベント（tracking:confirmation-needed）の実装
- [ ] ConfirmationDialogコンポーネントの実装
- [ ] 確認応答処理（tracking:confirmation-response）の実装
- [ ] 通知表示機能（システム通知）
- [ ] 1時間に最大3回の制限実装
- [ ] 確認応答後のエントリー更新処理
- [ ] 動作確認（低信頼度判定で通知表示）

##### Issue #18: 設定画面の実装

**概要**: アプリケーション設定画面を実装。トラッキング設定、通知設定、プライバシー設定を含む。

**依存**: #2, #3, #4

**ラベル**: backend, frontend, ui

**受け入れ基準（AC）**:
- [ ] Settingsページコンポーネントの作成
- [ ] SettingsServiceの実装（設定の読み書き）
- [ ] IPC Handler（settings:get, settings:update）の実装
- [ ] トラッキング設定タブの実装
- [ ] 通知設定タブの実装
- [ ] プライバシー設定タブの実装
- [ ] 設定の保存・読み込み確認
- [ ] 画面表示確認（設定が正しく表示・保存される）

##### Issue #19: パスワード画面検出機能の実装

**概要**: パスワード入力画面の検出とスクリーンショット取得のスキップ機能を実装。

**依存**: #6, #7, #18

**ラベル**: backend, security

**受け入れ基準（AC）**:
- [ ] パスワード画面検出ロジックの実装（タイトルパターン、OCRパターン）
- [ ] 除外キーワードチェック機能の実装
- [ ] スクリーンショット取得のスキップ処理
- [ ] 設定画面での除外キーワード管理機能
- [ ] 動作確認（パスワード画面でスキップ）

##### Issue #20: バックアップ機能の実装

**概要**: データベースの自動バックアップ機能を実装。1時間ごとのバックアップと復元機能を含む。

**依存**: #2

**ラベル**: backend, infra

**受け入れ基準（AC）**:
- [ ] BackupServiceの実装
- [ ] 1時間ごとの自動バックアップ機能
- [ ] バックアップファイルの保存（{userData}/backups/）
- [ ] 古いバックアップの自動削除（7世代保持）
- [ ] バックアップ整合性チェック機能
- [ ] 起動時のリカバリ機能
- [ ] 手動復元機能の実装
- [ ] 動作確認（バックアップ作成・復元）

##### Issue #21: エラーハンドリングとログ機能の実装

**概要**: エラーハンドリング、ログ出力、クラッシュレポート機能を実装。

**依存**: #1, #2

**ラベル**: backend, infra

**受け入れ基準（AC）**:
- [ ] Loggerクラスの実装（ファイル出力 + コンソール）
- [ ] ログローテーション機能（日次、最大10MB/ファイル）
- [ ] エラーハンドリング（Fatal/Critical/Warning/Info分類）
- [ ] リトライポリシーの実装（OpenAI API、ファイル操作）
- [ ] オフラインモードの実装（ネット接続なしでも動作）
- [ ] クラッシュレポート機能（オプトイン）
- [ ] 動作確認（エラー発生時に適切に処理）

##### Issue #22: MVP完成と動作確認

**概要**: 全機能の統合テストと動作確認。Phase 1のMVP完成。

**依存**: #1〜#21

**ラベル**: testing, mvp

**受け入れ基準（AC）**:
- [ ] 全機能の統合テスト実施
- [ ] エンドツーエンドテスト（トラッキング開始からレポート表示まで）
- [ ] パフォーマンステスト（CPU使用率、メモリ使用量）
- [ ] エラーケースのテスト
- [ ] ドキュメントの整備（README、セットアップ手順）
- [ ] ビルド確認（npm run buildが成功）
- [ ] パッケージング確認（electron-builderでパッケージ作成）

### 要確認事項

- gpt-5-nano/gpt-5-miniのAPI仕様が確定しているか（現時点では将来モデル想定）
- OpenAI APIのレート制限（60req/min）の正確な値
- スクリーンショット取得の権限設定（macOS/Windows）
- マルチモニター対応の優先度（Phase 1では主モニターのみ）
- テスト環境の構築方法（E2Eテストツールの選定）

