/**
 * Chatworkポーリングサービス
 */
export async function pollChatwork(
  userId?: string
): Promise<{
  summary: {
    users_processed: number;
    rooms_checked: number;
    messages_fetched: number;
    messages_new: number;
    self_messages_skipped: number;
    errors: string[];
  };
  processingTimeMs: number;
}> {
  const startTime = Date.now();

  // TODO: Chatwork API実装
  console.log('Polling Chatwork:', { userId });

  return {
    summary: {
      users_processed: 0,
      rooms_checked: 0,
      messages_fetched: 0,
      messages_new: 0,
      self_messages_skipped: 0,
      errors: []
    },
    processingTimeMs: Date.now() - startTime
  };
}

