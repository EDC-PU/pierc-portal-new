
'use server';
/**
 * @fileOverview A utility to upload an announcement attachment file to Firebase Storage.
 *
 * - uploadAnnouncementAttachment - A function that handles the attachment upload process.
 * - UploadAnnouncementAttachmentInput - The input type for the function.
 * - UploadAnnouncementAttachmentOutput - The return type for the function.
 */

import {z} from 'genkit';
import { adminStorage } from '@/lib/firebase/admin';
import { nanoid } from 'nanoid';

const UploadAnnouncementAttachmentInputSchema = z.object({
  announcementTitle: z.string().describe('The title of the announcement for the attachment.'),
  fileName: z.string().describe('The original name of the attachment file.'),
  fileDataUri: z
    .string()
    .describe(
      "The attachment file content as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type UploadAnnouncementAttachmentInput = z.infer<typeof UploadAnnouncementAttachmentInputSchema>;

const UploadAnnouncementAttachmentOutputSchema = z.object({
  attachmentURL: z.string().describe('The public URL where the attachment is stored.'),
  attachmentName: z.string().describe('The name of the attachment file stored.'),
});
export type UploadAnnouncementAttachmentOutput = z.infer<typeof UploadAnnouncementAttachmentOutputSchema>;


/**
 * Uploads an announcement attachment file to Firebase Storage.
 * @param input The attachment data and announcement title.
 * @returns The public URL and final filename of the uploaded attachment.
 */
export async function uploadAnnouncementAttachment(input: UploadAnnouncementAttachmentInput): Promise<UploadAnnouncementAttachmentOutput> {
  const validatedInput = UploadAnnouncementAttachmentInputSchema.parse(input);

  const bucket = adminStorage.bucket();
  
  const matches = validatedInput.fileDataUri.match(/^data:(.+);base64,(.*)$/);
  if (!matches || matches.length !== 3) {
      throw new Error('Invalid Data URI format.');
  }
  const mimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');
  
  const fileExtension = validatedInput.fileName.split('.').pop() || 'tmp';
  const uniqueFileName = `${nanoid()}.${fileExtension}`;
  const filePath = `announcement_attachments/${uniqueFileName}`;
  
  const file = bucket.file(filePath);

  await file.save(buffer, {
      metadata: {
          contentType: mimeType,
      },
  });
  
  await file.makePublic();
  const publicUrl = file.publicUrl();

  return {
    attachmentURL: publicUrl,
    attachmentName: validatedInput.fileName,
  };
}
