
'use client';

import { useEffect, useState } from 'react';
import type { Cohort, UserProfile, CohortScheduleEntry, IdeaSubmission } from '@/types'; // Added IdeaSubmission
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { CreateCohortForm, type CohortFormInternalData } from '@/components/admin/CreateCohortForm'; // Updated import type
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'; // Added DialogTrigger
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createCohortFS, getAllCohortsStream, updateCohortScheduleFS, getIdeaById, updateCohortFS } from '@/lib/firebase/firestore'; // Added updateCohortFS & getIdeaById
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { format, isValid } from 'date-fns';
import { PlusCircle, Users, CalendarRange, Edit3, Trash2, FileText, Download, Save } from 'lucide-react';
import { Timestamp } from 'firebase/firestore'; // Correctly import Timestamp
import type { Timestamp as FirestoreTimestamp } from 'firebase/firestore'; // Use FirestoreTimestamp for type clarity if needed
import { useForm, useFieldArray, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { nanoid } from 'nanoid';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as XLSX from 'xlsx';


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

const scheduleCategories = [
  "Input Session",
  "Lunch Break",
  "Activity",
  "Break",
  "Mentoring Session",
  "Group Work",
  "Presentation",
  "Valedictory Ceremony",
];

const dayOptions = Array.from({ length: 15 }, (_, i) => `Day-${i + 1}`);

interface DetailedCohort extends Cohort {
  participantNames: string[];
  totalParticipants: number;
}

export default function ManageCohortsPage() {
  const { userProfile, loading: authLoading, initialLoadComplete } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [cohorts, setCohorts] = useState<Cohort[]>([]); // Raw cohorts from stream
  const [detailedCohorts, setDetailedCohorts] = useState<DetailedCohort[]>([]); // Cohorts augmented with idea details
  const [loadingCohorts, setLoadingCohorts] = useState(true);
  const [loadingIdeaDetails, setLoadingIdeaDetails] = useState(false);
  const [isCohortFormOpen, setIsCohortFormOpen] = useState(false); // Renamed from isCreateFormOpen
  const [editingCohort, setEditingCohort] = useState<Cohort | null>(null);

  const [selectedCohortForSchedule, setSelectedCohortForSchedule] = useState<Cohort | null>(null);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);

  const { control: scheduleControl, handleSubmit: handleScheduleSubmit, reset: resetScheduleForm, formState: { errors: scheduleErrors, isSubmitting: isSubmittingSchedule } } = useForm<CohortScheduleFormData>({
    resolver: zodResolver(cohortScheduleFormSchema),
    defaultValues: { schedule: [] },
  });

  const { fields: scheduleFields, append: appendScheduleEntry, remove: removeScheduleEntry } = useFieldArray({
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
      const unsubscribe = getAllCohortsStream(async (fetchedCohorts) => {
        const mappedCohorts = fetchedCohorts.map(c => ({ ...c, schedule: c.schedule || [] }));
        setCohorts(mappedCohorts); // Set raw cohorts
        setLoadingCohorts(false);

        if (mappedCohorts.length > 0) {
            setLoadingIdeaDetails(true);
            const ideaIdsToFetch = new Set<string>();
            mappedCohorts.forEach(cohort => {
                (cohort.ideaIds || []).forEach(id => ideaIdsToFetch.add(id));
            });

            const ideasMap = new Map<string, { applicantName: string, participantCount: number }>();
            if (ideaIdsToFetch.size > 0) {
                const ideaPromises = Array.from(ideaIdsToFetch).map(id =>
                    getIdeaById(id).then(ideaDoc => {
                        if (ideaDoc) {
                            const participantCount = 1 + (ideaDoc.structuredTeamMembers?.length || 0);
                            ideasMap.set(id, {
                                applicantName: ideaDoc.applicantDisplayName || 'Unknown Applicant',
                                participantCount: participantCount
                            });
                        }
                    }).catch(err => console.error(`Failed to fetch idea ${id}`, err))
                );
                await Promise.all(ideaPromises);
            }

            const newDetailedCohortsData = mappedCohorts.map(cohort => {
                let totalParticipants = 0;
                const participantNames: string[] = [];
                (cohort.ideaIds || []).forEach(ideaId => {
                    const ideaDetail = ideasMap.get(ideaId);
                    if (ideaDetail) {
                        participantNames.push(ideaDetail.applicantName);
                        totalParticipants += ideaDetail.participantCount;
                    }
                });
                return { ...cohort, participantNames, totalParticipants };
            });
            setDetailedCohorts(newDetailedCohortsData);
            setLoadingIdeaDetails(false);
        } else {
            setDetailedCohorts([]);
            setLoadingIdeaDetails(false);
        }
      });
      return () => unsubscribe();
    }
  }, [userProfile]);


  useEffect(() => {
    if (selectedCohortForSchedule) {
      const scheduleToReset = (selectedCohortForSchedule.schedule || []).map(entry => ({
        ...entry,
        date: entry.date ? (entry.date.includes('T') ? entry.date.split('T')[0] : entry.date) : '',
      }));
      resetScheduleForm({ schedule: scheduleToReset });
    } else {
      resetScheduleForm({ schedule: [] });
    }
  }, [selectedCohortForSchedule, resetScheduleForm]);


  const handleCohortFormSubmitSuccess = () => {
    setIsCohortFormOpen(false);
    setEditingCohort(null); // Reset editing state
    toast({ title: "Success", description: editingCohort ? "Cohort updated successfully." : "Cohort created successfully." });
  };

  // This function is now called by CreateCohortForm with CohortFormInternalData
  const handleSaveCohort = async (data: CohortFormInternalData) => {
    if (!userProfile) {
        toast({ title: "Authentication Error", description: "Admin profile not found.", variant: "destructive" });
        throw new Error("Admin profile not found");
    }
    
    // Convert Date objects to Timestamps before saving
    const dataToSaveWithTimestamps = {
      name: data.name,
      startDate: Timestamp.fromDate(data.startDate),
      endDate: Timestamp.fromDate(data.endDate),
      batchSize: data.batchSize,
    };

    try {
        if (editingCohort && editingCohort.id) {
            await updateCohortFS(editingCohort.id, dataToSaveWithTimestamps, userProfile);
        } else {
            await createCohortFS(dataToSaveWithTimestamps, userProfile);
        }
        handleCohortFormSubmitSuccess(); // Call success handler here after successful save
    } catch (error: any) {
        toast({ title: "Save Error", description: error.message || "Could not save cohort.", variant: "destructive"});
        throw error; // Re-throw to be handled by the form if needed, or caught by its own try-catch
    }
  };
  
  const onSaveScheduleSubmit: SubmitHandler<CohortScheduleFormData> = async (data) => {
    if (!selectedCohortForSchedule || !selectedCohortForSchedule.id || !userProfile) {
        toast({title: "Error", description: "No cohort selected or admin profile missing.", variant: "destructive"});
        return;
    }
    try {
        await updateCohortScheduleFS(selectedCohortForSchedule.id, data.schedule, userProfile);
        toast({title: "Schedule Saved", description: `Schedule for ${selectedCohortForSchedule.name} updated.`});
        
        setDetailedCohorts(prevDetailedCohorts => prevDetailedCohorts.map(dc => 
            dc.id === selectedCohortForSchedule.id ? {...dc, schedule: data.schedule} : dc
        ));
        
        setIsScheduleDialogOpen(false);
    } catch (error: any) {
        toast({ title: "Save Schedule Error", description: error.message || "Could not save cohort schedule.", variant: "destructive"});
    }
  };

  const openNewCreateForm = () => {
    setEditingCohort(null);
    setIsCohortFormOpen(true);
  };

  const openEditForm = (cohort: Cohort) => {
    setEditingCohort(cohort);
    setIsCohortFormOpen(true);
  };

  const openScheduleDialog = (cohort: DetailedCohort) => {
    setSelectedCohortForSchedule(cohort);
    setIsScheduleDialogOpen(true);
  };
  
  const formatDateForDisplay = (timestampOrDateString: FirestoreTimestamp | Date | string | undefined): string => {
    if (!timestampOrDateString) return 'N/A';
    
    let dateToFormat: Date;
    if ((timestampOrDateString as FirestoreTimestamp)?.toDate) {
      dateToFormat = (timestampOrDateString as FirestoreTimestamp).toDate();
    } else if (timestampOrDateString instanceof Date) {
      dateToFormat = timestampOrDateString;
    } else if (typeof timestampOrDateString === 'string') {
        const parts = timestampOrDateString.split('-');
        if (parts.length === 3) {
            dateToFormat = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
        } else {
            dateToFormat = new Date(timestampOrDateString);
        }
    } else {
        return 'Invalid Date Input';
    }
    
    if (!isValid(dateToFormat)) return 'Invalid Date';
    return format(dateToFormat, 'MMM d, yyyy');
  };


  const exportScheduleToXLSX = (cohort: DetailedCohort) => {
    if (!cohort.schedule || cohort.schedule.length === 0) {
      toast({ title: "No Schedule Data", description: "This cohort has no schedule to export.", variant: "default" });
      return;
    }

    const headers = ["Date", "Day", "Time", "Category", "Topic/Activity", "Content", "Speaker/Venue"];
    let previousDate: string | null = null;

    const dataForSheet = cohort.schedule.map(entry => {
      const displayDate = entry.date === previousDate ? "" : entry.date;
      previousDate = entry.date; 
      return {
        "Date": displayDate,
        "Day": entry.day,
        "Time": entry.time,
        "Category": entry.category,
        "Topic/Activity": entry.topicActivity,
        "Content": entry.content || '',
        "Speaker/Venue": entry.speakerVenue || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataForSheet, { header: headers });
    
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const thinBorderStyle = { style: "thin", color: { auto: 1 } };
    const cellBorder = {
      top: thinBorderStyle,
      bottom: thinBorderStyle,
      left: thinBorderStyle,
      right: thinBorderStyle
    };

    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_address = XLSX.utils.encode_cell({ c: C, r: R });
        if (!worksheet[cell_address]) worksheet[cell_address] = { t: 's', v: '' };
        if (!worksheet[cell_address].s) worksheet[cell_address].s = {};
        worksheet[cell_address].s.border = cellBorder;
      }
    }

    const wscols = [
        { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 20 },
        { wch: 30 }, { wch: 40 }, { wch: 25 },
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Schedule");
    XLSX.writeFile(workbook, `${cohort.name}_schedule.xlsx`);
    toast({ title: "Export Successful", description: `Schedule for ${cohort.name} downloaded as XLSX.` });
  };


  if (authLoading || !initialLoadComplete || loadingCohorts || (cohorts.length > 0 && loadingIdeaDetails)) {
    return <div className="flex justify-center items-center h-screen"><LoadingSpinner size={48} /> <span className="ml-2 text-muted-foreground">Loading cohorts data...</span></div>;
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
        <Dialog open={isCohortFormOpen} onOpenChange={(isOpen) => {
            setIsCohortFormOpen(isOpen);
            if (!isOpen) {
                setEditingCohort(null); // Reset editing state when dialog closes
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
            {isCohortFormOpen && userProfile && ( 
                 <CreateCohortForm
                    initialData={editingCohort}
                    onSubmitSuccess={handleCohortFormSubmitSuccess} // This will be called by onSave after success
                    onSave={handleSaveCohort} // Pass the combined save handler
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
          {detailedCohorts.length === 0 && !loadingCohorts && !loadingIdeaDetails ? (
            <p className="text-center text-muted-foreground py-8">No cohorts found. Create one to get started!</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Cohort Name</TableHead>
                    <TableHead className="hidden lg:table-cell min-w-[200px]">Assigned Leaders</TableHead>
                    <TableHead className="hidden lg:table-cell">Participants</TableHead>
                    <TableHead className="hidden md:table-cell">Max Teams</TableHead>
                    <TableHead className="hidden xl:table-cell">Schedule Entries</TableHead>
                    <TableHead className="hidden md:table-cell">Start Date</TableHead>
                    <TableHead className="hidden md:table-cell">End Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailedCohorts.map((cohort) => (
                    <TableRow key={cohort.id}>
                      <TableCell className="font-medium max-w-xs truncate" title={cohort.name}>{cohort.name}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs max-w-[200px] truncate" title={cohort.participantNames.join(', ')}>
                        {cohort.participantNames.length > 0 ? cohort.participantNames.join(', ') : 'N/A'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{cohort.totalParticipants}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{cohort.batchSize}</TableCell>
                      <TableCell className="hidden xl:table-cell text-sm">{cohort.schedule?.length || 0}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {formatDateForDisplay(cohort.startDate)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {formatDateForDisplay(cohort.endDate)}
                      </TableCell>
                      <TableCell className="text-right space-x-1 sm:space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditForm(cohort)} title="Edit Cohort">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openScheduleDialog(cohort)}>
                          <CalendarRange className="mr-1 h-3.5 w-3.5" /> Manage Schedule
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportScheduleToXLSX(cohort)} disabled={!cohort.schedule || cohort.schedule.length === 0}>
                            <Download className="mr-1 h-3.5 w-3.5" /> Export XLSX
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
                setSelectedCohortForSchedule(null); 
            }
            setIsScheduleDialogOpen(isOpen);
        }}>
          <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl">Manage Schedule for: {selectedCohortForSchedule.name}</DialogTitle>
              <DialogDescription>Add, edit, or remove schedule entries for this cohort.</DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleScheduleSubmit(onSaveScheduleSubmit)} className="flex-grow overflow-hidden flex flex-col">
              <ScrollArea className="flex-grow overflow-y-auto pr-2 py-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[130px]">Date</TableHead>
                      <TableHead className="w-[120px]">Day</TableHead>
                      <TableHead className="w-[150px]">Time</TableHead>
                      <TableHead className="w-[200px]">Category</TableHead>
                      <TableHead className="min-w-[200px]">Topic/Activity</TableHead>
                      <TableHead className="min-w-[200px]">Content</TableHead>
                      <TableHead className="w-[180px]">Speaker/Venue</TableHead>
                      <TableHead className="w-[50px] text-right">Del</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scheduleFields.map((field, index) => (
                      <TableRow key={field.id}>
                        <TableCell className="p-1">
                          <Controller name={`schedule.${index}.date`} control={scheduleControl} render={({ field: controllerField }) => (
                            <Input type="date" {...controllerField} className="text-xs h-9"/> )}/>
                            {scheduleErrors.schedule?.[index]?.date && <p className="text-xs text-destructive mt-0.5">{scheduleErrors.schedule[index]?.date?.message}</p>}
                        </TableCell>
                        <TableCell className="p-1">
                           <Controller
                            name={`schedule.${index}.day`}
                            control={scheduleControl}
                            render={({ field: controllerField }) => (
                              <Select onValueChange={controllerField.onChange} value={controllerField.value} >
                                <SelectTrigger className="text-xs h-9">
                                  <SelectValue placeholder="Select Day" />
                                </SelectTrigger>
                                <SelectContent>
                                  {dayOptions.map((day) => (
                                    <SelectItem key={day} value={day} className="text-xs">
                                      {day}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          {scheduleErrors.schedule?.[index]?.day && <p className="text-xs text-destructive mt-0.5">{scheduleErrors.schedule[index]?.day?.message}</p>}
                        </TableCell>
                        <TableCell className="p-1">
                          <Controller name={`schedule.${index}.time`} control={scheduleControl} render={({ field: controllerField }) => (
                             <Input {...controllerField} placeholder="e.g., 10 AM - 11 AM" className="text-xs h-9"/> )}/>
                             {scheduleErrors.schedule?.[index]?.time && <p className="text-xs text-destructive mt-0.5">{scheduleErrors.schedule[index]?.time?.message}</p>}
                        </TableCell>
                        <TableCell className="p-1">
                          <Controller
                            name={`schedule.${index}.category`}
                            control={scheduleControl}
                            render={({ field: controllerField }) => (
                              <Select onValueChange={controllerField.onChange} value={controllerField.value} >
                                <SelectTrigger className="text-xs h-9">
                                  <SelectValue placeholder="Select Category" />
                                </SelectTrigger>
                                <SelectContent>
                                  {scheduleCategories.map((cat) => (
                                    <SelectItem key={cat} value={cat} className="text-xs">
                                      {cat}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          {scheduleErrors.schedule?.[index]?.category && <p className="text-xs text-destructive mt-0.5">{scheduleErrors.schedule[index]?.category?.message}</p>}
                        </TableCell>
                        <TableCell className="p-1">
                          <Controller name={`schedule.${index}.topicActivity`} control={scheduleControl} render={({ field: controllerField }) => (
                            <Input {...controllerField} placeholder="e.g., Design Thinking" className="text-xs h-9"/> )}/>
                            {scheduleErrors.schedule?.[index]?.topicActivity && <p className="text-xs text-destructive mt-0.5">{scheduleErrors.schedule[index]?.topicActivity?.message}</p>}
                        </TableCell>
                        <TableCell className="p-1">
                          <Controller name={`schedule.${index}.content`} control={scheduleControl} render={({ field: controllerField }) => (
                            <Textarea {...controllerField} placeholder="Brief description..." rows={1} className="text-xs min-h-[2.25rem]"/> )}/>
                        </TableCell>
                        <TableCell className="p-1">
                          <Controller name={`schedule.${index}.speakerVenue`} control={scheduleControl} render={({ field: controllerField }) => (
                            <Input {...controllerField} placeholder="e.g., John Doe / Hall 1" className="text-xs h-9"/> )}/>
                        </TableCell>
                        <TableCell className="p-1 text-right">
                          <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive h-8 w-8" onClick={() => removeScheduleEntry(index)}>
                              <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => appendScheduleEntry({ id: nanoid(), date: '', day: '', time: '', category: '', topicActivity: '', content: '', speakerVenue: '' })}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Schedule Entry
                </Button>
              </ScrollArea>
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

