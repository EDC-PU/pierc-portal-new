'use client';

import { useEffect, useState } from 'react';
import type { Announcement, UserProfile } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { AnnouncementForm } from '@/components/admin/AnnouncementForm';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { createAnnouncement, getAllAnnouncementsForAdminStream, updateAnnouncement, deleteAnnouncement } from '@/lib/firebase/firestore';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { PlusCircle, Edit3, Trash2, AlertTriangle, Megaphone } from 'lucide-react';
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

export default function ManageAnnouncementsPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
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
      const unsubscribe = getAllAnnouncementsForAdminStream((fetchedAnnouncements) => {
        setAnnouncements(fetchedAnnouncements);
        setLoadingAnnouncements(false);
      });
      return () => unsubscribe();
    }
  }, [userProfile]);

  const handleFormSubmitSuccess = () => {
    setIsFormOpen(false);
    setEditingAnnouncement(null);
    toast({ title: "Success", description: editingAnnouncement ? "Announcement updated successfully." : "Announcement created successfully." });
  };

  const handleSaveAnnouncement = async (data: Omit<Announcement, 'id'|'createdAt'|'updatedAt'|'createdByUid'|'creatorDisplayName'>, creatorUid: string, creatorName: string | null) => {
    try {
        if (editingAnnouncement && editingAnnouncement.id) {
            await updateAnnouncement(editingAnnouncement.id, { ...data, createdByUid: creatorUid, creatorDisplayName: creatorName });
        } else {
            await createAnnouncement({ ...data, createdByUid: creatorUid, creatorDisplayName: creatorName });
        }
    } catch (error: any) {
        toast({ title: "Save Error", description: error.message || "Could not save announcement.", variant: "destructive"});
        throw error; // Re-throw to indicate failure to form
    }
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    try {
      await deleteAnnouncement(announcementId);
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

  if (authLoading || loadingAnnouncements) {
    return <div className="flex justify-center items-center h-full"><LoadingSpinner size={48} /></div>;
  }
  if (userProfile?.role !== 'ADMIN_FACULTY') {
    return <div className="flex justify-center items-center h-full"><p>Access Denied.</p></div>;
  }

  return (
    <div className="space-y-8 animate-slide-in-up">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center">
          <Megaphone className="h-10 w-10 text-primary mr-3" />
          <div>
            <h1 className="text-3xl font-headline font-bold">Manage Announcements</h1>
            <p className="text-muted-foreground">Create, edit, and oversee all portal announcements.</p>
          </div>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
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
            <AnnouncementForm
              currentUserProfile={userProfile}
              initialData={editingAnnouncement}
              onSubmitSuccess={handleFormSubmitSuccess}
              onSave={handleSaveAnnouncement}
            />
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {announcements.map((ann) => (
                  <TableRow key={ann.id}>
                    <TableCell className="font-medium max-w-xs truncate">{ann.title}</TableCell>
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
                    <TableCell className="text-right space-x-2">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
