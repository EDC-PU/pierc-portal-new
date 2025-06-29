'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { uploadYuktiScreenshot } from '@/lib/firebase/actions';
import { updateYuktiDetailsFS, getUserIdeaSubmissionsWithStatus } from '@/lib/firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { IdeaSubmission } from '@/types';

const yuktiSchema = z.object({
  yuktiId: z.string().min(3, "Yukti ID is required."),
  yuktiPassword: z.string().min(1, "Yukti Password is required."),
  yuktiScreenshot: z.custom<File | null>(f => f instanceof File, "A screenshot file is required.").nullable(),
});
type YuktiFormData = z.infer<typeof yuktiSchema>;

export default function YuktiSubmissionPage() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<YuktiFormData>({
    resolver: zodResolver(yuktiSchema),
    defaultValues: { yuktiId: '', yuktiPassword: '', yuktiScreenshot: null },
  });

  const [phase2Ideas, setPhase2Ideas] = useState<IdeaSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittedDetails, setSubmittedDetails] = useState<{
    yuktiId: string;
    yuktiScreenshotUrl: string;
    yuktiScreenshotFileName: string;
  } | null>(null);

  useEffect(() => {
    const fetchPhase2Ideas = async () => {
      if (!userProfile?.uid) return;
      try {
        const ideas = await getUserIdeaSubmissionsWithStatus(userProfile.uid);
        const phase2IdeasFiltered = ideas.filter(idea => idea.programPhase === 'PHASE_2');
        setPhase2Ideas(phase2IdeasFiltered);
        
        // Check if yukti details already exist
        if (phase2IdeasFiltered.length > 0 && phase2IdeasFiltered[0].yuktiId) {
          setSubmittedDetails({
            yuktiId: phase2IdeasFiltered[0].yuktiId,
            yuktiScreenshotUrl: phase2IdeasFiltered[0].yuktiScreenshotUrl || '',
            yuktiScreenshotFileName: phase2IdeasFiltered[0].yuktiScreenshotFileName || '',
          });
        }
      } catch (error) {
        console.error('Error fetching phase 2 ideas:', error);
        toast({ title: "Error", description: "Could not fetch your phase 2 ideas.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchPhase2Ideas();
  }, [userProfile?.uid, toast]);

  const onSubmit: SubmitHandler<YuktiFormData> = async (data) => {
    if (!userProfile || !data.yuktiScreenshot || phase2Ideas.length === 0) {
      toast({ title: "Error", description: "Required information is missing.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const reader = new FileReader();
      const fileDataUri = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(data.yuktiScreenshot!);
      });

      const uploadResult = await uploadYuktiScreenshot({
        ideaId: phase2Ideas[0].id!, // Use the first phase 2 idea's ID
        fileName: data.yuktiScreenshot.name,
        fileDataUri,
      });

      await updateYuktiDetailsFS(phase2Ideas[0].id!, phase2Ideas[0].title, {
        yuktiId: data.yuktiId,
        yuktiPassword: data.yuktiPassword,
        screenshotUrl: uploadResult.screenshotUrl,
        screenshotFileName: uploadResult.screenshotFileName,
      }, userProfile);

      // Update the submitted details state
      setSubmittedDetails({
        yuktiId: data.yuktiId,
        yuktiScreenshotUrl: uploadResult.screenshotUrl,
        yuktiScreenshotFileName: uploadResult.screenshotFileName,
      });

      toast({ title: "Yukti Details Submitted", description: "Your Yukti portal information has been saved successfully." });
    } catch (error: any) {
      toast({ title: "Submission Error", description: error.message || "Could not save Yukti details.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (phase2Ideas.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">Yukti Submission</h1>
        <p className="text-muted-foreground">
          You do not have any ideas in Phase 2. Only ideas that have progressed to Phase 2 can submit Yukti portal details.
        </p>
      </div>
    );
  }

  // Show success view if details have been submitted
  if (submittedDetails) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);

    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">Yukti Submission</h1>
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-green-800 mb-2">✅ Submission Successful</h2>
          <p className="text-green-700 mb-4">
            Your Yukti portal details have been successfully submitted for your Phase 2 idea: <span className="font-semibold">{phase2Ideas[0].title}</span>
          </p>
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-green-800">Yukti Portal ID:</Label>
              <p className="text-green-700">{submittedDetails.yuktiId}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-green-800">Submitted Screenshot:</Label>
              <div className="mt-2 flex items-center gap-4">
                <span className="text-blue-600 underline cursor-pointer" onClick={openModal}>
                  {submittedDetails.yuktiScreenshotFileName}
                </span>
                <button
                  onClick={openModal}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  View
                </button>
              </div>
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Your submission has been recorded. You can view this information anytime by visiting this page.
        </p>

        {isModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
            onClick={closeModal}
          >
            <div
              className="bg-white rounded-lg p-4 max-w-lg w-full relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={closeModal}
                className="absolute top-2 right-2 text-gray-600 hover:text-gray-900 focus:outline-none"
                aria-label="Close modal"
              >
                ✕
              </button>
              <img
                src={submittedDetails.yuktiScreenshotUrl}
                alt="Yukti Submission Screenshot"
                className="max-h-[70vh] w-full object-contain rounded"
              />
              <a
                href={submittedDetails.yuktiScreenshotUrl}
                download={submittedDetails.yuktiScreenshotFileName}
                className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Download
              </a>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Yukti Submission</h1>
      <p className="mb-6 text-muted-foreground">
        Please submit your Yukti ID, password, and a screenshot of your Yukti portal submission for your Phase 2 idea: <span className="font-semibold">{phase2Ideas[0].title}</span>
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <Label htmlFor="yuktiId">Yukti Portal ID</Label>
          <Controller
            name="yuktiId"
            control={control}
            render={({ field }) => <Input id="yuktiId" placeholder="Your Yukti ID" {...field} />}
          />
          {errors.yuktiId && <p className="text-sm text-destructive mt-1">{errors.yuktiId.message}</p>}
        </div>
        <div>
          <Label htmlFor="yuktiPassword">Yukti Portal Password</Label>
          <Controller
            name="yuktiPassword"
            control={control}
            render={({ field }) => <Input id="yuktiPassword" type="password" placeholder="••••••••" {...field} />}
          />
          {errors.yuktiPassword && <p className="text-sm text-destructive mt-1">{errors.yuktiPassword.message}</p>}
        </div>
        <div>
          <Label htmlFor="yuktiScreenshot">Yukti Submission Screenshot</Label>
          <Controller
            name="yuktiScreenshot"
            control={control}
            render={({ field: { onChange, value, ...rest } }) => (
              <Input
                id="yuktiScreenshot"
                type="file"
                accept="image/png, image/jpeg"
                onChange={(e) => onChange(e.target.files ? e.target.files[0] : null)}
                {...rest}
              />
            )}
          />
          {errors.yuktiScreenshot && <p className="text-sm text-destructive mt-1">{errors.yuktiScreenshot.message}</p>}
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit Yukti Details
        </Button>
      </form>
    </div>
  );
}
