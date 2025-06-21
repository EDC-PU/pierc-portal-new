
'use server';
/**
 * @fileOverview A Genkit flow to generate a pitch deck outline based on an idea's core components.
 *
 * - generatePitchDeckOutline - A function that takes idea details and returns a structured pitch deck outline.
 * - GeneratePitchDeckOutlineInput - The input type for the generatePitchDeckOutline function.
 * - GeneratePitchDeckOutlineOutput - The return type for the generatePitchDeckOutline function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GeneratePitchDeckOutlineInputSchema = z.object({
  ideaTitle: z.string().describe('The title of the startup idea or project.'),
  problemStatement: z.string().describe('The core problem the idea aims to solve.'),
  proposedSolution: z.string().describe('The proposed solution to the problem.'),
  uniqueness: z.string().describe('What makes this idea unique or innovative.'),
});
export type GeneratePitchDeckOutlineInput = z.infer<typeof GeneratePitchDeckOutlineInputSchema>;

const SlideSectionSchema = z.object({
  title: z.string().describe('The title of this slide or section.'),
  keyPoints: z.array(z.string()).describe('A list of key talking points or content for this slide.'),
});

const GeneratePitchDeckOutlineOutputSchema = z.object({
  titleSlide: SlideSectionSchema.describe('Outline for the title slide, including company name/logo placeholder and tagline.'),
  problemSlide: SlideSectionSchema.describe('Outline for the problem slide, emphasizing the pain point.'),
  solutionSlide: SlideSectionSchema.describe('Outline for the solution slide, clearly explaining how the idea addresses the problem.'),
  productDemoSlide: SlideSectionSchema.optional().describe('Outline for a product/service demo slide, showcasing how it works (if applicable).'),
  marketSizeSlide: SlideSectionSchema.describe('Outline for the market size slide (TAM, SAM, SOM).'),
  businessModelSlide: SlideSectionSchema.describe('Outline for the business model slide, explaining how the idea will make money.'),
  teamSlide: SlideSectionSchema.describe('Outline for the team slide, highlighting key members and expertise.'),
  competitionSlide: SlideSectionSchema.describe('Outline for the competition slide, identifying key competitors and competitive advantages.'),
  tractionMilestonesSlide: SlideSectionSchema.optional().describe('Outline for traction/milestones slide, showing progress made and future roadmap (if applicable).'),
  askSlide: SlideSectionSchema.describe('Outline for the "ask" slide (e.g., funding, mentorship, resources).'),
  contactSlide: SlideSectionSchema.describe('Outline for the contact information slide.'),
});
export type GeneratePitchDeckOutlineOutput = z.infer<typeof GeneratePitchDeckOutlineOutputSchema>;


export async function generatePitchDeckOutline(input: GeneratePitchDeckOutlineInput): Promise<GeneratePitchDeckOutlineOutput> {
  return generatePitchDeckOutlineFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePitchDeckOutlinePrompt',
  input: {schema: GeneratePitchDeckOutlineInputSchema},
  output: {schema: GeneratePitchDeckOutlineOutputSchema},
  prompt: `You are an expert startup advisor helping an innovator create a compelling pitch deck outline.
The innovator has provided the following details about their idea:
- Idea Title: {{{ideaTitle}}}
- Problem Statement: {{{problemStatement}}}
- Proposed Solution: {{{proposedSolution}}}
- Uniqueness/Innovation: {{{uniqueness}}}

Based on this information, generate a structured pitch deck outline. For each slide, provide a clear title and 3-5 concise key talking points.
Focus on standard pitch deck components. If some information is not explicitly provided (e.g., specific market numbers, team details), make the key points generic prompts for the user to fill in.

Ensure the output strictly adheres to the requested JSON schema.
The "productDemoSlide" and "tractionMilestonesSlide" are optional; only include them if they seem highly relevant based on the input, otherwise omit them.
All other slides (title, problem, solution, market size, business model, team, competition, ask, contact) are mandatory.
For the team slide, suggest key roles or expertise to highlight if specific names aren't available.
For the ask slide, suggest common types of asks like funding amount, resource needs, or mentorship.
`,
});

const generatePitchDeckOutlineFlow = ai.defineFlow(
  {
    name: 'generatePitchDeckOutlineFlow',
    inputSchema: GeneratePitchDeckOutlineInputSchema,
    outputSchema: GeneratePitchDeckOutlineOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('AI failed to generate a pitch deck outline.');
    }
    return output;
  }
);
