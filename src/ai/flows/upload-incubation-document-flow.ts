
'use server';
/**
 * @fileOverview A utility to upload an incubation document file to Firebase Storage.
 *
 * - uploadIncubationDocument - A function that handles the incubation document upload process.
 * - UploadIncubationDocumentInput - The input type for the uploadIncubationDocument function.
 * - UploadIncubationDocumentOutput - The return type for the uploadIncubationDocument function.
 */

import {z} from 'genkit';
import { adminStorage } from '@/lib/firebase/admin';
import { nanoid } from 'nanoid';
import type { IncubationDocumentType } from '@/types';

const UploadIncubationDocumentInputSchema = z.object({
  ideaId: z.string().describe('The ID of the idea this document belongs to.'),
  docType: z.string().describe('The type of the document being uploaded (e.g., aadharCard).'),
  fileName: z.string().describe('The original name of the document file.'),
  fileDataUri: z
    .string()
    .describe(
      "The document file content as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type UploadIncubationDocumentInput = z.infer<typeof UploadIncubationDocumentInputSchema>;

const UploadIncubationDocumentOutputSchema = z.object({
  url: z.string().describe('The public URL where the document is stored.'),
  fileName: z.string().describe('The name of the document file stored.'),
});
export type UploadIncubationDocumentOutput = z.infer<typeof UploadIncubationDocumentOutputSchema>;


/**
 * Uploads an incubation document file to Firebase Storage. This is a standard server function.
 * @param input The document data.
 * @returns The public URL and final filename of the uploaded document.
 */
export async function uploadIncubationDocument(input: UploadIncubationDocumentInput): Promise<UploadIncubationDocumentOutput> {
    const validatedInput = UploadIncubationDocumentInputSchema.parse(input);

    const bucket = adminStorage.bucket();
    
    const matches = validatedInput.fileDataUri.match(/^data:(.+);base64,(.*)$/);
    if (!matches || matches.length !== 3) {
        throw new Error('Invalid Data URI format.');
    }
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    
    const fileExtension = validatedInput.fileName.split('.').pop() || 'pdf';
    const uniqueFileName = `${validatedInput.docType}-${nanoid()}.${fileExtension}`;
    const filePath = `incubation_documents/${validatedInput.ideaId}/${uniqueFileName}`;
    
    const file = bucket.file(filePath);

    await file.save(buffer, {
        metadata: {
            contentType: mimeType,
        },
    });
    
    await file.makePublic();
    const publicUrl = file.publicUrl();

    return {
      url: publicUrl,
      fileName: validatedInput.fileName,
    };
}
