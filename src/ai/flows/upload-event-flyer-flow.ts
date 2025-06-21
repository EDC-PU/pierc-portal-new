
'use server';
/**
 * @fileOverview A Genkit flow to upload an event flyer file to Firebase Storage.
 *
 * - uploadEventFlyer - A function that handles the event flyer upload process.
 * - UploadEventFlyerInput - The input type for the uploadEventFlyer function.
 * - UploadEventFlyerOutput - The return type for the uploadEventFlyer function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { adminStorage } from '@/lib/firebase/admin';
import { nanoid } from 'nanoid';

const UploadEventFlyerInputSchema = z.object({
  fileName: z.string().describe('The original name of the event flyer file.'),
  fileDataUri: z
    .string()
    .describe(
      "The event flyer file content as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type UploadEventFlyerInput = z.infer<typeof UploadEventFlyerInputSchema>;

const UploadEventFlyerOutputSchema = z.object({
  flyerUrl: z.string().describe('The public URL where the flyer is stored.'),
  flyerFileName: z.string().describe('The name of the flyer file stored.'),
});
export type UploadEventFlyerOutput = z.infer<typeof UploadEventFlyerOutputSchema>;

export async function uploadEventFlyer(input: UploadEventFlyerInput): Promise<UploadEventFlyerOutput> {
  return uploadEventFlyerFlow(input);
}

const uploadEventFlyerFlow = ai.defineFlow(
  {
    name: 'uploadEventFlyerFlow',
    inputSchema: UploadEventFlyerInputSchema,
    outputSchema: UploadEventFlyerOutputSchema,
  },
  async (input) => {
    console.log(`Uploading event flyer file: ${input.fileName}`);
    
    const bucket = adminStorage.bucket();
    
    // Extract content and metadata from Data URI
    const matches = input.fileDataUri.match(/^data:(.+);base64,(.*)$/);
    if (!matches || matches.length !== 3) {
        throw new Error('Invalid Data URI format.');
    }
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Create a unique path for the file
    const fileExtension = input.fileName.split('.').pop() || 'png';
    const uniqueFileName = `${nanoid()}.${fileExtension}`;
    const filePath = `event_flyers/${uniqueFileName}`;
    
    const file = bucket.file(filePath);

    await file.save(buffer, {
        metadata: {
            contentType: mimeType,
        },
    });
    
    // Make the file public and get its URL
    await file.makePublic();
    const publicUrl = file.publicUrl();

    return {
      flyerUrl: publicUrl,
      flyerFileName: input.fileName,
    };
  }
);
