/**
 * Upstash Redis クライアント設定
 */
import { Redis } from '@upstash/redis';

const redisUrl = process.env.UPSTASH_REDIS_URL;
const redisToken = process.env.UPSTASH_REDIS_TOKEN;
let redisDisabledReason: string | null = null;

/**
 * Redis環境変数の検証
 * @throws {Error} 必須環境変数が設定されていない場合
 */
export function validateRedisEnv(): void {
  const required = ['UPSTASH_REDIS_URL', 'UPSTASH_REDIS_TOKEN'];
  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Upstash Redis環境変数が不足しています: ${missing.join(', ')}`
    );
  }
}

// 開発環境では環境変数が設定されていない場合でもエラーを投げない
let redis: Redis | null = null;

if (redisUrl && redisToken) {
  redis = new Redis({
    url: redisUrl,
    token: redisToken
  });
} else {
  console.warn('⚠️  Upstash Redis環境変数が設定されていません');
}

export { redis };

// クライアントが利用可能かチェックする関数
export function isRedisAvailable(): boolean {
  return redis !== null && redisDisabledReason === null;
}

// クライアントを取得（利用可能でない場合はエラー）
export function getRedis(): Redis {
  if (!redis || redisDisabledReason) {
    if (redisDisabledReason) {
      throw new Error(`Upstash Redisは現在無効化されています: ${redisDisabledReason}`);
    }
    throw new Error('Upstash Redis環境変数が設定されていません');
  }
  return redis;
}

// ランタイムでRedis障害を検知した場合に無効化する
export function markRedisUnavailable(error?: unknown): void {
  const reason =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Unknown Redis error';

  // 既に無効化済みの場合は上書きしない
  if (redisDisabledReason) {
    return;
  }

  redisDisabledReason = reason;
  redis = null;
  console.warn(`[Redis] 接続エラーのためRedisを無効化しました: ${reason}`);
}
