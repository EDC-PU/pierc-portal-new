// src/ai/flows/improve-announcement-language.ts
'use server';
/**
 * @fileOverview AI agent that improves the language and clarity of announcements.
 *
 * - improveAnnouncementLanguage - A function that improves the language and clarity of announcements.
 * - ImproveAnnouncementLanguageInput - The input type for the improveAnnouncementLanguage function.
 * - ImproveAnnouncementLanguageOutput - The return type for the improveAnnouncementLanguage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ImproveAnnouncementLanguageInputSchema = z.object({
  announcementText: z
    .string()
    .describe('The announcement text to be improved.'),
});

export type ImproveAnnouncementLanguageInput = z.infer<
  typeof ImproveAnnouncementLanguageInputSchema
>;

const ImproveAnnouncementLanguageOutputSchema = z.object({
  improvedAnnouncementText: z
    .string()
    .describe('The improved announcement text.'),
});

export type ImproveAnnouncementLanguageOutput = z.infer<
  typeof ImproveAnnouncementLanguageOutputSchema
>;

export async function improveAnnouncementLanguage(
  input: ImproveAnnouncementLanguageInput
): Promise<ImproveAnnouncementLanguageOutput> {
  return improveAnnouncementLanguageFlow(input);
}

const improveAnnouncementLanguagePrompt = ai.definePrompt({
  name: 'improveAnnouncementLanguagePrompt',
  input: {schema: ImproveAnnouncementLanguageInputSchema},
  output: {schema: ImproveAnnouncementLanguageOutputSchema},
  prompt: `You are an expert language editor. Improve the following announcement text so that it is professional and easily understood by all users.

Announcement Text: {{{announcementText}}}`,
});

const improveAnnouncementLanguageFlow = ai.defineFlow(
  {
    name: 'improveAnnouncementLanguageFlow',
    inputSchema: ImproveAnnouncementLanguageInputSchema,
    outputSchema: ImproveAnnouncementLanguageOutputSchema,
  },
  async input => {
    const {output} = await improveAnnouncementLanguagePrompt(input);
    return output!;
  }
);
