/**
 * LINE Messaging API 型定義（最小セット）
 * @line/bot-sdk 依存を避けるためのローカル型。
 */
export interface TextMessage {
  type: 'text';
  text: string;
}

export interface FlexSeparator {
  type: 'separator';
  margin?: string;
}

export interface FlexText {
  type: 'text';
  text: string;
  size?: string;
  color?: string;
  margin?: string;
  weight?: string;
  wrap?: boolean;
  [key: string]: unknown;
}

export interface FlexButtonAction {
  type: 'postback' | 'uri' | 'message' | string;
  label: string;
  data?: string;
  uri?: string;
  text?: string;
  displayText?: string;
  [key: string]: unknown;
}

export interface FlexButton {
  type: 'button';
  action: FlexButtonAction;
  style?: 'primary' | 'secondary' | 'link' | string;
  color?: string;
  margin?: string;
  height?: string;
  flex?: number;
  [key: string]: unknown;
}

export interface FlexBox {
  type: 'box';
  layout: 'vertical' | 'horizontal' | 'baseline' | string;
  contents: FlexComponent[];
  spacing?: string;
  margin?: string;
  backgroundColor?: string;
  paddingAll?: string;
  cornerRadius?: string;
  [key: string]: unknown;
}

export interface FlexBubble {
  type: 'bubble';
  size?: string;
  header?: FlexBox;
  body?: FlexBox;
  footer?: FlexBox;
  [key: string]: unknown;
}

export type FlexComponent = FlexBox | FlexText | FlexSeparator | FlexButton;

export interface FlexMessage {
  type: 'flex';
  altText: string;
  contents: FlexBubble | Record<string, unknown>;
}

export type LineMessage = TextMessage | FlexMessage;
