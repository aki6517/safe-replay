/**
 * 緊急通知用Flex Messageテンプレート
 * 
 * システム異常時の緊急通知用Flex Message
 * - APIトークン失効検知時
 * - システム停止検知時
 * - その他の緊急事態
 */
import type { FlexMessage, FlexBubble, FlexBox, FlexText, FlexButton } from '@line/bot-sdk';

export interface EmergencyFlexMessageData {
  title: string;
  message: string;
  details?: string;
  severity: 'critical' | 'warning' | 'info';
  timestamp?: string;
  actionUrl?: string; // 詳細確認用URL（オプション）
}

/**
 * 緊急通知用Flex Messageを生成
 * 
 * @param data - Flex Messageに表示するデータ
 * @returns Flex Messageオブジェクト
 */
export function createEmergencyFlexMessage(data: EmergencyFlexMessageData): FlexMessage {
  const { title, message, details, severity, timestamp, actionUrl } = data;

  // 重要度に応じた色を設定
  const severityColors = {
    critical: '#FF0000', // 赤色（緊急）
    warning: '#FF9800',  // オレンジ色（警告）
    info: '#2196F3'      // 青色（情報）
  };

  const severityLabels = {
    critical: '【緊急】',
    warning: '【警告】',
    info: '【お知らせ】'
  };

  const backgroundColor = severityColors[severity];
  const severityLabel = severityLabels[severity];

  // ヘッダーコンテンツ
  const headerContents: FlexText[] = [
    {
      type: 'text',
      text: severityLabel,
      weight: 'bold',
      size: 'xl',
      color: '#FFFFFF'
    },
    {
      type: 'text',
      text: title,
      size: 'sm',
      color: '#FFFFFF',
      margin: 'md',
      wrap: true
    }
  ];

  // タイムスタンプがある場合は追加
  if (timestamp) {
    headerContents.push({
      type: 'text',
      text: `発生時刻: ${timestamp}`,
      size: 'xs',
      color: '#FFFFFF',
      margin: 'sm'
    });
  }

  // ボディコンテンツ
  const bodyContents: (FlexBox | FlexText)[] = [
    {
      type: 'text',
      text: message,
      size: 'md',
      wrap: true,
      margin: 'lg'
    } as FlexText
  ];

  // 詳細情報がある場合は追加
  if (details) {
    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '詳細情報',
          size: 'xs',
          color: '#888888',
          margin: 'md'
        } as FlexText,
        {
          type: 'text',
          text: details,
          size: 'sm',
          wrap: true,
          color: '#333333'
        } as FlexText
      ],
      backgroundColor: '#F5F5F5',
      cornerRadius: 'md',
      margin: 'md'
    });
  }

  // フッターコンテンツ（ボタン）
  const footerContents: FlexButton[] = [];

  // 詳細確認URLがある場合はボタンを追加
  if (actionUrl) {
    footerContents.push({
      type: 'button',
      action: {
        type: 'uri',
        label: '詳細を確認',
        uri: actionUrl
      },
      style: 'primary',
      color: backgroundColor
    });
  }

  // 確認ボタン（常に表示）
  footerContents.push({
    type: 'button',
    action: {
      type: 'postback',
      label: '確認済み',
      data: `action=acknowledge_emergency&severity=${severity}&timestamp=${timestamp || Date.now()}`,
      displayText: '確認しました'
    },
    style: 'secondary',
    color: '#888888'
  });

  const bubble: FlexBubble = {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: headerContents,
      backgroundColor: backgroundColor,
      paddingAll: 'lg'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: bodyContents,
      paddingAll: 'lg'
    },
    footer: footerContents.length > 0 ? {
      type: 'box',
      layout: 'horizontal',
      contents: footerContents,
      spacing: 'sm',
      paddingAll: 'lg'
    } : undefined
  };

  return {
    type: 'flex',
    altText: `${severityLabel} ${title}`,
    contents: bubble
  };
}

