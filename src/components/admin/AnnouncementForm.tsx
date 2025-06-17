
'use client';

import { useState } from 'react';
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
import { Wand2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'; // Added for target audience

const announcementSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(100),
  content: z.string().min(10, 'Content must be at least 10 characters').max(5000),
  isUrgent: z.boolean().default(false),
  targetAudience: z.enum(['ALL', 'SPECIFIC_COHORT']).default('ALL'),
  // cohortId: z.string().optional(), // Add cohort selection later if 'SPECIFIC_COHORT'
  // attachment handling to be added later
});

// This type represents the data structure expected by onSave (excluding fields managed by onSave itself like UIDs or timestamps)
export type AnnouncementFormSubmitData = z.infer<typeof announcementSchema>;

// This type includes fields that are part of the Announcement but not directly from the form's schema (e.g. createdByUid)
// It represents the full structure for creating/updating an announcement in Firestore via the onSave prop.
export type AnnouncementSaveData = AnnouncementFormSubmitData & {
    createdByUid: string;
    creatorDisplayName: string | null;
    // attachmentURL and attachmentName would be added here when implemented
};


interface AnnouncementFormProps {
  currentUserProfile: UserProfile | null;
  initialData?: AnnouncementType | null;
  onSubmitSuccess: () => void;
  // onSave expects the full data needed to create/update, including creator info
  onSave: (data: AnnouncementSaveData) => Promise<void>;
}

export function AnnouncementForm({ currentUserProfile, initialData, onSubmitSuccess, onSave }: AnnouncementFormProps) {
  const { toast } = useToast();
  const { control, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<AnnouncementFormSubmitData>({
    resolver: zodResolver(announcementSchema),
    defaultValues: {
      title: initialData?.title || '',
      content: initialData?.content || '',
      isUrgent: initialData?.isUrgent || false,
      targetAudience: initialData?.targetAudience || 'ALL',
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
      setAiImprovedContent(null);
    }
  };

  const processSubmit = async (formData: AnnouncementFormSubmitData) => {
    if (!currentUserProfile) {
        toast({ title: "Error", description: "User not authenticated.", variant: "destructive"});
        return;
    }
    
    const announcementDataToSave: AnnouncementSaveData = {
        ...formData,
        createdByUid: currentUserProfile.uid,
        creatorDisplayName: currentUserProfile.displayName || currentUserProfile.fullName || 'Admin',
    };

    try {
      await onSave(announcementDataToSave);
      onSubmitSuccess(); 
    } catch (error) {
      // Error should be toasted by the onSave implementation or here if it throws
      console.error("Failed to save announcement from form:", error);
       toast({ title: "Save Error", description: (error as Error).message || "Could not save announcement.", variant: "destructive"});
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
          
          <div className="space-y-2">
            <Label>Target Audience</Label>
            <Controller
              name="targetAudience"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ALL" id="audience-all" />
                    <Label htmlFor="audience-all">All Users</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="SPECIFIC_COHORT" id="audience-cohort" disabled /> 
                    <Label htmlFor="audience-cohort" className="text-muted-foreground">Specific Cohort (Coming Soon)</Label>
                  </div>
                </RadioGroup>
              )}
            />
            {errors.targetAudience && <p className="text-sm text-destructive mt-1">{errors.targetAudience.message}</p>}
          </div>

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
