/**
 * トリアージ型定義
 */
export type TriageType = 'A' | 'B' | 'C';

export interface TriageResult {
  type: TriageType;
  confidence: number;
  reason: string;
  priority_score?: number;
  details?: Record<string, any>;
}




