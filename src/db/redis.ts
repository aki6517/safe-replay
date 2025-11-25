/**
 * Upstash Redis クライアント設定
 */
import { Redis } from '@upstash/redis';

const redisUrl = process.env.UPSTASH_REDIS_URL;
const redisToken = process.env.UPSTASH_REDIS_TOKEN;

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
  return redis !== null;
}

// クライアントを取得（利用可能でない場合はエラー）
export function getRedis(): Redis {
  if (!redis) {
    throw new Error('Upstash Redis環境変数が設定されていません');
  }
  return redis;
}

