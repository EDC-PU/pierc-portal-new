
'use client';

import { useEffect, useState } from 'react';
import type { Cohort, UserProfile } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { CreateCohortForm, type CreateCohortFormData } from '@/components/admin/CreateCohortForm';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { createCohortFS, getAllCohortsStream } from '@/lib/firebase/firestore';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { PlusCircle, Users, CalendarRange } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';

export default function ManageCohortsPage() {
  const { userProfile, loading: authLoading, initialLoadComplete } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loadingCohorts, setLoadingCohorts] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCohort, setEditingCohort] = useState<Cohort | null>(null); // For future editing

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
        setCohorts(fetchedCohorts);
        setLoadingCohorts(false);
      });
      return () => unsubscribe();
    }
  }, [userProfile]);

  const handleFormSubmitSuccess = () => {
    setIsFormOpen(false);
    setEditingCohort(null); // Reset editing state
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
            // await updateCohortFS(editingCohort.id, data, userProfile);
            toast({title: "Update Not Implemented", description: "Cohort update functionality is coming soon.", variant: "default"});
        } else {
            await createCohortFS(data, userProfile);
        }
    } catch (error: any) {
        toast({ title: "Save Error", description: error.message || "Could not save cohort.", variant: "destructive"});
        throw error;
    }
  };

  const openNewForm = () => {
    setEditingCohort(null);
    setIsFormOpen(true);
  };
  
  const formatDate = (timestamp: Timestamp | Date | undefined): string => {
    if (!timestamp) return 'N/A';
    const date = (timestamp as Timestamp)?.toDate ? (timestamp as Timestamp).toDate() : (timestamp as Date);
    return format(date, 'MMM d, yyyy');
  };

  if (authLoading || !initialLoadComplete || loadingCohorts) {
    return <div className="flex justify-center items-center h-screen"><LoadingSpinner size={48} /></div>;
  }
  if (userProfile?.role !== 'ADMIN_FACULTY') {
    // This state should ideally be caught by the useEffect redirect
    return <div className="flex justify-center items-center h-screen"><p>Access Denied. Redirecting...</p></div>;
  }

  return (
    <div className="space-y-8 animate-slide-in-up p-4 md:p-6 lg:p-8">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center">
          <Users className="h-10 w-10 text-primary mr-3" />
          <div>
            <h1 className="text-3xl font-headline font-bold">Manage Cohorts</h1>
            <p className="text-muted-foreground">Create, view, and manage incubation cohorts.</p>
          </div>
        </div>
        <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
            setIsFormOpen(isOpen);
            if (!isOpen) {
                setEditingCohort(null);
            }
        }}>
          <DialogTrigger asChild>
            <Button onClick={openNewForm}>
              <PlusCircle className="mr-2 h-5 w-5" /> Create New Cohort
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl">
                {editingCohort ? 'Edit Cohort' : 'Create New Cohort'}
              </DialogTitle>
            </DialogHeader>
            {isFormOpen && userProfile && ( // Ensure userProfile is passed
                 <CreateCohortForm
                    currentUserProfile={userProfile} 
                    initialData={editingCohort}
                    onSubmitSuccess={handleFormSubmitSuccess}
                    onSave={handleSaveCohort}
                />
            )}
          </DialogContent>
        </Dialog>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Existing Cohorts</CardTitle>
          <CardDescription>List of all created cohorts. Future actions: edit, delete, assign ideas.</CardDescription>
        </CardHeader>
        <CardContent>
          {cohorts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No cohorts found. Create one to get started!</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Cohort Name</TableHead>
                    <TableHead className="hidden md:table-cell">Start Date</TableHead>
                    <TableHead className="hidden md:table-cell">End Date</TableHead>
                    <TableHead className="hidden sm:table-cell">Batch Size</TableHead>
                    <TableHead className="hidden lg:table-cell">Ideas Assigned</TableHead>
                    {/* <TableHead className="text-right">Actions</TableHead> */}
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
                      <TableCell className="hidden lg:table-cell text-sm">{cohort.ideaIds?.length || 0}</TableCell>
                      {/* <TableCell className="text-right space-x-1 sm:space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingCohort(cohort); setIsFormOpen(true); }} title="Edit (Coming Soon)" disabled>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Delete (Coming Soon)" className="text-destructive hover:text-destructive hover:bg-destructive/10" disabled>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell> */}
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
