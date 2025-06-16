'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import type { Announcement as AnnouncementType, UserProfile } from '@/types';
import { improveAnnouncementLanguage } from '@/ai/flows/improve-announcement-language';
import { Wand2 } from 'lucide-react'; // Icon for AI feature

const announcementSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(100),
  content: z.string().min(10, 'Content must be at least 10 characters').max(5000),
  isUrgent: z.boolean().default(false),
});

type AnnouncementFormData = z.infer<typeof announcementSchema>;

interface AnnouncementFormProps {
  currentUserProfile: UserProfile | null;
  initialData?: AnnouncementType | null;
  onSubmitSuccess: () => void; // Callback when form submits successfully
  onSave: (data: AnnouncementFormData, creatorUid: string, creatorName: string | null) => Promise<void>;
}

export function AnnouncementForm({ currentUserProfile, initialData, onSubmitSuccess, onSave }: AnnouncementFormProps) {
  const { toast } = useToast();
  const { control, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<AnnouncementFormData>({
    resolver: zodResolver(announcementSchema),
    defaultValues: {
      title: initialData?.title || '',
      content: initialData?.content || '',
      isUrgent: initialData?.isUrgent || false,
    },
  });

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiImprovedContent, setAiImprovedContent] = useState<string | null>(null);

  const currentContent = watch('content');

  const handleImproveLanguage = async () => {
    if (!currentContent) {
      toast({ title: 'Cannot Improve', description: 'Content is empty.', variant: 'destructive' });
      return;
    }
    setIsAiLoading(true);
    try {
      const result = await improveAnnouncementLanguage({ announcementText: currentContent });
      setAiImprovedContent(result.improvedAnnouncementText);
      toast({ title: 'Language Improved', description: 'AI suggestion is ready.' });
    } catch (error) {
      console.error("AI language improvement failed:", error);
      toast({ title: 'AI Error', description: 'Could not improve language.', variant: 'destructive' });
    } finally {
      setIsAiLoading(false);
    }
  };

  const useAiSuggestion = () => {
    if (aiImprovedContent) {
      setValue('content', aiImprovedContent, { shouldValidate: true });
      setAiImprovedContent(null); // Clear suggestion after use
    }
  };

  const processSubmit = async (data: AnnouncementFormData) => {
    if (!currentUserProfile) {
        toast({ title: "Error", description: "User not authenticated.", variant: "destructive"});
        return;
    }
    try {
      await onSave(data, currentUserProfile.uid, currentUserProfile.displayName);
      onSubmitSuccess(); // Call the success callback (e.g., to close a dialog)
    } catch (error) {
      // onSave should handle its own toasts for specific Firestore errors
      console.error("Failed to save announcement:", error);
      // Generic toast if onSave doesn't handle it or for other errors
      // toast({ title: "Save Failed", description: "Could not save the announcement.", variant: "destructive" });
    }
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">{initialData ? 'Edit Announcement' : 'Create New Announcement'}</CardTitle>
        <CardDescription>
          {initialData ? 'Modify the details of the existing announcement.' : 'Craft a new announcement for the PIERC community.'}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(processSubmit)}>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="title">Title</Label>
            <Controller name="title" control={control} render={({ field }) => <Input id="title" placeholder="Announcement Title" {...field} />} />
            {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <Label htmlFor="content">Content</Label>
            <Controller name="content" control={control} render={({ field }) => <Textarea id="content" placeholder="Detailed content of the announcement..." rows={6} {...field} />} />
            {errors.content && <p className="text-sm text-destructive mt-1">{errors.content.message}</p>}
          </div>

          <div className="flex items-center space-x-2 mt-2">
             <Button type="button" variant="outline" onClick={handleImproveLanguage} disabled={isAiLoading || !currentContent}>
              {isAiLoading ? <LoadingSpinner className="mr-2" size={16}/> : <Wand2 className="mr-2 h-4 w-4" />}
              Improve Language with AI
            </Button>
          </div>

          {aiImprovedContent && (
            <Card className="mt-4 bg-secondary/50">
              <CardHeader>
                <CardTitle className="text-lg font-headline">AI Suggestion</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{aiImprovedContent}</p>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setAiImprovedContent(null)}>Discard</Button>
                <Button type="button" onClick={useAiSuggestion}>Use Suggestion</Button>
              </CardFooter>
            </Card>
          )}
          
          <div className="flex items-center space-x-2 pt-2">
            <Controller
              name="isUrgent"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="isUrgent"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label="Mark as urgent"
                />
              )}
            />
            <Label htmlFor="isUrgent" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Mark as Urgent
            </Label>
          </div>
           {errors.isUrgent && <p className="text-sm text-destructive mt-1">{errors.isUrgent.message}</p>}


        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isSubmitting || isAiLoading}>
            {isSubmitting ? <LoadingSpinner className="mr-2" /> : null}
            {initialData ? 'Save Changes' : 'Publish Announcement'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
