
'use client';

import { useEffect, useState } from 'react';
import type { Announcement, UserProfile, Cohort } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { AnnouncementForm, type AnnouncementFormData } from '@/components/admin/AnnouncementForm';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { createAnnouncement, getAllAnnouncementsForAdminStream, updateAnnouncement, deleteAnnouncement, getAllCohortsStream } from '@/lib/firebase/firestore';
import { uploadAnnouncementAttachment } from '@/lib/firebase/actions';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { PlusCircle, Edit3, Trash2, AlertTriangle, Megaphone, Download } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import ReactMarkdown from 'react-markdown';


export default function ManageAnnouncementsPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [loadingCohorts, setLoadingCohorts] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    if (!authLoading && userProfile?.role !== 'ADMIN_FACULTY') {
      toast({ title: "Access Denied", description: "You are not authorized to view this page.", variant: "destructive" });
      router.push('/dashboard');
    }
  }, [userProfile, authLoading, router, toast]);

  useEffect(() => {
    if (userProfile?.role === 'ADMIN_FACULTY') {
      setLoadingAnnouncements(true);
      const unsubscribeAnnouncements = getAllAnnouncementsForAdminStream((fetchedAnnouncements) => {
        setAnnouncements(fetchedAnnouncements);
        setLoadingAnnouncements(false);
      });

      setLoadingCohorts(true);
      const unsubscribeCohorts = getAllCohortsStream((fetchedCohorts) => {
        setCohorts(fetchedCohorts);
        setLoadingCohorts(false);
      });
      return () => {
        unsubscribeAnnouncements();
        unsubscribeCohorts();
      };
    }
  }, [userProfile]);

  const handleFormSubmitSuccess = () => {
    setIsFormOpen(false);
    setEditingAnnouncement(null);
    toast({ title: "Success", description: editingAnnouncement ? "Announcement updated successfully." : "Announcement created successfully." });
  };

  const handleSaveAnnouncement = async (formData: AnnouncementFormData) => {
    if (!userProfile) {
        toast({ title: "Authentication Error", description: "Admin profile not found.", variant: "destructive" });
        throw new Error("Admin profile not found");
    }

    let attachmentDetails: { attachmentURL: string | null; attachmentName: string | null } = {
        attachmentURL: editingAnnouncement?.attachmentURL || null,
        attachmentName: editingAnnouncement?.attachmentName || null
    };

    if (formData.attachmentFile) {
      try {
        const fileToDataUri = (file: File): Promise<string> =>
            new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        const fileDataUri = await fileToDataUri(formData.attachmentFile);
        attachmentDetails = await uploadAnnouncementAttachment({
            announcementTitle: formData.title,
            fileName: formData.attachmentFile.name,
            fileDataUri: fileDataUri,
        });
      } catch (uploadError) {
          toast({ title: "Attachment Upload Failed", description: "Could not upload the attachment. Please try again.", variant: "destructive" });
          throw uploadError;
      }
    } else if (formData.attachmentFile === null) { 
        attachmentDetails = { attachmentURL: null, attachmentName: null };
    }

    const dataToSave: Omit<Announcement, 'id' | 'createdAt' | 'updatedAt'> = {
        title: formData.title,
        content: formData.content,
        isUrgent: formData.isUrgent,
        targetAudience: formData.targetAudience,
        cohortId: formData.targetAudience === 'SPECIFIC_COHORT' ? formData.cohortId : null,
        attachmentURL: attachmentDetails.attachmentURL,
        attachmentName: attachmentDetails.attachmentName,
        createdByUid: userProfile.uid,
        creatorDisplayName: userProfile.displayName || userProfile.fullName || 'Admin',
    };

    try {
        if (editingAnnouncement && editingAnnouncement.id) {
            await updateAnnouncement(editingAnnouncement.id, dataToSave, userProfile);
        } else {
            await createAnnouncement(dataToSave, userProfile);
        }
    } catch (error: any) {
        toast({ title: "Save Error", description: error.message || "Could not save announcement.", variant: "destructive"});
        throw error; 
    }
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (!userProfile) {
        toast({ title: "Authentication Error", description: "Admin profile not found.", variant: "destructive" });
        return;
    }
    try {
      await deleteAnnouncement(announcementId, userProfile);
      toast({ title: "Announcement Deleted", description: "The announcement has been removed." });
    } catch (error) {
      toast({ title: "Delete Error", description: "Could not delete announcement.", variant: "destructive" });
    }
  };

  const openEditForm = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setIsFormOpen(true);
  };

  const openNewForm = () => {
    setEditingAnnouncement(null);
    setIsFormOpen(true);
  };

  const getCohortNameById = (cohortId: string | null | undefined): string => {
    if (!cohortId) return 'N/A';
    const cohort = cohorts.find(c => c.id === cohortId);
    return cohort ? cohort.name : `ID: ${cohortId.substring(0,6)}...`;
  };

  if (authLoading || loadingAnnouncements || loadingCohorts) {
    return <div className="flex justify-center items-center h-screen"><LoadingSpinner size={48} /></div>;
  }
  if (userProfile?.role !== 'ADMIN_FACULTY') {
    return <div className="flex justify-center items-center h-screen"><p>Access Denied. Redirecting...</p></div>;
  }

  return (
    <div className="space-y-8 animate-slide-in-up p-4 md:p-6 lg:p-8">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center">
          <Megaphone className="h-10 w-10 text-primary mr-3" />
          <div>
            <h1 className="text-3xl font-headline font-bold">Manage Announcements</h1>
            <p className="text-muted-foreground">Create, edit, and oversee all portal announcements.</p>
          </div>
        </div>
        <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
            setIsFormOpen(isOpen);
            if (!isOpen) {
                setEditingAnnouncement(null);
            }
        }}>
          <DialogTrigger asChild>
            <Button onClick={openNewForm}>
              <PlusCircle className="mr-2 h-5 w-5" /> Create New
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl">
                {editingAnnouncement ? 'Edit Announcement' : 'Create New Announcement'}
              </DialogTitle>
            </DialogHeader>
            {isFormOpen && (
                 <AnnouncementForm
                    initialData={editingAnnouncement}
                    onSave={handleSaveAnnouncement}
                    onSubmitSuccess={handleFormSubmitSuccess}
                />
            )}
          </DialogContent>
        </Dialog>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Existing Announcements</CardTitle>
          <CardDescription>List of all current and past announcements. Click to edit or delete.</CardDescription>
        </CardHeader>
        <CardContent>
          {announcements.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No announcements found. Create one!</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Title</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Audience</TableHead>
                    <TableHead>Attachment</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.map((ann) => (
                    <TableRow key={ann.id}>
                      <TableCell className="font-medium max-w-xs truncate" title={ann.title}>{ann.title}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {ann.createdAt ? format(ann.createdAt.toDate(), 'MMM d, yyyy HH:mm') : 'N/A'}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {ann.isUrgent ? (
                          <Badge variant="destructive" className="flex items-center w-fit gap-1">
                            <AlertTriangle className="h-3 w-3" /> Urgent
                          </Badge>
                        ) : (
                          <Badge variant="secondary">General</Badge>
                        )}
                      </TableCell>
                       <TableCell className="hidden lg:table-cell text-sm">
                        {ann.targetAudience === 'SPECIFIC_COHORT' && ann.cohortId 
                          ? `Cohort: ${getCohortNameById(ann.cohortId)}` 
                          : 'All Users'}
                      </TableCell>
                       <TableCell className="text-sm">
                        {ann.attachmentURL ? (
                            <a href={ann.attachmentURL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                <Download className="h-4 w-4" /> View
                            </a>
                        ) : (
                            <span className="text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1 sm:space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditForm(ann)} title="Edit">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="Delete" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the announcement titled "{ann.title}".
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteAnnouncement(ann.id!)} className="bg-destructive hover:bg-destructive/90">
                                Delete
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
    </div>
  );
}
