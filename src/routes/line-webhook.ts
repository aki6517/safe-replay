/**
 * LINE Webhook エンドポイント
 */
import { Hono } from 'hono';
import { isLineClientAvailable, replyTextMessage } from '../services/line';
import { processForwardedMessage } from '../services/message-processor';
import { handleLineAction, handleEditModeMessage } from '../services/action-handler';
import { isUserAllowedSync } from '../utils/security';
import { getEditMode } from '../services/edit-mode';
import { getSupabase, isSupabaseAvailable } from '../db/client';
import { addVip, removeVip, listVips } from '../services/vip-list';
import { saveTemplate, listTemplates, deleteTemplate } from '../services/templates';
import type {
  LineWebhookRequest,
  LineWebhookEvent,
  MessageEvent,
  PostbackEvent
} from '../types/line-webhook';

export const lineWebhook = new Hono();

function decodeBase64(value: string): Uint8Array {
  if (typeof atob === 'function') {
    const decoded = atob(value);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i += 1) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  }

  const bufferCtor = (globalThis as { Buffer?: typeof Buffer }).Buffer;
  if (bufferCtor) {
    return new Uint8Array(bufferCtor.from(value, 'base64'));
  }

  throw new Error('No base64 decoder available');
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

// LINE署名検証
async function verifyLineSignature(body: string, signature: string): Promise<boolean> {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    return false;
  }

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(channelSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
    const expected = new Uint8Array(digest);
    const received = decodeBase64(signature);
    return timingSafeEqual(expected, received);
  } catch (error) {
    console.error('[LINE署名検証エラー]', error);
    return false;
  }
}

lineWebhook.post('/webhook', async (c) => {
  try {
    // LINEクライアントの確認
    if (!isLineClientAvailable()) {
      return c.json(
        {
          status: 'error',
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'LINE Messaging API credentials not configured'
          }
        },
        503
      );
    }

    // 署名検証
    const signature = c.req.header('X-Line-Signature');
    const body = await c.req.text();

    if (!signature || !(await verifyLineSignature(body, signature))) {
      return c.json(
        {
          status: 'error',
          error: {
            code: 'INVALID_SIGNATURE',
            message: 'LINE signature verification failed'
          }
        },
        401
      );
    }

    const webhookRequest: LineWebhookRequest = JSON.parse(body);
    const events: LineWebhookEvent[] = webhookRequest.events || [];

    for (const event of events) {
      const eventType = event.type;
      const userId = event.source?.userId;

      // リプレイ攻撃防止: 5分以上古いイベントはスキップ
      if (event.timestamp && Date.now() - event.timestamp > 5 * 60 * 1000) {
        console.warn(`[セキュリティ] 古いイベントをスキップ: ${Date.now() - event.timestamp}ms ago`);
        continue;
      }

      if (!userId) {
        continue;
      }

      // ホワイトリストチェック
      if (!isUserAllowedSync(userId)) {
        console.warn(`[セキュリティ] 許可されていないユーザーからのアクセス: ${userId}`);
        // 403 Forbiddenを返す（ただし、LINE Webhookの仕様上200を返す必要がある場合もある）
        // ここでは処理をスキップして続行（ログに記録）
        continue;
      }

      if (eventType === 'message') {
        const messageEvent = event as MessageEvent;
        const messageType = messageEvent.message?.type;

        if (messageType === 'text' && messageEvent.message.text) {
          const text = messageEvent.message.text;
          const replyToken = messageEvent.replyToken;

          // VIPコマンド処理（編集モードより優先）
          if (text.startsWith('テンプレ保存 ') || text === 'テンプレ一覧' || text.startsWith('テンプレ削除 ')) {
            try {
              // ユーザーのDB UUIDを取得
              let dbUserId: string | null = null;
              if (isSupabaseAvailable()) {
                const supabase = getSupabase();
                const { data: userRecord } = await (supabase.from('users') as any)
                  .select('id')
                  .eq('line_user_id', userId)
                  .single();
                dbUserId = userRecord?.id || null;
              }

              if (!dbUserId) {
                if (replyToken) {
                  await replyTextMessage(replyToken, 'ユーザー情報が見つかりませんでした。');
                }
              } else if (text.startsWith('テンプレ保存 ')) {
                const rest = text.slice('テンプレ保存 '.length);
                const spaceIdx = rest.indexOf(' ');
                if (spaceIdx === -1) {
                  if (replyToken) {
                    await replyTextMessage(replyToken, '使い方: テンプレ保存 名前 内容\n例: テンプレ保存 挨拶 お世話になっております。');
                  }
                } else {
                  const name = rest.slice(0, spaceIdx);
                  const content = rest.slice(spaceIdx + 1);
                  const result = await saveTemplate(dbUserId, name, content);
                  if (replyToken) {
                    await replyTextMessage(
                      replyToken,
                      result.success
                        ? `テンプレート「${name}」を保存しました。`
                        : `テンプレートの保存に失敗しました: ${result.error || '不明なエラー'}`
                    );
                  }
                }
              } else if (text === 'テンプレ一覧') {
                const templates = await listTemplates(dbUserId);
                let message: string;
                if (templates.length === 0) {
                  message = 'テンプレートはまだありません。\n\n「テンプレ保存 名前 内容」で登録できます。';
                } else {
                  const lines = templates.map((t, i) => `${i + 1}. ${t.name}`);
                  message = `テンプレート一覧（${templates.length}件）:\n${lines.join('\n')}`;
                }
                if (replyToken) {
                  await replyTextMessage(replyToken, message);
                }
              } else if (text.startsWith('テンプレ削除 ')) {
                const name = text.slice('テンプレ削除 '.length).trim();
                if (!name) {
                  if (replyToken) {
                    await replyTextMessage(replyToken, '使い方: テンプレ削除 名前\n例: テンプレ削除 挨拶');
                  }
                } else {
                  const ok = await deleteTemplate(dbUserId, name);
                  if (replyToken) {
                    await replyTextMessage(
                      replyToken,
                      ok
                        ? `テンプレート「${name}」を削除しました。`
                        : `テンプレート「${name}」の削除に失敗しました。`
                    );
                  }
                }
              }
            } catch (templateError: any) {
              console.error('[テンプレートコマンド] エラー:', templateError.message);
              if (messageEvent.replyToken) {
                await replyTextMessage(messageEvent.replyToken, 'テンプレートコマンドの処理中にエラーが発生しました。');
              }
            }
          } else if (text.startsWith('VIP追加') || text.startsWith('VIP削除') || text === 'VIP一覧') {
            try {
              // ユーザーのDB UUIDを取得
              let dbUserId: string | null = null;
              if (isSupabaseAvailable()) {
                const supabase = getSupabase();
                const { data: userRecord } = await (supabase.from('users') as any)
                  .select('id')
                  .eq('line_user_id', userId)
                  .single();
                dbUserId = userRecord?.id || null;
              }

              if (!dbUserId) {
                if (replyToken) {
                  await replyTextMessage(replyToken, 'ユーザー情報が見つかりませんでした。');
                }
              } else if (text.startsWith('VIP追加 ')) {
                const senderIdentifier = text.slice('VIP追加 '.length).trim();
                if (!senderIdentifier) {
                  if (replyToken) {
                    await replyTextMessage(replyToken, '使い方: VIP追加 メールアドレス\n例: VIP追加 boss@example.com');
                  }
                } else {
                  const ok = await addVip(dbUserId, senderIdentifier);
                  if (replyToken) {
                    await replyTextMessage(
                      replyToken,
                      ok
                        ? `VIPに追加しました: ${senderIdentifier}\nこの送信者からのメールは常に最優先（要返信）で通知されます。`
                        : `VIPへの追加に失敗しました: ${senderIdentifier}`
                    );
                  }
                }
              } else if (text.startsWith('VIP削除 ')) {
                const senderIdentifier = text.slice('VIP削除 '.length).trim();
                if (!senderIdentifier) {
                  if (replyToken) {
                    await replyTextMessage(replyToken, '使い方: VIP削除 メールアドレス\n例: VIP削除 boss@example.com');
                  }
                } else {
                  const ok = await removeVip(dbUserId, senderIdentifier);
                  if (replyToken) {
                    await replyTextMessage(
                      replyToken,
                      ok
                        ? `VIPから削除しました: ${senderIdentifier}`
                        : `VIPからの削除に失敗しました: ${senderIdentifier}`
                    );
                  }
                }
              } else if (text === 'VIP一覧') {
                const vips = await listVips(dbUserId);
                let message: string;
                if (vips.length === 0) {
                  message = 'VIPリストは空です。\n\n「VIP追加 メールアドレス」で登録できます。';
                } else {
                  const lines = vips.map((v, i) => {
                    const label = v.label ? ` (${v.label})` : '';
                    return `${i + 1}. ${v.sender_identifier}${label}`;
                  });
                  message = `VIPリスト（${vips.length}件）:\n${lines.join('\n')}`;
                }
                if (replyToken) {
                  await replyTextMessage(replyToken, message);
                }
              }
            } catch (vipError: any) {
              console.error('[VIPコマンド] エラー:', vipError.message);
              if (messageEvent.replyToken) {
                await replyTextMessage(messageEvent.replyToken, 'VIPコマンドの処理中にエラーが発生しました。');
              }
            }
          } else {
            // 編集モード中かチェック
            const editModeData = await getEditMode(userId);
            if (editModeData) {
              // 編集モード中：修正指示として処理
              await handleEditModeMessage(userId, text, editModeData);
            } else {
              // 通常モード：転送メッセージ処理
              await processForwardedMessage(userId, text);
            }
          }
        } else if (messageType === 'file') {
          // ファイル受信処理（将来実装）
          console.log('File message received:', messageEvent.message);
        }
      } else if (eventType === 'postback') {
        // アクションボタン処理
        const postbackEvent = event as PostbackEvent;
        const data = postbackEvent.postback?.data || '';
        await handleLineAction(userId, data);
      } else if (eventType === 'follow') {
        // ユーザー登録とウェルカムメッセージ
        console.log('User followed:', userId);

        // DBにユーザーを自動登録（既存なら再アクティブ化）
        try {
          if (isSupabaseAvailable()) {
            const supabase = getSupabase();
            // 既存ユーザーを確認
            const { data: existing } = await (supabase.from('users') as any)
              .select('id, status')
              .eq('line_user_id', userId)
              .single();

            if (existing) {
              // 既存ユーザー → 再フォロー時はpendingに戻す（削除済みの場合）
              if (existing.status === 'deleted' || existing.status === 'suspended') {
                await (supabase.from('users') as any)
                  .update({ status: 'pending', updated_at: new Date().toISOString() })
                  .eq('id', existing.id);
                console.log(`User reactivated: ${userId} → pending`);
              }
            } else {
              // 新規ユーザー作成（pending状態）
              const { error: insertError } = await (supabase.from('users') as any)
                .insert({
                  line_user_id: userId,
                  status: 'pending',
                  is_active: true
                });
              if (insertError) {
                console.error('Failed to create user:', insertError);
              } else {
                console.log(`New user created: ${userId} (pending)`);
              }
            }
          }
        } catch (dbError) {
          console.error('DB error during user registration:', dbError);
        }

        // ウェルカムメッセージ + LIFF設定画面への誘導
        const liffId = process.env.LIFF_ID || '';
        const liffUrl = liffId ? `\n\n初期設定はこちら：\nhttps://liff.line.me/${liffId}` : '';
        const welcomeMessage = `SafeReplyへようこそ！\n\nメッセージを転送すると、AIが自動で返信ドラフトを作成します。${liffUrl}`;

        if (event.replyToken) {
          await replyTextMessage(event.replyToken, welcomeMessage);
        } else {
          const { sendTextMessage } = await import('../services/line');
          await sendTextMessage(userId, welcomeMessage);
        }
      } else if (eventType === 'unfollow') {
        // ユーザー無効化
        console.log('User unfollowed:', userId);
        try {
          if (isSupabaseAvailable()) {
            const supabase = getSupabase();
            await (supabase.from('users') as any)
              .update({ status: 'deleted', updated_at: new Date().toISOString() })
              .eq('line_user_id', userId);
            console.log(`User deactivated: ${userId} → deleted`);
          }
        } catch (dbError) {
          console.error('DB error during user deactivation:', dbError);
        }
      }
    }

    return c.json({
      status: 'ok',
      processed: events.length
    });
  } catch (error) {
    console.error('LINE Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json(
      {
        status: 'error',
        error: {
          code: 'INTERNAL_ERROR',
          message: errorMessage
        }
      },
      500
    );
  }
});
