
'use server';
/**
 * @fileOverview Server actions for the PIERC portal, primarily for file uploads using the Admin SDK.
 * This module is intended to be used by client components.
 */

import {z} from 'genkit';
import { adminStorage } from '@/lib/firebase/admin';
import { nanoid } from 'nanoid';
import type { IncubationDocumentType } from '@/types';

// --- From upload-presentation-flow.ts ---

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

export async function uploadPresentation(input: UploadPresentationInput): Promise<UploadPresentationOutput> {
    const validatedInput = UploadPresentationInputSchema.parse(input);
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
    await file.save(buffer, { metadata: { contentType: mimeType } });
    await file.makePublic();
    const publicUrl = file.publicUrl();
    return {
      pptUrl: publicUrl,
      pptFileName: validatedInput.fileName,
    };
}


// --- From upload-incubation-document-flow.ts ---

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
    await file.save(buffer, { metadata: { contentType: mimeType } });
    await file.makePublic();
    const publicUrl = file.publicUrl();
    return {
      url: publicUrl,
      fileName: validatedInput.fileName,
    };
}


// --- From upload-event-flyer-flow.ts ---

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

export async function uploadEventFlyer(input: UploadEventFlyerInput): Promise<UploadEventFlyerOutput> {
  const validatedInput = UploadEventFlyerInputSchema.parse(input);
  const bucket = adminStorage.bucket();
  const matches = validatedInput.fileDataUri.match(/^data:(.+);base64,(.*)$/);
  if (!matches || matches.length !== 3) {
      throw new Error('Invalid Data URI format.');
  }
  const mimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');
  const fileExtension = validatedInput.fileName.split('.').pop() || 'png';
  const sanitizedEventName = validatedInput.eventName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/\s+/g, '-');
  const newFileName = `flyer-${sanitizedEventName}.${fileExtension}`;
  const filePath = `event_flyers/${newFileName}`;
  const file = bucket.file(filePath);
  await file.save(buffer, { metadata: { contentType: mimeType } });
  await file.makePublic();
  const publicUrl = file.publicUrl();
  return {
    flyerUrl: publicUrl,
    flyerFileName: newFileName,
  };
}


// --- From upload-announcement-attachment-flow.ts ---

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
  await file.save(buffer, { metadata: { contentType: mimeType } });
  await file.makePublic();
  const publicUrl = file.publicUrl();
  return {
    attachmentURL: publicUrl,
    attachmentName: validatedInput.fileName,
  };
}

// --- From upload-yukti-screenshot-flow.ts ---

const UploadYuktiScreenshotInputSchema = z.object({
  ideaId: z.string().describe('The ID of the idea submission this screenshot belongs to.'),
  fileName: z.string().describe('The original name of the screenshot file.'),
  fileDataUri: z
    .string()
    .describe(
      "The screenshot file content as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type UploadYuktiScreenshotInput = z.infer<typeof UploadYuktiScreenshotInputSchema>;

const UploadYuktiScreenshotOutputSchema = z.object({
  screenshotUrl: z.string().describe('The public URL where the screenshot is stored.'),
  screenshotFileName: z.string().describe('The name of the screenshot file stored.'),
});
export type UploadYuktiScreenshotOutput = z.infer<typeof UploadYuktiScreenshotOutputSchema>;

export async function uploadYuktiScreenshot(input: UploadYuktiScreenshotInput): Promise<UploadYuktiScreenshotOutput> {
    const validatedInput = UploadYuktiScreenshotInputSchema.parse(input);
    const bucket = adminStorage.bucket();
    const matches = validatedInput.fileDataUri.match(/^data:(.+);base64,(.*)$/);
    if (!matches || matches.length !== 3) {
        throw new Error('Invalid Data URI format.');
    }
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    const fileExtension = validatedInput.fileName.split('.').pop() || 'png';
    const uniqueFileName = `yukti-screenshot-${nanoid()}.${fileExtension}`;
    const filePath = `yukti_screenshots/${validatedInput.ideaId}/${uniqueFileName}`;
    const file = bucket.file(filePath);
    await file.save(buffer, { metadata: { contentType: mimeType } });
    await file.makePublic();
    const publicUrl = file.publicUrl();
    return {
      screenshotUrl: publicUrl,
      screenshotFileName: validatedInput.fileName,
    };
}
