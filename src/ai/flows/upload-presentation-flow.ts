'use server';
/**
 * @fileOverview A utility to upload a presentation file to Firebase Storage.
 *
 * - uploadPresentation - A function that handles the presentation upload process.
 * - UploadPresentationInput - The input type for the uploadPresentation function.
 * - UploadPresentationOutput - The return type for the uploadPresentation function.
 */

import {z} from 'genkit';
import { adminStorage } from '@/lib/firebase/admin';
import { nanoid } from 'nanoid';

const UploadPresentationInputSchema = z.object({
  ideaId: z.string().describe('The ID of the idea submission this presentation belongs to.'),
  fileName: z.string().describe('The original name of the presentation file.'),
  fileDataUri: z
    .string()
    .describe(
      "The presentation file content as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type UploadPresentationInput = z.infer<typeof UploadPresentationInputSchema>;

const UploadPresentationOutputSchema = z.object({
  pptUrl: z.string().describe('The public URL where the presentation is stored.'),
  pptFileName: z.string().describe('The name of the presentation file stored.'),
});
export type UploadPresentationOutput = z.infer<typeof UploadPresentationOutputSchema>;


/**
 * Uploads a presentation file to Firebase Storage. This is a standard server function.
 * @param input The presentation data.
 * @returns The public URL and final filename of the uploaded presentation.
 */
export async function uploadPresentation(input: UploadPresentationInput): Promise<UploadPresentationOutput> {
    const validatedInput = UploadPresentationInputSchema.parse(input);

    console.log(`Uploading presentation for idea: ${validatedInput.ideaId}, file: ${validatedInput.fileName}`);
    
    const bucket = adminStorage.bucket();
    
    const matches = validatedInput.fileDataUri.match(/^data:(.+);base64,(.*)$/);
    if (!matches || matches.length !== 3) {
        throw new Error('Invalid Data URI format.');
    }
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    
    const fileExtension = validatedInput.fileName.split('.').pop() || 'pptx';
    const uniqueFileName = `${nanoid()}.${fileExtension}`;
    const filePath = `presentations/${validatedInput.ideaId}/${uniqueFileName}`;
    
    const file = bucket.file(filePath);

    await file.save(buffer, {
        metadata: {
            contentType: mimeType,
        },
    });
    
    await file.makePublic();
    const publicUrl = file.publicUrl();

    return {
      pptUrl: publicUrl,
      pptFileName: validatedInput.fileName,
    };
}
