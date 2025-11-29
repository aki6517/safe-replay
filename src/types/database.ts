/**
 * Supabase データベース型定義
 * 設計書に基づく型定義
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          line_user_id: string;
          display_name: string | null;
          email: string | null;
          is_active: boolean;
          last_active_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          line_user_id: string;
          display_name?: string | null;
          email?: string | null;
          is_active?: boolean;
          last_active_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          line_user_id?: string;
          display_name?: string | null;
          email?: string | null;
          is_active?: boolean;
          last_active_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          user_id: string;
          source_type: 'gmail' | 'chatwork' | 'line_forward';
          source_message_id: string;
          thread_id: string | null;
          sender_identifier: string;
          sender_name: string | null;
          subject: string | null;
          body_plain: string | null;
          body_html: string | null;
          extracted_content: string | null;
          triage_type: 'A' | 'B' | 'C' | null;
          triage_reason: string | null;
          status: 'pending' | 'notified' | 'sent' | 'dismissed' | 'read' | 'snoozed';
          priority_score: number | null;
          ai_analysis: Json | null;
          metadata: Json;
          received_at: string;
          notified_at: string | null;
          actioned_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_type: 'gmail' | 'chatwork' | 'line_forward';
          source_message_id: string;
          thread_id?: string | null;
          sender_identifier: string;
          sender_name?: string | null;
          subject?: string | null;
          body_plain?: string | null;
          body_html?: string | null;
          extracted_content?: string | null;
          triage_type?: 'A' | 'B' | 'C' | null;
          triage_reason?: string | null;
          status?: 'pending' | 'notified' | 'sent' | 'dismissed' | 'read' | 'snoozed';
          priority_score?: number | null;
          ai_analysis?: Json | null;
          metadata?: Json;
          received_at: string;
          notified_at?: string | null;
          actioned_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          source_type?: 'gmail' | 'chatwork' | 'line_forward';
          source_message_id?: string;
          thread_id?: string | null;
          sender_identifier?: string;
          sender_name?: string | null;
          subject?: string | null;
          body_plain?: string | null;
          body_html?: string | null;
          extracted_content?: string | null;
          triage_type?: 'A' | 'B' | 'C' | null;
          triage_reason?: string | null;
          status?: 'pending' | 'notified' | 'sent' | 'dismissed' | 'read' | 'snoozed';
          priority_score?: number | null;
          ai_analysis?: Json | null;
          metadata?: Json;
          received_at?: string;
          notified_at?: string | null;
          actioned_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      message_drafts: {
        Row: {
          id: string;
          message_id: string;
          draft_content: string;
          tone: 'formal' | 'casual' | 'brief';
          version: number;
          is_selected: boolean;
          is_sent: boolean;
          sent_via: 'gmail' | 'chatwork' | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          draft_content: string;
          tone?: 'formal' | 'casual' | 'brief';
          version?: number;
          is_selected?: boolean;
          is_sent?: boolean;
          sent_via?: 'gmail' | 'chatwork' | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          draft_content?: string;
          tone?: 'formal' | 'casual' | 'brief';
          version?: number;
          is_selected?: boolean;
          is_sent?: boolean;
          sent_via?: 'gmail' | 'chatwork' | null;
          sent_at?: string | null;
          created_at?: string;
        };
      };
      api_credentials: {
        Row: {
          id: string;
          user_id: string;
          service_type: 'gmail' | 'chatwork' | 'openai';
          access_token: string;
          refresh_token: string | null;
          token_expires_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          service_type: 'gmail' | 'chatwork' | 'openai';
          access_token: string;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          service_type?: 'gmail' | 'chatwork' | 'openai';
          access_token?: string;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}




