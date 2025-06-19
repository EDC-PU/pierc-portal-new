
'use client';

import { useState, useEffect } from 'react';
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
import type { Announcement as AnnouncementType, UserProfile, Cohort } from '@/types';
import { improveAnnouncementLanguage } from '@/ai/flows/improve-announcement-language';
import { Wand2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllCohortsStream } from '@/lib/firebase/firestore';

const announcementSchemaBase = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(100),
  content: z.string().min(10, 'Content must be at least 10 characters').max(5000),
  isUrgent: z.boolean().default(false),
  targetAudience: z.enum(['ALL', 'SPECIFIC_COHORT']).default('ALL'),
  cohortId: z.string().optional().nullable(),
});

const announcementSchema = announcementSchemaBase.superRefine((data, ctx) => {
  if (data.targetAudience === 'SPECIFIC_COHORT' && !data.cohortId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Cohort selection is required when targeting a specific cohort.',
      path: ['cohortId'],
    });
  }
});

export type AnnouncementFormSubmitData = z.infer<typeof announcementSchema>;

export type AnnouncementSaveData = AnnouncementFormSubmitData & {
    createdByUid: string;
    creatorDisplayName: string | null;
};


interface AnnouncementFormProps {
  currentUserProfile: UserProfile | null;
  initialData?: AnnouncementType | null;
  onSubmitSuccess: () => void;
  onSave: (data: AnnouncementSaveData) => Promise<void>;
}

export function AnnouncementForm({ currentUserProfile, initialData, onSubmitSuccess, onSave }: AnnouncementFormProps) {
  const { toast } = useToast();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loadingCohorts, setLoadingCohorts] = useState(false);

  const { control, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<AnnouncementFormSubmitData>({
    resolver: zodResolver(announcementSchema),
    defaultValues: {
      title: initialData?.title || '',
      content: initialData?.content || '',
      isUrgent: initialData?.isUrgent || false,
      targetAudience: initialData?.targetAudience || 'ALL',
      cohortId: initialData?.cohortId || null,
    },
  });

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiImprovedContent, setAiImprovedContent] = useState<string | null>(null);

  const currentContent = watch('content');
  const currentTargetAudience = watch('targetAudience');

  useEffect(() => {
    setLoadingCohorts(true);
    const unsubscribe = getAllCohortsStream((fetchedCohorts) => {
      setCohorts(fetchedCohorts);
      setLoadingCohorts(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentTargetAudience === 'ALL') {
      setValue('cohortId', null); // Clear cohortId if audience is ALL
    }
  }, [currentTargetAudience, setValue]);


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
        cohortId: formData.targetAudience === 'SPECIFIC_COHORT' ? formData.cohortId : null,
        createdByUid: currentUserProfile.uid,
        creatorDisplayName: currentUserProfile.displayName || currentUserProfile.fullName || 'Admin',
    };

    try {
      await onSave(announcementDataToSave);
      onSubmitSuccess(); 
    } catch (error) {
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
                  onValueChange={(value) => {
                    field.onChange(value);
                    if (value === 'ALL') setValue('cohortId', null);
                  }}
                  value={field.value}
                  className="flex space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ALL" id="audience-all" />
                    <Label htmlFor="audience-all">All Users</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="SPECIFIC_COHORT" id="audience-cohort" /> 
                    <Label htmlFor="audience-cohort">Specific Cohort</Label>
                  </div>
                </RadioGroup>
              )}
            />
            {errors.targetAudience && <p className="text-sm text-destructive mt-1">{errors.targetAudience.message}</p>}
          </div>

          {currentTargetAudience === 'SPECIFIC_COHORT' && (
            <div className="space-y-2">
              <Label htmlFor="cohortId">Select Cohort</Label>
              {loadingCohorts ? (
                <div className="flex items-center">
                  <LoadingSpinner size={16} className="mr-2" />
                  <span className="text-sm text-muted-foreground">Loading cohorts...</span>
                </div>
              ) : cohorts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No cohorts available. Please create a cohort first.</p>
              ) : (
                <Controller
                  name="cohortId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined} // Ensure undefined for placeholder
                      disabled={loadingCohorts || cohorts.length === 0}
                    >
                      <SelectTrigger id="cohortId" className="w-full md:w-[300px]">
                        <SelectValue placeholder="Select a cohort" />
                      </SelectTrigger>
                      <SelectContent>
                        {cohorts.map(cohort => (
                          <SelectItem key={cohort.id!} value={cohort.id!}>
                            {cohort.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
              {errors.cohortId && <p className="text-sm text-destructive mt-1">{errors.cohortId.message}</p>}
            </div>
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
          <Button type="submit" className="w-full" disabled={isSubmitting || isAiLoading || (currentTargetAudience === 'SPECIFIC_COHORT' && loadingCohorts)}>
            {isSubmitting ? <LoadingSpinner className="mr-2" /> : null}
            {initialData ? 'Save Changes' : 'Publish Announcement'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

