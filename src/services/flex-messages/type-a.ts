/**
 * Type A用Flex Messageテンプレート
 * 
 * 返信が必要な重要メッセージ用のFlex Message
 * - 返信案プレビューを表示
 * - [送信][修正][断る]ボタンを提供
 */
import type { FlexMessage, FlexBubble, FlexBox, FlexText, FlexSeparator, FlexButton } from '@line/bot-sdk';

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

  // 本文を200文字に制限（プレビュー用）
  const bodyPreview = body.length > 200 ? `${body.substring(0, 200)}...` : body;
  
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
  const footerContents: (FlexBox | FlexButton)[] = [
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'button',
          action: {
            type: 'postback',
            label: '送信',
            data: `action=send&message_id=${messageId}`,
            displayText: '返信を送信します'
          },
          style: 'primary',
          color: '#0066CC'
        } as FlexButton,
        {
          type: 'button',
          action: {
            type: 'postback',
            label: '修正',
            data: `action=edit&message_id=${messageId}`,
            displayText: '返信を修正します'
          },
          style: 'secondary',
          color: '#888888'
        } as FlexButton
      ],
      spacing: 'sm'
    },
    {
      type: 'button',
      action: {
        type: 'postback',
        label: '断る',
        data: `action=dismiss&message_id=${messageId}`,
        displayText: '返信を断ります'
      },
      style: 'secondary',
      color: '#FF6B6B',
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

