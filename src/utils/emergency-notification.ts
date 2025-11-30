/**
 * 緊急通知ユーティリティ
 * 
 * システム異常時にユーザーへ緊急LINE通知を送信する機能
 * - APIトークン失効検知時の通知
 * - システム停止検知時の通知
 */
import { sendFlexMessage, sendTextMessage, isLineClientAvailable } from '../services/line';
import { createEmergencyFlexMessage } from '../services/flex-messages/emergency';
import { getAllowedUserIds } from './security';

/**
 * 通知の重複送信を防ぐためのキャッシュ
 * 同じエラーが短時間で複数回発生した場合、最初の1回のみ通知を送信
 */
const notificationCache = new Map<string, number>();
const NOTIFICATION_COOLDOWN_MS = 60 * 60 * 1000; // 1時間

/**
 * 通知を送信すべきかチェック（重複防止）
 * 
 * @param key - 通知のキー（例: 'gmail_token_expired'）
 * @returns 送信すべき場合はtrue、スキップすべき場合はfalse
 */
function shouldSendNotification(key: string): boolean {
  const lastSent = notificationCache.get(key);
  const now = Date.now();

  if (lastSent && (now - lastSent) < NOTIFICATION_COOLDOWN_MS) {
    return false; // クールダウン期間内のためスキップ
  }

  notificationCache.set(key, now);
  return true;
}

/**
 * 緊急通知の重要度
 */
export type EmergencySeverity = 'critical' | 'warning' | 'info';

/**
 * 緊急通知を送信
 * 
 * @param title - 通知タイトル
 * @param message - 通知メッセージ
 * @param options - オプション
 * @returns 成功時true、失敗時false
 */
export async function sendEmergencyNotification(
  title: string,
  message: string,
  options?: {
    severity?: EmergencySeverity;
    details?: string;
    timestamp?: string;
    actionUrl?: string;
    userIds?: string[]; // 指定がない場合は全許可ユーザーに送信
  }
): Promise<boolean> {
  const severity = options?.severity || 'critical';
  const details = options?.details;
  const timestamp = options?.timestamp || new Date().toISOString();
  const actionUrl = options?.actionUrl;

  // LINEクライアントが利用可能かチェック
  if (!isLineClientAvailable()) {
    console.error('[緊急通知] LINE Messaging API credentials not configured');
    return false;
  }

  // 送信先ユーザーIDを決定
  const targetUserIds = options?.userIds || getAllowedUserIds();
  
  if (targetUserIds.length === 0) {
    console.warn('[緊急通知] 送信先ユーザーIDが設定されていません');
    return false;
  }

  // Flex Messageを生成
  const flexMessage = createEmergencyFlexMessage({
    title,
    message,
    details,
    severity,
    timestamp,
    actionUrl
  });

  // デバッグ用: Flex MessageのJSONを出力（開発環境のみ）
  if (process.env.NODE_ENV !== 'production') {
    console.log('[緊急通知 Flex Message JSON]', JSON.stringify(flexMessage, null, 2));
  }

  // 全ユーザーに送信
  let successCount = 0;
  let failureCount = 0;

  for (const userId of targetUserIds) {
    try {
      // 緊急通知は常に通知音を有効化（重要度が高いため）
      const success = await sendFlexMessage(userId, flexMessage, {
        notificationDisabled: false
      });

      if (success) {
        successCount++;
        console.log('[緊急通知送信成功]', {
          userId,
          title,
          severity
        });
      } else {
        failureCount++;
        console.error('[緊急通知送信失敗]', {
          userId,
          title,
          severity
        });
      }
    } catch (error: any) {
      failureCount++;
      console.error('[緊急通知送信エラー]', {
        userId,
        title,
        severity,
        error: error.message
      });
    }
  }

  // 結果をログに記録
  console.log('[緊急通知送信完了]', {
    title,
    severity,
    totalUsers: targetUserIds.length,
    successCount,
    failureCount
  });

  // 1人以上に送信できれば成功とする
  return successCount > 0;
}

/**
 * APIトークン失効検知時の緊急通知を送信
 * 
 * @param serviceName - サービス名（例: 'Gmail', 'Chatwork', 'OpenAI'）
 * @param errorMessage - エラーメッセージ
 * @returns 成功時true、失敗時false
 */
export async function notifyApiTokenExpired(
  serviceName: string,
  errorMessage: string
): Promise<boolean> {
  const notificationKey = `${serviceName.toLowerCase()}_token_expired`;

  // 重複通知を防ぐ
  if (!shouldSendNotification(notificationKey)) {
    console.log(`[緊急通知] ${serviceName} APIトークン失効通知をスキップ（クールダウン期間内）`);
    return false;
  }

  const title = `${serviceName} APIトークン失効`;
  const message = `${serviceName}のAPIトークンが失効または無効です。`;
  const details = `エラー詳細: ${errorMessage}\n\n設定を確認し、新しいトークンを設定してください。`;

  return await sendEmergencyNotification(title, message, {
    severity: 'critical',
    details,
    timestamp: new Date().toISOString()
  });
}

/**
 * システム停止検知時の緊急通知を送信
 * 
 * @param reason - 停止理由
 * @param details - 詳細情報
 * @returns 成功時true、失敗時false
 */
export async function notifySystemDown(
  reason: string,
  details?: string
): Promise<boolean> {
  const title = 'システム停止検知';
  const message = `システムが停止または異常な状態を検知しました。\n\n理由: ${reason}`;

  return await sendEmergencyNotification(title, message, {
    severity: 'critical',
    details,
    timestamp: new Date().toISOString()
  });
}

/**
 * データベース接続エラー検知時の緊急通知を送信
 * 
 * @param errorMessage - エラーメッセージ
 * @returns 成功時true、失敗時false
 */
export async function notifyDatabaseError(
  errorMessage: string
): Promise<boolean> {
  const title = 'データベース接続エラー';
  const message = 'データベースへの接続に失敗しました。';
  const details = `エラー詳細: ${errorMessage}\n\nデータベースの状態を確認してください。`;

  return await sendEmergencyNotification(title, message, {
    severity: 'critical',
    details,
    timestamp: new Date().toISOString()
  });
}

/**
 * 警告レベルの通知を送信（システム停止ではないが注意が必要な状態）
 * 
 * @param title - 通知タイトル
 * @param message - 通知メッセージ
 * @param details - 詳細情報
 * @returns 成功時true、失敗時false
 */
export async function sendWarningNotification(
  title: string,
  message: string,
  details?: string
): Promise<boolean> {
  return await sendEmergencyNotification(title, message, {
    severity: 'warning',
    details,
    timestamp: new Date().toISOString()
  });
}

