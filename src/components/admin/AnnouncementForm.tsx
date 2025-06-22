
'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Wand2, Paperclip, X, Bold, Italic, List, ListOrdered } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllCohortsStream } from '@/lib/firebase/firestore';
import { Badge } from '../ui/badge';

const announcementSchemaBase = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(100),
  content: z.string().min(10, 'Content must be at least 10 characters').max(5000),
  isUrgent: z.boolean().default(false),
  targetAudience: z.enum(['ALL', 'SPECIFIC_COHORT']).default('ALL'),
  cohortId: z.string().optional().nullable(),
  attachmentFile: z.custom<File | null>(f => f === null || f instanceof File).optional(),
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

export type AnnouncementFormData = z.infer<typeof announcementSchema>;

interface AnnouncementFormProps {
  initialData?: AnnouncementType | null;
  onSubmitSuccess: () => void;
  onSave: (data: AnnouncementFormData) => Promise<void>;
}

export function AnnouncementForm({ initialData, onSubmitSuccess, onSave }: AnnouncementFormProps) {
  const { toast } = useToast();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loadingCohorts, setLoadingCohorts] = useState(false);
  const [existingAttachmentName, setExistingAttachmentName] = useState<string | null>(initialData?.attachmentName || null);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);


  const { control, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<AnnouncementFormData>({
    resolver: zodResolver(announcementSchema),
    defaultValues: {
      title: initialData?.title || '',
      content: initialData?.content || '',
      isUrgent: initialData?.isUrgent || false,
      targetAudience: initialData?.targetAudience || 'ALL',
      cohortId: initialData?.cohortId || null,
      attachmentFile: undefined, // Start with no file selected
    },
  });

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiImprovedContent, setAiImprovedContent] = useState<string | null>(null);

  const currentContent = watch('content');
  const currentTargetAudience = watch('targetAudience');
  const currentAttachmentFile = watch('attachmentFile');

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

  const applyFormat = (formatType: 'bold' | 'italic' | 'ul' | 'ol') => {
    const textarea = contentRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    let newText = '';

    const modifyLines = (lines: string[], prefixer: (line: string, index: number) => string) => {
      return lines.map(prefixer).join('\n');
    };

    switch (formatType) {
        case 'bold':
            newText = `**${selectedText}**`;
            break;
        case 'italic':
            newText = `*${selectedText}*`;
            break;
        case 'ul': {
            const lines = selectedText.split('\n');
            const transformed = modifyLines(lines, line => line.trim() ? `- ${line}` : line);
            newText = start > 0 && textarea.value[start-1] !== '\n' ? '\n' + transformed : transformed;
            break;
        }
        case 'ol': {
            const lines = selectedText.split('\n');
            let counter = 1;
            const transformed = modifyLines(lines, line => line.trim() ? `${counter++}. ${line}` : line);
            newText = start > 0 && textarea.value[start-1] !== '\n' ? '\n' + transformed : transformed;
            break;
        }
    }

    const updatedContent = textarea.value.substring(0, start) + newText + textarea.value.substring(end);
    setValue('content', updatedContent, { shouldValidate: true });

    requestAnimationFrame(() => {
        textarea.focus();
        if (formatType === 'bold' || formatType === 'italic') {
            textarea.selectionStart = start + 2;
            textarea.selectionEnd = start + selectedText.length + 2;
        } else {
            textarea.selectionStart = start + newText.length;
            textarea.selectionEnd = start + newText.length;
        }
    });
  };

  const FormattingToolbar = () => (
    <div className="flex items-center gap-1 border border-b-0 rounded-t-md p-1 bg-muted/50">
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyFormat('bold')} title="Bold">
        <Bold className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyFormat('italic')} title="Italic">
        <Italic className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyFormat('ul')} title="Unordered List">
        <List className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyFormat('ol')} title="Ordered List">
        <ListOrdered className="h-4 w-4" />
      </Button>
    </div>
  );


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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setValue('attachmentFile', file, { shouldValidate: true });
    if(file === null) {
      setExistingAttachmentName(null);
    }
  };

  const removeAttachment = () => {
    setValue('attachmentFile', null); 
    setExistingAttachmentName(null); 
    const fileInput = document.getElementById('attachmentFile') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };


  const processSubmit = async (formData: AnnouncementFormData) => {
    try {
      await onSave(formData);
      onSubmitSuccess(); 
    } catch (error) {
      console.error("Failed to save announcement from form:", error);
    }
  };

  return (
    <Card className="w-full shadow-lg border-none">
      <form onSubmit={handleSubmit(processSubmit)}>
        <CardContent className="space-y-6 pt-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Controller name="title" control={control} render={({ field }) => <Input id="title" placeholder="Announcement Title" {...field} />} />
            {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <Label htmlFor="content">Content</Label>
            <FormattingToolbar />
            <Controller name="content" control={control} render={({ field }) => 
                <Textarea
                    id="content"
                    placeholder="Detailed content of the announcement..."
                    rows={6}
                    {...field}
                    ref={e => {
                        field.ref(e);
                        contentRef.current = e;
                    }}
                    className="mt-0 rounded-t-none"
                />
            } />
            <p className="text-xs text-muted-foreground mt-1">Use the toolbar for basic formatting.</p>
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

          <div>
            <Label htmlFor="attachmentFile">Attachment (Optional)</Label>
            <Input id="attachmentFile" type="file" onChange={handleFileChange} />
            {(existingAttachmentName || currentAttachmentFile?.name) && (
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="secondary" className="flex items-center gap-2">
                  <Paperclip className="h-3 w-3"/>
                  <span>{currentAttachmentFile?.name || existingAttachmentName}</span>
                </Badge>
                <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={removeAttachment}>
                  <X className="h-4 w-4"/>
                </Button>
              </div>
            )}
             {errors.attachmentFile && <p className="text-sm text-destructive mt-1">{errors.attachmentFile.message}</p>}
          </div>
          
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
