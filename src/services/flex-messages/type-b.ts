/**
 * Type B用Flex Messageテンプレート
 * 
 * 共有・CCメッセージ用のFlex Message
 * - [既読][確認メール]ボタンを提供
 * - 静音通知設定に対応
 */
import type { FlexMessage, FlexBubble, FlexBox, FlexText, FlexSeparator, FlexButton } from '@line/bot-sdk';

export interface TypeBFlexMessageData {
  messageId: string;
  subject?: string;
  body: string;
  sender: string;
  source: string;
}

/**
 * Type B用Flex Messageを生成
 * 
 * @param data - Flex Messageに表示するデータ
 * @returns Flex Messageオブジェクト
 */
export function createTypeBFlexMessage(data: TypeBFlexMessageData): FlexMessage {
  const { messageId, subject, body, sender, source } = data;

  // 本文を200文字に制限（プレビュー用）
  const bodyPreview = body.length > 200 ? `${body.substring(0, 200)}...` : body;

  // ヘッダーコンテンツ
  const headerContents: FlexText[] = [
    {
      type: 'text',
      text: '【メッセージ受信】',
      weight: 'bold',
      size: 'xl',
      color: '#FFFFFF'
    },
    {
      type: 'text',
      text: '共有・CCメッセージが届きました',
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

  // メッセージ内容
  bodyContents.push(
    {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: 'メッセージ内容',
          size: 'xs',
          color: '#888888',
          margin: 'md'
        } as FlexText,
        {
          type: 'text',
          text: bodyPreview,
          size: 'sm',
          wrap: true
        } as FlexText
      ],
      margin: 'md'
    }
  );

  // フッターコンテンツ（ボタン）
  const footerContents: FlexButton[] = [
    {
      type: 'button',
      action: {
        type: 'postback',
        label: '既読',
        data: `action=read&message_id=${messageId}`,
        displayText: '既読にしました'
      },
      style: 'primary',
      color: '#4CAF50'
    },
    {
      type: 'button',
      action: {
        type: 'postback',
        label: '確認メール',
        data: `action=acknowledge&message_id=${messageId}`,
        displayText: '確認メールを送信します'
      },
      style: 'secondary',
      color: '#2196F3'
    }
  ];

  const bubble: FlexBubble = {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: headerContents,
      backgroundColor: '#4CAF50', // 緑色（Type Aの赤とは異なる）
      paddingAll: 'lg'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: bodyContents
    },
    footer: {
      type: 'box',
      layout: 'horizontal',
      contents: footerContents,
      spacing: 'sm',
      paddingAll: 'lg'
    }
  };

  return {
    type: 'flex',
    altText: '【メッセージ受信】共有・CCメッセージが届きました',
    contents: bubble
  };
}
