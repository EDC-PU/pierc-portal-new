
'use client';

import { useState, useEffect } from 'react';
import type { PortalEvent, UserProfile } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { EventForm, type EventFormData } from '@/components/admin/EventForm';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { createEventFS, getAllEventsStream, updateEventFS, deleteEventFS, getProfilesForUids } from '@/lib/firebase/firestore';
import { uploadEventFlyer } from '@/ai/flows/upload-event-flyer-flow';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { PlusCircle, Edit, Trash2, CalendarCheck, AlertTriangle, Users } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger as AlertDialogButtonTrigger,
} from "@/components/ui/alert-dialog";
import type { Timestamp } from 'firebase/firestore';
import Link from 'next/link';

export default function ManageEventsPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [events, setEvents] = useState<PortalEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PortalEvent | null>(null);

  const [isRsvpModalOpen, setIsRsvpModalOpen] = useState(false);
  const [selectedEventForRsvps, setSelectedEventForRsvps] = useState<PortalEvent | null>(null);
  const [rsvpUsers, setRsvpUsers] = useState<UserProfile[]>([]);
  const [loadingRsvps, setLoadingRsvps] = useState(false);


  useEffect(() => {
    if (!authLoading && userProfile?.role !== 'ADMIN_FACULTY') {
      toast({ title: "Access Denied", description: "You are not authorized to view this page.", variant: "destructive" });
      router.push('/dashboard');
    }
  }, [userProfile, authLoading, router, toast]);

  useEffect(() => {
    if (userProfile?.role === 'ADMIN_FACULTY') {
      setLoadingEvents(true);
      const unsubscribe = getAllEventsStream((fetchedEvents) => {
        setEvents(fetchedEvents);
        setLoadingEvents(false);
      });
      return () => unsubscribe();
    }
  }, [userProfile]);

  const handleFormSubmitSuccess = () => {
    setIsFormOpen(false);
    setEditingEvent(null);
    toast({ title: "Success", description: editingEvent ? "Event updated successfully." : "Event created successfully." });
  };
  
  const fileToDataUri = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  
  const handleSaveEvent = async (formData: EventFormData) => {
    if (!userProfile) throw new Error("Admin profile not found");
    
    let flyerUploadResult: { flyerUrl: string | null; flyerFileName: string | null } = {
        flyerUrl: editingEvent?.flyerUrl || null,
        flyerFileName: editingEvent?.flyerFileName || null
    };

    if (formData.flyerFile) {
        try {
            const fileDataUri = await fileToDataUri(formData.flyerFile);
            flyerUploadResult = await uploadEventFlyer({
                eventName: formData.title,
                fileName: formData.flyerFile.name,
                fileDataUri: fileDataUri,
            });
        } catch (uploadError) {
            toast({ title: "Flyer Upload Failed", description: "Could not upload the event flyer. Please try again.", variant: "destructive" });
            throw uploadError;
        }
    } else if (editingEvent?.flyerUrl && formData.flyerFile === null) {
        flyerUploadResult = { flyerUrl: null, flyerFileName: null };
    }


    const dataToSave: Omit<PortalEvent, 'id' | 'createdAt' | 'updatedAt' | 'createdByUid' | 'creatorDisplayName' | 'rsvps' | 'rsvpCount'> = {
        title: formData.title,
        description: formData.description,
        location: formData.location,
        category: formData.category,
        startDateTime: Timestamp.fromDate(formData.startDateTime),
        endDateTime: Timestamp.fromDate(formData.endDateTime),
        flyerUrl: flyerUploadResult.flyerUrl,
        flyerFileName: flyerUploadResult.flyerFileName,
    };

    try {
        if (editingEvent?.id) {
            await updateEventFS(editingEvent.id, dataToSave, userProfile);
        } else {
            await createEventFS(dataToSave, userProfile);
        }
    } catch (error: any) {
        toast({ title: "Save Error", description: error.message || "Could not save event.", variant: "destructive" });
        throw error;
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!userProfile) return;
    try {
      await deleteEventFS(eventId, userProfile);
      toast({ title: "Event Deleted", description: "The event has been removed." });
    } catch (error) {
      toast({ title: "Delete Error", description: "Could not delete the event.", variant: "destructive" });
    }
  };

  const openEditForm = (event: PortalEvent) => {
    setEditingEvent(event);
    setIsFormOpen(true);
  };

  const openNewForm = () => {
    setEditingEvent(null);
    setIsFormOpen(true);
  };
  
  const formatDate = (timestamp: Timestamp) => format(timestamp.toDate(), 'MMM d, yyyy, h:mm a');

  const handleViewRsvps = async (event: PortalEvent) => {
    if (!userProfile?.isSuperAdmin) {
        toast({ title: "Access Denied", description: "Only Super Admins can view attendee lists.", variant: "default" });
        return;
    }
    if (event.rsvpCount === 0) {
        toast({ title: "No RSVPs", description: "There are no RSVPs for this event yet.", variant: "default" });
        return;
    }
    setSelectedEventForRsvps(event);
    setIsRsvpModalOpen(true);
    setLoadingRsvps(true);
    try {
        const profiles = await getProfilesForUids(event.rsvps);
        setRsvpUsers(profiles);
    } catch (error) {
        console.error("Failed to fetch RSVP profiles:", error);
        toast({ title: "Error", description: "Could not load the list of attendees.", variant: "destructive"});
    } finally {
        setLoadingRsvps(false);
    }
  };


  if (authLoading || loadingEvents) {
    return <div className="flex justify-center items-center h-screen"><LoadingSpinner size={48} /></div>;
  }
  if (userProfile?.role !== 'ADMIN_FACULTY') {
    return <div className="flex justify-center items-center h-screen"><p>Access Denied. Redirecting...</p></div>;
  }

  return (
    <div className="space-y-8 animate-slide-in-up p-4 md:p-6 lg:p-8">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center">
          <CalendarCheck className="h-10 w-10 text-primary mr-3" />
          <div>
            <h1 className="text-3xl font-headline font-bold">Manage Events</h1>
            <p className="text-muted-foreground">Create, edit, and oversee all portal events and workshops.</p>
          </div>
        </div>
        <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
            if (!isOpen) setEditingEvent(null);
            setIsFormOpen(isOpen);
        }}>
          <DialogTrigger asChild>
            <Button onClick={openNewForm}>
              <PlusCircle className="mr-2 h-5 w-5" /> Create New Event
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl">
                {editingEvent ? 'Edit Event' : 'Create New Event'}
              </DialogTitle>
            </DialogHeader>
            {isFormOpen && userProfile && (
                <EventForm
                    initialData={editingEvent}
                    onSave={handleSaveEvent}
                    onSubmitSuccess={handleFormSubmitSuccess}
                />
            )}
          </DialogContent>
        </Dialog>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Existing Events</CardTitle>
          <CardDescription>List of all created events. Click to edit or delete.</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No events found. Create one!</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>RSVPs</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium max-w-xs truncate" title={event.title}>{event.title}</TableCell>
                      <TableCell className="text-sm capitalize">{event.category.toLowerCase().replace('_', ' ')}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(event.startDateTime)}</TableCell>
                      <TableCell className="text-sm">{event.location}</TableCell>
                      <TableCell className="text-sm">
                         {userProfile.isSuperAdmin ? (
                            <Button
                                variant="link"
                                className="p-0 h-auto text-sm"
                                onClick={() => handleViewRsvps(event)}
                                disabled={event.rsvpCount === 0}
                            >
                                {event.rsvpCount}
                            </Button>
                         ) : (
                            <span>{event.rsvpCount}</span>
                         )}
                      </TableCell>
                      <TableCell className="text-right space-x-1 sm:space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditForm(event)} title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogButtonTrigger asChild>
                            <Button variant="ghost" size="icon" title="Delete" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogButtonTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive" /> Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the event "{event.title}". This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteEvent(event.id!)} className="bg-destructive hover:bg-destructive/90">
                                Delete Event
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isRsvpModalOpen} onOpenChange={setIsRsvpModalOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5" />RSVPs for: {selectedEventForRsvps?.title}</DialogTitle>
                <DialogDescription>
                    {selectedEventForRsvps?.rsvpCount} user(s) have RSVP'd for this event.
                </DialogDescription>
            </DialogHeader>
            <div className="py-2 max-h-80 overflow-y-auto">
                {loadingRsvps ? (
                    <div className="flex items-center justify-center h-24">
                        <LoadingSpinner size={28}/>
                    </div>
                ) : rsvpUsers.length > 0 ? (
                    <ul className="space-y-2">
                        {rsvpUsers.map(user => (
                            <li key={user.uid} className="flex items-center justify-between text-sm p-2 rounded-md hover:bg-muted/50">
                                <div>
                                    <p className="font-medium">{user.displayName || user.fullName || 'Unknown User'}</p>
                                    <p className="text-xs text-muted-foreground">{user.email}</p>
                                </div>
                                <Button variant="ghost" size="sm" asChild>
                                  <Link href={`/dashboard/admin/manage-users?search=${user.email}`} passHref>
                                      View Profile
                                  </Link>
                                </Button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-center text-sm text-muted-foreground py-4">No attendee information found.</p>
                )}
            </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
