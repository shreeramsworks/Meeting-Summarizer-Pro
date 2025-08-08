export interface SummaryHistoryItem {
  id: string;
  transcript: string;
  summary: string;
  timestamp: number;
}

export interface Reminder {
  id: string;
  text: string;
  remindAt: number;
}
