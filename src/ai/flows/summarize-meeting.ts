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

    const summary = await response.text();
    return {summary};
  }
);
