export interface SummaryItem {
  id: string;
  user_id: string;
  transcript: string;
  summary: string;
  timestamp: string; // Changed from number to string for ISO format
}

export interface Reminder {
  id: string;
  user_id: string;
  text: string;
  remindAt: string; // Changed from number to string for ISO format
  summaryId: string | null;
}
