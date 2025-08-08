export interface SummaryItem {
  id: string;
  user_id: string;
  transcript: string;
  summary: string;
  timestamp: string;
}

export interface Reminder {
  id: string;
  user_id: string;
  text: string;
  remindAt: string;
  summaryId: string | null;
  timestamp: string;
  completed: boolean;
}
