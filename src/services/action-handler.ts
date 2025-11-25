/**
 * LINEアクションハンドラー
 */
export async function handleLineAction(
  userId: string,
  actionData: string
): Promise<void> {
  // アクションデータをパース
  const params = new URLSearchParams(actionData);
  const action = params.get('action');
  const messageId = params.get('message_id');

  console.log('Handling action:', { userId, action, messageId });

  // TODO: 実装
}

