'use server';

/**
 * @fileOverview Summarizes a meeting transcript using a webhook.
 *
 * - summarizeMeetingTranscript - A function that handles the meeting transcript summarization process.
 * - SummarizeMeetingTranscriptInput - The input type for the summarizeMeetingTranscript function.
 * - SummarizeMeetingTranscriptOutput - The return type for the summarizeMeetingTranscript function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeMeetingTranscriptInputSchema = z.object({
  transcript: z
    .string()
    .describe('The meeting transcript to summarize.'),
  webhookUrl: z
    .string()
    .url()
    .describe('The URL of the webhook to send the transcript to.'),
});
export type SummarizeMeetingTranscriptInput = z.infer<
  typeof SummarizeMeetingTranscriptInputSchema
>;

const SummarizeMeetingTranscriptOutputSchema = z.object({
  summary: z.string().describe('The summary of the meeting transcript.'),
});
export type SummarizeMeetingTranscriptOutput = z.infer<
  typeof SummarizeMeetingTranscriptOutputSchema
>;

interface WebhookResponse {
    summary: string;
    action_items?: { task: string; assignee: string; due_date: string }[];
    decisions_made?: string[];
    follow_up_reminders?: { reminder: string; due_date: string; context: string }[];
}

function formatWebhookResponse(response: WebhookResponse): string {
    let formattedText = `Summary:\n${response.summary}\n\n`;

    if (response.action_items && response.action_items.length > 0) {
        formattedText += "Action Items:\n";
        response.action_items.forEach(item => {
            formattedText += `  - ${item.task} (Assignee: ${item.assignee}, Due: ${item.due_date})\n`;
        });
        formattedText += "\n";
    }

    if (response.decisions_made && response.decisions_made.length > 0) {
        formattedText += "Decisions Made:\n";
        response.decisions_made.forEach(decision => {
            formattedText += `  - ${decision}\n`;
        });
        formattedText += "\n";
    }

    if (response.follow_up_reminders && response.follow_up_reminders.length > 0) {
        formattedText += "Follow-up Reminders:\n";
        response.follow_up_reminders.forEach(reminder => {
            formattedText += `  - ${reminder.reminder} (Due: ${reminder.due_date}, Context: ${reminder.context})\n`;
        });
        formattedText += "\n";
    }

    return formattedText.trim();
}


export async function summarizeMeetingTranscript(
  input: SummarizeMeetingTranscriptInput
): Promise<SummarizeMeetingTranscriptOutput> {
  return summarizeMeetingTranscriptFlow(input);
}

const summarizeMeetingTranscriptFlow = ai.defineFlow(
  {
    name: 'summarizeMeetingTranscriptFlow',
    inputSchema: SummarizeMeetingTranscriptInputSchema,
    outputSchema: SummarizeMeetingTranscriptOutputSchema,
  },
  async input => {
    const response = await fetch(input.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: input.transcript,
    });

    if (!response.ok) {
      throw new Error(
        `Webhook request failed with status: ${response.status}`
      );
    }

    try {
        const jsonResponse: WebhookResponse = await response.json();
        const formattedSummary = formatWebhookResponse(jsonResponse);
        return { summary: formattedSummary };
    } catch (e) {
        // If parsing fails, fall back to plain text
        const summary = await response.text();
        return {summary};
    }
  }
);
