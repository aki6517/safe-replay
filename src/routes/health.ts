/**
 * ヘルスチェックAPI
 */
import { Hono } from 'hono';
import { supabase, isSupabaseAvailable } from '../db/client';
import { redis, isRedisAvailable } from '../db/redis';

export const healthRoutes = new Hono();

// Service Key認証ミドルウェア
async function verifyServiceKey(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  const serviceKey = process.env.SERVICE_KEY;

  if (!serviceKey) {
    return c.json(
      {
        status: 'error',
        error: {
          code: 'SERVICE_KEY_NOT_CONFIGURED',
          message: 'Service key not configured'
        }
      },
      500
    );
  }

  if (authHeader !== `Bearer ${serviceKey}`) {
    return c.json(
      {
        status: 'error',
        error: {
          code: 'UNAUTHORIZED',
          message: 'Unauthorized'
        }
      },
      401
    );
  }

  await next();
}

// シンプルなヘルスチェック
healthRoutes.get('/', async (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// 詳細ヘルスチェック（Service Key認証必須）
healthRoutes.get('/deep', verifyServiceKey, async (c) => {
  const components: Record<string, any> = {};

  // データベースチェック
  if (isSupabaseAvailable() && supabase) {
    try {
      const dbStart = Date.now();
      const { error } = await supabase.from('users').select('id').limit(1);
      components.database = {
        status: error ? 'unhealthy' : 'healthy',
        latency_ms: Date.now() - dbStart,
        error: error?.message
      };
    } catch (error: any) {
      components.database = {
        status: 'unhealthy',
        error: error.message
      };
    }
  } else {
    components.database = {
      status: 'unknown',
      message: 'Supabase not configured'
    };
  }

  // Redisチェック
  if (isRedisAvailable() && redis) {
    try {
      const redisStart = Date.now();
      await redis.ping();
      components.redis = {
        status: 'healthy',
        latency_ms: Date.now() - redisStart
      };
    } catch (error: any) {
      components.redis = {
        status: 'unhealthy',
        error: error.message
      };
    }
  } else {
    components.redis = {
      status: 'unknown',
      message: 'Redis not configured'
    };
  }

  // 外部サービスチェック（簡易版）
  components.external_services = {
    gmail_api: {
      status: 'unknown',
      message: 'Check via polling endpoint'
    },
    chatwork_api: {
      status: 'unknown',
      message: 'Check via polling endpoint'
    },
    line_api: {
      status: 'unknown',
      message: 'Check via webhook endpoint'
    },
    openai_api: {
      status: 'unknown',
      message: 'Check via AI service'
    }
  };

  const overallStatus =
    (components.database?.status === 'healthy' || components.database?.status === 'unknown') &&
    (components.redis?.status === 'healthy' || components.redis?.status === 'unknown')
      ? 'healthy'
      : 'unhealthy';

  return c.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    components,
    version: '1.0.0',
    uptime_seconds: Math.floor(process.uptime())
  });
});

