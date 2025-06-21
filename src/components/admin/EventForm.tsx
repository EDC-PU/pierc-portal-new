
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import type { PortalEvent, EventCategory } from '@/types';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';

const eventSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(100),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  location: z.string().min(3, 'Location is required').max(100),
  category: z.enum(['WORKSHOP', 'DEADLINE', 'MEETING', 'WEBINAR', 'OTHER'], {
    required_error: 'Event category is required.',
  }),
  startDateTime: z.date({ required_error: "Start date and time are required." }),
  endDateTime: z.date({ required_error: "End date and time are required." }),
}).refine(data => data.endDateTime > data.startDateTime, {
  message: "End time must be after start time.",
  path: ["endDateTime"],
});

type EventFormData = z.infer<typeof eventSchema>;
type EventSaveData = Omit<PortalEvent, 'id' | 'createdAt' | 'updatedAt' | 'createdByUid' | 'creatorDisplayName' | 'rsvps' | 'rsvpCount'>;

interface EventFormProps {
  initialData?: PortalEvent | null;
  onSave: (data: EventSaveData) => Promise<void>;
  onSubmitSuccess: () => void;
}

export function EventForm({ initialData, onSave, onSubmitSuccess }: EventFormProps) {
  const { control, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      location: initialData?.location || 'PIERC Office, BBA Building',
      category: initialData?.category || undefined,
      startDateTime: initialData?.startDateTime?.toDate() || new Date(),
      endDateTime: initialData?.endDateTime?.toDate() || new Date(new Date().getTime() + 60 * 60 * 1000),
    },
  });

  const combineDateAndTime = (date: Date, time: string): Date => {
    const [hours, minutes] = time.split(':').map(Number);
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    return newDate;
  };

  const processSubmit = async (formData: EventFormData) => {
    const dataToSave: EventSaveData = {
      title: formData.title,
      description: formData.description,
      location: formData.location,
      category: formData.category,
      startDateTime: Timestamp.fromDate(formData.startDateTime),
      endDateTime: Timestamp.fromDate(formData.endDateTime),
    };
    try {
      await onSave(dataToSave);
      onSubmitSuccess();
    } catch (error) {
      console.error("Failed to save event from form:", error);
      // Parent component will toast the error
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
        <Label htmlFor="description">Description</Label>
        <Controller name="description" control={control} render={({ field }) => <Textarea id="description" rows={4} {...field} />} />
        {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
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

