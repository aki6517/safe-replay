/**
 * Gmailポーリングサービス
 */
// TODO: 実装時にインポートを有効化
// import { redis, isRedisAvailable } from '../../db/redis';

export async function pollGmail(
  userId?: string,
  maxResults: number = 50
): Promise<{
  summary: {
    users_processed: number;
    messages_fetched: number;
    messages_new: number;
    messages_skipped: number;
    attachments_parsed: number;
    errors: string[];
  };
  details: any[];
  processingTimeMs: number;
}> {
  const startTime = Date.now();

  // TODO: Gmail API実装
  console.log('Polling Gmail:', { userId, maxResults });

  return {
    summary: {
      users_processed: 0,
      messages_fetched: 0,
      messages_new: 0,
      messages_skipped: 0,
      attachments_parsed: 0,
      errors: []
    },
    details: [],
    processingTimeMs: Date.now() - startTime
  };
}

