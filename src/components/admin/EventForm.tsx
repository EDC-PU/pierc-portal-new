
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import type { PortalEvent, EventCategory, Cohort } from '@/types';
import { Calendar as CalendarIcon, Upload, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { getAllCohortsStream } from '@/lib/firebase/firestore';

const eventSchemaBase = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(100),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  location: z.string().min(3, 'Location is required').max(100),
  category: z.enum(['WORKSHOP', 'DEADLINE', 'MEETING', 'WEBINAR', 'OTHER'], {
    required_error: 'Event category is required.',
  }),
  startDateTime: z.date({ required_error: "Start date and time are required." }),
  endDateTime: z.date({ required_error: "End date and time are required." }),
  flyerFile: z.custom<File | null>(f => f === null || f instanceof File).optional(),
  targetAudience: z.enum(['ALL', 'SPECIFIC_COHORT']).default('ALL'),
  cohortId: z.string().optional().nullable(),
});

const eventSchema = eventSchemaBase.superRefine((data, ctx) => {
    if (data.endDateTime <= data.startDateTime) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "End time must be after start time.",
            path: ["endDateTime"],
        });
    }
    if (data.targetAudience === 'SPECIFIC_COHORT' && !data.cohortId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Cohort selection is required when targeting a specific cohort.',
            path: ['cohortId'],
        });
    }
});

export type EventFormData = z.infer<typeof eventSchema>;

interface EventFormProps {
  initialData?: PortalEvent | null;
  onSave: (data: EventFormData) => Promise<void>;
  onSubmitSuccess: () => void;
}

export function EventForm({ initialData, onSave, onSubmitSuccess }: EventFormProps) {
  const [preview, setPreview] = useState<string | null>(initialData?.flyerUrl || null);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loadingCohorts, setLoadingCohorts] = useState(false);

  const { control, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      location: initialData?.location || 'PIERC Office, BBA Building',
      category: initialData?.category || undefined,
      startDateTime: initialData?.startDateTime?.toDate() || new Date(),
      endDateTime: initialData?.endDateTime?.toDate() || new Date(new Date().getTime() + 60 * 60 * 1000),
      flyerFile: null,
      targetAudience: initialData?.targetAudience || 'ALL',
      cohortId: initialData?.cohortId || null,
    },
  });
  
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
      setValue('cohortId', null);
    }
  }, [currentTargetAudience, setValue]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setValue('flyerFile', file, { shouldValidate: true });
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(initialData?.flyerUrl || null);
    }
  };

  const removeFlyer = () => {
    setValue('flyerFile', null);
    setPreview(null); 
    const fileInput = document.getElementById('flyerFile') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
    
    if (initialData?.flyerUrl) {
      console.log("Flyer removed from form. Backend deletion would be handled on save.");
    }
  };

  const combineDateAndTime = (date: Date, time: string): Date => {
    const [hours, minutes] = time.split(':').map(Number);
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    return newDate;
  };

  const processSubmit = async (formData: EventFormData) => {
    try {
      await onSave(formData);
      onSubmitSuccess();
    } catch (error) {
      console.error("Failed to save event from form:", error);
    }
  };

  const startTime = watch('startDateTime') ? format(watch('startDateTime'), 'HH:mm') : '';
  const endTime = watch('endDateTime') ? format(watch('endDateTime'), 'HH:mm') : '';


  return (
    <form onSubmit={handleSubmit(processSubmit)} className="space-y-6 py-4">
      <div>
        <Label htmlFor="title">Event Title</Label>
        <Controller name="title" control={control} render={({ field }) => <Input id="title" {...field} />} />
        {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
            <Label htmlFor="category">Category</Label>
            <Controller
            name="category"
            control={control}
            render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger id="category"><SelectValue placeholder="Select a category" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="WORKSHOP">Workshop</SelectItem>
                    <SelectItem value="DEADLINE">Deadline</SelectItem>
                    <SelectItem value="MEETING">Meeting</SelectItem>
                    <SelectItem value="WEBINAR">Webinar</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
                </Select>
            )}
            />
            {errors.category && <p className="text-sm text-destructive mt-1">{errors.category.message}</p>}
        </div>
        <div>
            <Label>Target Audience</Label>
            <Controller
              name="targetAudience"
              control={control}
              render={({ field }) => (
                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex space-x-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ALL" id="audience-all" />
                    <Label htmlFor="audience-all" className="font-normal">All Users</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="SPECIFIC_COHORT" id="audience-cohort" /> 
                    <Label htmlFor="audience-cohort" className="font-normal">Specific Cohort</Label>
                  </div>
                </RadioGroup>
              )}
            />
        </div>
      </div>

       {currentTargetAudience === 'SPECIFIC_COHORT' && (
        <div className="space-y-2">
            <Label htmlFor="cohortId">Select Cohort</Label>
            {loadingCohorts ? (
            <div className="flex items-center"><LoadingSpinner size={16} className="mr-2" /><span className="text-sm text-muted-foreground">Loading cohorts...</span></div>
            ) : cohorts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cohorts available.</p>
            ) : (
            <Controller name="cohortId" control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value || undefined} disabled={loadingCohorts || cohorts.length === 0}>
                    <SelectTrigger id="cohortId" className="w-full md:w-[300px]"><SelectValue placeholder="Select a cohort" /></SelectTrigger>
                    <SelectContent>{cohorts.map(cohort => (<SelectItem key={cohort.id!} value={cohort.id!}>{cohort.name}</SelectItem>))}</SelectContent>
                </Select>
            )} />
            )}
            {errors.cohortId && <p className="text-sm text-destructive mt-1">{errors.cohortId.message}</p>}
        </div>
        )}

      <div>
        <Label htmlFor="description">Description</Label>
        <Controller name="description" control={control} render={({ field }) => <Textarea id="description" rows={4} {...field} />} />
        {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
      </div>

       <div>
        <Label htmlFor="flyerFile">Event Flyer (Optional)</Label>
        <Input id="flyerFile" type="file" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} />
        {preview && (
          <div className="mt-4 relative w-full max-w-sm">
            <Image src={preview} alt="Flyer preview" width={400} height={200} className="rounded-md object-contain border" />
            <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={removeFlyer}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
        {errors.flyerFile && <p className="text-sm text-destructive mt-1">{errors.flyerFile.message}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Start Date</Label>
          <Controller
            name="startDateTime"
            control={control}
            render={({ field }) => (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={(date) => date && setValue('startDateTime', combineDateAndTime(date, startTime), { shouldValidate: true })} initialFocus /></PopoverContent>
              </Popover>
            )}
          />
        </div>
         <div>
          <Label>Start Time</Label>
          <Input type="time" value={startTime} onChange={(e) => setValue('startDateTime', combineDateAndTime(watch('startDateTime'), e.target.value), { shouldValidate: true })} />
        </div>
      </div>
      {errors.startDateTime && <p className="text-sm text-destructive mt-1">{errors.startDateTime.message}</p>}

       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>End Date</Label>
          <Controller
            name="endDateTime"
            control={control}
            render={({ field }) => (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={(date) => date && setValue('endDateTime', combineDateAndTime(date, endTime), { shouldValidate: true })} disabled={{ before: watch('startDateTime')}} initialFocus /></PopoverContent>
              </Popover>
            )}
          />
        </div>
         <div>
          <Label>End Time</Label>
          <Input type="time" value={endTime} onChange={(e) => setValue('endDateTime', combineDateAndTime(watch('endDateTime'), e.target.value), { shouldValidate: true })} />
        </div>
      </div>
      {errors.endDateTime && <p className="text-sm text-destructive mt-1">{errors.endDateTime.message}</p>}


      <div>
        <Label htmlFor="location">Location / Venue</Label>
        <Controller name="location" control={control} render={({ field }) => <Input id="location" {...field} />} />
        {errors.location && <p className="text-sm text-destructive mt-1">{errors.location.message}</p>}
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <LoadingSpinner className="mr-2" />}
          {initialData ? 'Save Changes' : 'Create Event'}
        </Button>
      </div>
    </form>
  );
}
