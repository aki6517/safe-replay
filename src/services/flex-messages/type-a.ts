/**
 * Type A用Flex Messageテンプレート
 * 
 * 返信が必要な重要メッセージ用のFlex Message
 * - 返信案プレビューを表示
 * - [送信][修正][断る]ボタンを提供
 */
import type {
  FlexMessage,
  FlexBubble,
  FlexBox,
  FlexText,
  FlexSeparator,
  FlexButton
} from '../../types/line-messaging';

export interface TypeAFlexMessageData {
  messageId: string;
  subject?: string;
  body: string;
  sender: string;
  source: string;
  draft: string;
}

/**
 * Type A用Flex Messageを生成
 * 
 * @param data - Flex Messageに表示するデータ
 * @returns Flex Messageオブジェクト
 */
export function createTypeAFlexMessage(data: TypeAFlexMessageData): FlexMessage {
  const { messageId, subject, body, sender, source, draft } = data;

  // 本文を400文字に制限（語りかけ形式なので少し長めに）
  const bodyPreview = body.length > 400 ? `${body.substring(0, 400)}...` : body;
  
  // 返信案を300文字に制限（プレビュー用）
  const draftPreview = draft.length > 300 ? `${draft.substring(0, 300)}...` : draft;

  // ヘッダーコンテンツ
  const headerContents: FlexText[] = [
    {
      type: 'text',
      text: '【要返信】',
      weight: 'bold',
      size: 'xl',
      color: '#FFFFFF'
    },
    {
      type: 'text',
      text: '返信が必要なメッセージが届きました',
      size: 'sm',
      color: '#FFFFFF',
      margin: 'md'
    }
  ];

  // ボディコンテンツ
  const bodyContents: (FlexBox | FlexSeparator)[] = [
    // 送信元情報
    {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '送信元',
          size: 'xs',
          color: '#888888',
          margin: 'md'
        } as FlexText,
        {
          type: 'text',
          text: `${sender} (${source})`,
          size: 'sm',
          weight: 'bold',
          wrap: true
        } as FlexText
      ],
      margin: 'md'
    }
  ];

  // 件名（存在する場合）
  if (subject) {
    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '件名',
          size: 'xs',
          color: '#888888',
          margin: 'md'
        } as FlexText,
        {
          type: 'text',
          text: subject,
          size: 'sm',
          wrap: true
        } as FlexText
      ],
      margin: 'md'
    });
  }

  // メッセージ内容（語りかけ形式）
  bodyContents.push(
    {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: bodyPreview,
          size: 'sm',
          wrap: true
        } as FlexText
      ],
      margin: 'md'
    },
    // 区切り線
    {
      type: 'separator',
      margin: 'lg'
    },
    // 返信案プレビュー
    {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '返信案',
          size: 'xs',
          color: '#888888',
          margin: 'md'
        } as FlexText,
        {
          type: 'text',
          text: draftPreview,
          size: 'sm',
          wrap: true,
          color: '#0066CC'
        } as FlexText
      ],
      margin: 'md',
      backgroundColor: '#F0F8FF',
      paddingAll: 'sm',
      cornerRadius: 'md'
    }
  );

  // フッターコンテンツ
  // ボタン配置:
  // 1段目: 受信文確認 / 返信文確認
  // 2段目: 返信文修正 / 返信
  // 3段目: ブロック
  const footerContents: (FlexBox | FlexButton)[] = [
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'button',
          action: {
            type: 'postback',
            label: '受信文確認',
            data: `action=view_received&message_id=${messageId}`,
            displayText: '受信文を確認します'
          },
          style: 'secondary',
          color: '#607D8B'
        } as FlexButton,
        {
          type: 'button',
          action: {
            type: 'postback',
            label: '返信文確認',
            data: `action=view_draft&message_id=${messageId}`,
            displayText: '返信文を確認します'
          },
          style: 'secondary',
          color: '#2196F3'
        } as FlexButton
      ],
      spacing: 'sm'
    },
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'button',
          action: {
            type: 'postback',
            label: '返信文修正',
            data: `action=edit&message_id=${messageId}`,
            displayText: '返信を修正します'
          },
          style: 'secondary',
          color: '#888888'
        } as FlexButton,
        {
          type: 'button',
          action: {
            type: 'postback',
            label: '返信',
            data: `action=send&message_id=${messageId}`,
            displayText: '返信を送信します'
          },
          style: 'primary',
          color: '#0066CC'
        } as FlexButton,
      ],
      spacing: 'sm',
      margin: 'sm'
    },
    {
      type: 'button',
      action: {
        type: 'postback',
        label: '⏰後で対応',
        data: `action=snooze&message_id=${messageId}&duration=120`,
        displayText: '2時間後にリマインドします'
      },
      style: 'secondary',
      color: '#888888',
      margin: 'sm'
    },
    {
      type: 'button',
      action: {
        type: 'postback',
        label: '🚫ブロック',
        data: `action=block&message_id=${messageId}`,
        displayText: 'この送信者をブロックします'
      },
      style: 'secondary',
      color: '#888888',
      margin: 'sm'
    }
  ];

  const bubble: FlexBubble = {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: headerContents,
      backgroundColor: '#FF6B6B',
      paddingAll: 'lg'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: bodyContents
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: footerContents,
      spacing: 'sm',
      paddingAll: 'lg'
    }
  };

  return {
    type: 'flex',
    altText: '【要返信】返信が必要なメッセージが届きました',
    contents: bubble
  };
}
