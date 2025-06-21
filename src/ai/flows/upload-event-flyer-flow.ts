'use server';
/**
 * @fileOverview A utility to upload an event flyer file to Firebase Storage.
 *
 * - uploadEventFlyer - A function that handles the event flyer upload process.
 * - UploadEventFlyerInput - The input type for the uploadEventFlyer function.
 * - UploadEventFlyerOutput - The return type for the uploadEventFlyer function.
 */

import {z} from 'genkit'; // Keep zod for schema validation
import { adminStorage } from '@/lib/firebase/admin';

// Schema for input validation
const UploadEventFlyerInputSchema = z.object({
  eventName: z.string().describe('The name of the event for the flyer.'),
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


/**
 * Uploads an event flyer to Firebase Storage. This is a standard server function, not a Genkit flow.
 * @param input The flyer data and event name.
 * @returns The public URL and final filename of the uploaded flyer.
 */
export async function uploadEventFlyer(input: UploadEventFlyerInput): Promise<UploadEventFlyerOutput> {
  // Validate input with Zod
  const validatedInput = UploadEventFlyerInputSchema.parse(input);

  console.log(`Uploading event flyer file for event: ${validatedInput.eventName}`);
  
  const bucket = adminStorage.bucket();
  
  // Extract content and metadata from Data URI
  const matches = validatedInput.fileDataUri.match(/^data:(.+);base64,(.*)$/);
  if (!matches || matches.length !== 3) {
      throw new Error('Invalid Data URI format.');
  }
  const mimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');
  
  // Sanitize event name for use as a filename and get extension
  const fileExtension = validatedInput.fileName.split('.').pop() || 'png';
  const sanitizedEventName = validatedInput.eventName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/\s+/g, '-');
  const newFileName = `flyer-${sanitizedEventName}.${fileExtension}`;
  const filePath = `event_flyers/${newFileName}`;
  
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
    flyerFileName: newFileName, // Return the new, sanitized filename
  };
}
