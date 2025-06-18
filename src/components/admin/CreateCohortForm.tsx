
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import type { Cohort, UserProfile } from '@/types';
import { CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, addDays, isBefore } from 'date-fns';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';


const cohortFormSchema = z.object({
  name: z.string().min(3, 'Cohort name must be at least 3 characters').max(100),
  startDate: z.date({ required_error: "Start date is required." }),
  endDate: z.date({ required_error: "End date is required." }),
  batchSize: z.coerce.number().min(1, 'Batch size must be at least 1').max(200, 'Batch size seems too large'),
}).refine(data => data.endDate ? isBefore(data.startDate, data.endDate) : true, {
  message: "End date must be after start date.",
  path: ["endDate"],
});

export type CreateCohortFormData = Omit<z.infer<typeof cohortFormSchema>, 'startDate' | 'endDate'> & {
  startDate: Timestamp;
  endDate: Timestamp;
};

// This is the type the form will handle internally before converting dates to Timestamps
type CohortFormInternalData = z.infer<typeof cohortFormSchema>;


interface CreateCohortFormProps {
  currentUserProfile: UserProfile; // To associate creator with the cohort
  initialData?: Cohort | null;
  onSubmitSuccess: () => void;
  onSave: (data: CreateCohortFormData) => Promise<void>;
}

export function CreateCohortForm({ currentUserProfile, initialData, onSubmitSuccess, onSave }: CreateCohortFormProps) {
  const { toast } = useToast();
  const { control, handleSubmit, watch, formState: { errors, isSubmitting }, setValue } = useForm<CohortFormInternalData>({
    resolver: zodResolver(cohortFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      startDate: initialData?.startDate ? initialData.startDate.toDate() : new Date(),
      endDate: initialData?.endDate ? initialData.endDate.toDate() : addDays(new Date(), 30),
      batchSize: initialData?.batchSize || 15,
    },
  });

  const watchedStartDate = watch("startDate");

  const processSubmit = async (formData: CohortFormInternalData) => {
    if (!currentUserProfile) {
        toast({ title: "Error", description: "User not authenticated.", variant: "destructive"});
        return;
    }
    
    const dataToSave: CreateCohortFormData = {
        name: formData.name,
        startDate: Timestamp.fromDate(formData.startDate),
        endDate: Timestamp.fromDate(formData.endDate),
        batchSize: formData.batchSize,
    };

    try {
      await onSave(dataToSave);
      onSubmitSuccess(); 
    } catch (error) {
      console.error("Failed to save cohort from form:", error);
      toast({ title: "Save Error", description: (error as Error).message || "Could not save cohort.", variant: "destructive"});
    }
  };

  return (
    <Card className="w-full shadow-none border-none">
      {/* Removed CardHeader as Dialog provides title */}
      <form onSubmit={handleSubmit(processSubmit)}>
        <CardContent className="space-y-6 pt-4">
          <div>
            <Label htmlFor="name">Cohort Name</Label>
            <Controller name="name" control={control} render={({ field }) => <Input id="name" placeholder="e.g., Spring Incubation 2024" {...field} />} />
            {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Controller
                name="startDate"
                control={control}
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Pick a start date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                    </PopoverContent>
                  </Popover>
                )}
              />
              {errors.startDate && <p className="text-sm text-destructive mt-1">{errors.startDate.message}</p>}
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
               <Controller
                name="endDate"
                control={control}
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Pick an end date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={{ before: watchedStartDate || new Date() }} initialFocus />
                    </PopoverContent>
                  </Popover>
                )}
              />
              {errors.endDate && <p className="text-sm text-destructive mt-1">{errors.endDate.message}</p>}
            </div>
          </div>
          
          <div>
            <Label htmlFor="batchSize">Batch Size (Max Teams)</Label>
            <Controller 
                name="batchSize" 
                control={control} 
                render={({ field }) => (
                    <Input 
                        id="batchSize" 
                        type="number" 
                        placeholder="e.g., 20" 
                        {...field} 
                        value={field.value || ''}
                        onChange={e => field.onChange(parseInt(e.target.value,10) || 0)}
                    />
                )} 
            />
            {errors.batchSize && <p className="text-sm text-destructive mt-1">{errors.batchSize.message}</p>}
          </div>

        </CardContent>
        <CardFooter className="pt-6">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <LoadingSpinner className="mr-2" /> : null}
            {initialData ? 'Save Changes' : 'Create Cohort'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
