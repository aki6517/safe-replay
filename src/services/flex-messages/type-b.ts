/**
 * Type B用Flex Messageテンプレート
 * 
 * 共有・CCメッセージ用のFlex Message
 * - [既読][確認メール]ボタンを提供
 * - 静音通知設定に対応
 */
import type {
  FlexMessage,
  FlexBubble,
  FlexBox,
  FlexText,
  FlexSeparator,
  FlexButton
} from '../../types/line-messaging';


export interface TypeBFlexMessageData {
  messageId: string;
  subject?: string;
  body: string;
  sender: string;
  source: string;
  draft?: string; // 返信案（オプション）
  variant?: 'type-b' | 'type-c';
  supportsAcknowledge?: boolean;
}

/**
 * Type B用Flex Messageを生成
 * 
 * @param data - Flex Messageに表示するデータ
 * @returns Flex Messageオブジェクト
 */
export function createTypeBFlexMessage(data: TypeBFlexMessageData): FlexMessage {
  const {
    messageId,
    subject,
    body,
    sender,
    source,
    draft,
    variant = 'type-b',
    supportsAcknowledge = false
  } = data;

  // 本文を300文字に制限
  const bodyPreview = body.length > 300 ? `${body.substring(0, 300)}...` : body;
  
  // 返信案を200文字に制限（プレビュー用）
  const draftPreview = draft ? (draft.length > 200 ? `${draft.substring(0, 200)}...` : draft) : null;
  const headerTitle = variant === 'type-c' ? '【参考通知】' : '【メッセージ受信】';
  const headerSubtitle = variant === 'type-c'
    ? '返信不要メッセージが届きました'
    : '共有・CCメッセージが届きました';
  const headerColor = variant === 'type-c' ? '#607D8B' : '#4CAF50';
  const altText = variant === 'type-c'
    ? '【参考通知】返信不要メッセージが届きました'
    : '【メッセージ受信】共有・CCメッセージが届きました';

  // ヘッダーコンテンツ
  const headerContents: FlexText[] = [
    {
      type: 'text',
      text: headerTitle,
      weight: 'bold',
      size: 'xl',
      color: '#FFFFFF'
    },
    {
      type: 'text',
      text: headerSubtitle,
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
    }
  );

  // 返信案がある場合は表示
  if (draftPreview) {
    bodyContents.push(
      {
        type: 'separator',
        margin: 'lg'
      },
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
  }

  // フッターコンテンツ（ボタン）
  // 返信案がある場合:
  // 1段目: 受信文確認 / 返信文確認
  // 2段目: 返信文修正 / 返信
  // 3段目: ブロック
  // 返信案がない場合:
  // Gmail: 既読 / 確認メール
  // その他: 受信文確認 / 既読
  const footerContents: (FlexBox | FlexButton)[] = [];
  
  if (draftPreview) {
    // 返信案がある場合
    footerContents.push(
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
          } as FlexButton
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
    );
  } else {
    // 返信案がない場合
    footerContents.push({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'button',
          action: {
            type: 'postback',
            label: supportsAcknowledge ? '既読' : '受信文確認',
            data: supportsAcknowledge
              ? `action=read&message_id=${messageId}`
              : `action=view_received&message_id=${messageId}`,
            displayText: supportsAcknowledge
              ? '既読にしました'
              : '受信文を確認します'
          },
          style: 'secondary',
          color: '#607D8B'
        } as FlexButton,
        {
          type: 'button',
          action: {
            type: 'postback',
            label: supportsAcknowledge ? '確認メール' : '既読',
            data: supportsAcknowledge
              ? `action=acknowledge&message_id=${messageId}`
              : `action=read&message_id=${messageId}`,
            displayText: supportsAcknowledge
              ? '確認メールを送信します'
              : '既読にしました'
          },
          style: supportsAcknowledge ? 'secondary' : 'primary',
          color: supportsAcknowledge ? '#2196F3' : '#4CAF50'
        } as FlexButton
      ],
      spacing: 'sm'
    });
    footerContents.push(
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
    );
  }

  const bubble: FlexBubble = {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: headerContents,
      backgroundColor: headerColor,
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
    altText,
    contents: bubble
  };
}
