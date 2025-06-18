
'use client';

import { useEffect, useState } from 'react';
import type { Cohort, UserProfile, CohortScheduleEntry } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { CreateCohortForm, type CreateCohortFormData } from '@/components/admin/CreateCohortForm';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createCohortFS, getAllCohortsStream, updateCohortScheduleFS } from '@/lib/firebase/firestore';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { format, isValid } from 'date-fns';
import { PlusCircle, Users, CalendarRange, Edit3, Trash2, FileText, Download, Save } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { nanoid } from 'nanoid';

const scheduleEntrySchema = z.object({
  id: z.string().default(() => nanoid()),
  date: z.string().min(1, "Date is required"),
  day: z.string().min(1, "Day is required"),
  time: z.string().min(1, "Time is required"),
  category: z.string().min(1, "Category is required"),
  topicActivity: z.string().min(1, "Topic/Activity is required"),
  content: z.string().optional(),
  speakerVenue: z.string().optional(),
});

const cohortScheduleFormSchema = z.object({
  schedule: z.array(scheduleEntrySchema),
});

type CohortScheduleFormData = z.infer<typeof cohortScheduleFormSchema>;


export default function ManageCohortsPage() {
  const { userProfile, loading: authLoading, initialLoadComplete } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loadingCohorts, setLoadingCohorts] = useState(true);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [editingCohort, setEditingCohort] = useState<Cohort | null>(null); // For future editing of cohort details

  const [selectedCohortForSchedule, setSelectedCohortForSchedule] = useState<Cohort | null>(null);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);

  const { control: scheduleControl, handleSubmit: handleScheduleSubmit, reset: resetScheduleForm, formState: { errors: scheduleErrors, isSubmitting: isSubmittingSchedule } } = useForm<CohortScheduleFormData>({
    resolver: zodResolver(cohortScheduleFormSchema),
    defaultValues: { schedule: [] },
  });

  const { fields: scheduleFields, append: appendScheduleEntry, remove: removeScheduleEntry, update: updateScheduleEntry } = useFieldArray({
    control: scheduleControl,
    name: "schedule",
  });

  useEffect(() => {
    if (initialLoadComplete && !authLoading) {
      if (!userProfile) {
        router.push('/login');
        return;
      }
      if (userProfile.role !== 'ADMIN_FACULTY') {
        toast({ title: "Access Denied", description: "You are not authorized to view this page.", variant: "destructive" });
        router.push('/dashboard');
      }
    }
  }, [userProfile, authLoading, initialLoadComplete, router, toast]);

  useEffect(() => {
    if (userProfile?.role === 'ADMIN_FACULTY') {
      setLoadingCohorts(true);
      const unsubscribe = getAllCohortsStream((fetchedCohorts) => {
        setCohorts(fetchedCohorts.map(c => ({ ...c, schedule: c.schedule || [] }))); // Ensure schedule exists
        setLoadingCohorts(false);
      });
      return () => unsubscribe();
    }
  }, [userProfile]);

  useEffect(() => {
    if (selectedCohortForSchedule) {
      resetScheduleForm({ schedule: selectedCohortForSchedule.schedule || [] });
    } else {
      resetScheduleForm({ schedule: [] });
    }
  }, [selectedCohortForSchedule, resetScheduleForm]);


  const handleCreateFormSubmitSuccess = () => {
    setIsCreateFormOpen(false);
    setEditingCohort(null);
    toast({ title: "Success", description: editingCohort ? "Cohort updated successfully." : "Cohort created successfully." });
  };

  const handleSaveCohort = async (data: CreateCohortFormData) => {
    if (!userProfile) {
        toast({ title: "Authentication Error", description: "Admin profile not found.", variant: "destructive" });
        throw new Error("Admin profile not found");
    }
    try {
        if (editingCohort && editingCohort.id) {
            // Update logic will go here later
            toast({title: "Update Not Implemented", description: "Cohort update functionality is coming soon.", variant: "default"});
        } else {
            await createCohortFS(data, userProfile);
        }
    } catch (error: any) {
        toast({ title: "Save Error", description: error.message || "Could not save cohort.", variant: "destructive"});
        throw error;
    }
  };
  
  const handleSaveSchedule = async (data: CohortScheduleFormData) => {
    if (!selectedCohortForSchedule || !selectedCohortForSchedule.id || !userProfile) {
        toast({title: "Error", description: "No cohort selected or admin profile missing.", variant: "destructive"});
        return;
    }
    try {
        await updateCohortScheduleFS(selectedCohortForSchedule.id, data.schedule, userProfile);
        toast({title: "Schedule Saved", description: `Schedule for ${selectedCohortForSchedule.name} updated.`});
        // Optimistically update local state or re-fetch if necessary
        setCohorts(prev => prev.map(c => c.id === selectedCohortForSchedule.id ? {...c, schedule: data.schedule} : c));
        setIsScheduleDialogOpen(false);
    } catch (error: any) {
        toast({ title: "Save Schedule Error", description: error.message || "Could not save cohort schedule.", variant: "destructive"});
    }
  };

  const openNewCreateForm = () => {
    setEditingCohort(null);
    setIsCreateFormOpen(true);
  };

  const openScheduleDialog = (cohort: Cohort) => {
    setSelectedCohortForSchedule(cohort);
    setIsScheduleDialogOpen(true);
  };
  
  const formatDate = (timestamp: Timestamp | Date | undefined): string => {
    if (!timestamp) return 'N/A';
    let dateToFormat: Date;
    if ((timestamp as Timestamp)?.toDate) {
      dateToFormat = (timestamp as Timestamp).toDate();
    } else if (timestamp instanceof Date) {
      dateToFormat = timestamp;
    } else {
        return 'Invalid Date';
    }
     if (!isValid(dateToFormat)) return 'Invalid Date';
    return format(dateToFormat, 'MMM d, yyyy');
  };

  const exportScheduleToCSV = (cohort: Cohort) => {
    if (!cohort.schedule || cohort.schedule.length === 0) {
      toast({ title: "No Schedule Data", description: "This cohort has no schedule to export.", variant: "default" });
      return;
    }
    const headers = ["Date", "Day", "Time", "Category", "Topic/Activity", "Content", "Speaker/Venue"];
    const csvRows = [headers.join(",")];

    cohort.schedule.forEach(entry => {
      const row = [
        entry.date,
        entry.day,
        entry.time,
        entry.category,
        entry.topicActivity,
        entry.content || '',
        entry.speakerVenue || ''
      ].map(field => `"${String(field).replace(/"/g, '""')}"`); // Escape quotes and wrap in quotes
      csvRows.push(row.join(","));
    });

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${cohort.name}_schedule.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Export Successful", description: `Schedule for ${cohort.name} downloaded.` });
  };


  if (authLoading || !initialLoadComplete || loadingCohorts) {
    return <div className="flex justify-center items-center h-screen"><LoadingSpinner size={48} /></div>;
  }
  if (userProfile?.role !== 'ADMIN_FACULTY') {
    return <div className="flex justify-center items-center h-screen"><p>Access Denied. Redirecting...</p></div>;
  }

  return (
    <div className="space-y-8 animate-slide-in-up p-4 md:p-6 lg:p-8">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center">
          <Users className="h-10 w-10 text-primary mr-3" />
          <div>
            <h1 className="text-3xl font-headline font-bold">Manage Cohorts</h1>
            <p className="text-muted-foreground">Create, view, and manage incubation cohorts and their schedules.</p>
          </div>
        </div>
        <Dialog open={isCreateFormOpen} onOpenChange={(isOpen) => {
            setIsCreateFormOpen(isOpen);
            if (!isOpen) {
                setEditingCohort(null);
            }
        }}>
          <DialogTrigger asChild>
            <Button onClick={openNewCreateForm}>
              <PlusCircle className="mr-2 h-5 w-5" /> Create New Cohort
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl">
                {editingCohort ? 'Edit Cohort' : 'Create New Cohort'}
              </DialogTitle>
            </DialogHeader>
            {isCreateFormOpen && userProfile && ( 
                 <CreateCohortForm
                    currentUserProfile={userProfile} 
                    initialData={editingCohort}
                    onSubmitSuccess={handleCreateFormSubmitSuccess}
                    onSave={handleSaveCohort}
                />
            )}
          </DialogContent>
        </Dialog>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Existing Cohorts</CardTitle>
          <CardDescription>List of all created cohorts. Manage their schedules or export data.</CardDescription>
        </CardHeader>
        <CardContent>
          {cohorts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No cohorts found. Create one to get started!</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Cohort Name</TableHead>
                    <TableHead className="hidden md:table-cell">Start Date</TableHead>
                    <TableHead className="hidden md:table-cell">End Date</TableHead>
                    <TableHead className="hidden sm:table-cell">Batch Size</TableHead>
                    <TableHead className="hidden lg:table-cell">Schedule Entries</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cohorts.map((cohort) => (
                    <TableRow key={cohort.id}>
                      <TableCell className="font-medium max-w-xs truncate" title={cohort.name}>{cohort.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {formatDate(cohort.startDate)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {formatDate(cohort.endDate)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{cohort.batchSize}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{cohort.schedule?.length || 0}</TableCell>
                      <TableCell className="text-right space-x-1 sm:space-x-2">
                        <Button variant="outline" size="sm" onClick={() => openScheduleDialog(cohort)}>
                          <CalendarRange className="mr-1 h-3.5 w-3.5" /> Manage Schedule
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportScheduleToCSV(cohort)} disabled={!cohort.schedule || cohort.schedule.length === 0}>
                            <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCohortForSchedule && (
        <Dialog open={isScheduleDialogOpen} onOpenChange={(isOpen) => {
            if(!isOpen) {
                setSelectedCohortForSchedule(null); // Clear selected cohort when dialog closes
            }
            setIsScheduleDialogOpen(isOpen);
        }}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl">Manage Schedule for: {selectedCohortForSchedule.name}</DialogTitle>
              <DialogDescription>Add, edit, or remove schedule entries for this cohort.</DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleScheduleSubmit(handleSaveSchedule)} className="flex-grow overflow-hidden flex flex-col">
              <div className="flex-grow overflow-y-auto pr-2 space-y-4 py-4">
                {scheduleFields.map((field, index) => (
                  <Card key={field.id} className="p-4 space-y-3 bg-muted/30">
                    <div className="flex justify-between items-center">
                        <h4 className="font-semibold text-sm">Entry {index + 1}</h4>
                        <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive h-7 w-7" onClick={() => removeScheduleEntry(index)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Controller name={`schedule.${index}.date`} control={scheduleControl} render={({ field: controllerField }) => (
                            <div><Label>Date</Label><Input type="date" {...controllerField} className="text-xs" /></div> )}/>
                        <Controller name={`schedule.${index}.day`} control={scheduleControl} render={({ field: controllerField }) => (
                            <div><Label>Day</Label><Input {...controllerField} placeholder="e.g., Day 1 or Mon" className="text-xs" /></div> )}/>
                        <Controller name={`schedule.${index}.time`} control={scheduleControl} render={({ field: controllerField }) => (
                             <div><Label>Time</Label><Input {...controllerField} placeholder="e.g., 10 AM - 11 AM" className="text-xs" /></div> )}/>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Controller name={`schedule.${index}.category`} control={scheduleControl} render={({ field: controllerField }) => (
                            <div><Label>Category</Label><Input {...controllerField} placeholder="e.g., Input Session" className="text-xs" /></div> )}/>
                        <Controller name={`schedule.${index}.topicActivity`} control={scheduleControl} render={({ field: controllerField }) => (
                            <div><Label>Topic/Activity</Label><Input {...controllerField} placeholder="e.g., Design Thinking" className="text-xs" /></div> )}/>
                    </div>
                    <Controller name={`schedule.${index}.content`} control={scheduleControl} render={({ field: controllerField }) => (
                        <div><Label>Content (Optional)</Label><Textarea {...controllerField} placeholder="Brief description..." rows={2} className="text-xs" /></div> )}/>
                    <Controller name={`schedule.${index}.speakerVenue`} control={scheduleControl} render={({ field: controllerField }) => (
                         <div><Label>Speaker/Venue (Optional)</Label><Input {...controllerField} placeholder="e.g., John Doe / Seminar Hall" className="text-xs" /></div> )}/>
                    {scheduleErrors.schedule?.[index] && <p className="text-xs text-destructive">Please fill all required fields for this entry.</p>}
                  </Card>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => appendScheduleEntry({ id: nanoid(), date: '', day: '', time: '', category: '', topicActivity: '', content: '', speakerVenue: '' })}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Schedule Entry
                </Button>
              </div>
              <DialogFooter className="pt-4 border-t mt-auto">
                 <Button type="button" variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>Cancel</Button>
                 <Button type="submit" disabled={isSubmittingSchedule}>
                    {isSubmittingSchedule ? <LoadingSpinner className="mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Schedule
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
