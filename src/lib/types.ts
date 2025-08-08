export interface SummaryItem {
  id: string;
  user_id: string;
  transcript: string;
  summary: string;
  timestamp: number;
}

export interface Reminder {
  id: string;
  user_id: string;
  text: string;
  remindAt: number;
  summaryId: string | null;
}
