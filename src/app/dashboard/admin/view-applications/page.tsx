
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getAllIdeaSubmissionsWithDetails, updateIdeaStatus } from '@/lib/firebase/firestore';
import type { IdeaSubmission, IdeaStatus } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText, Eye, Info } from 'lucide-react';
import { format } from 'date-fns';

const ideaStatuses: IdeaStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'IN_EVALUATION', 'SELECTED', 'NOT_SELECTED'];

export default function ViewApplicationsPage() {
  const { userProfile, loading: authLoading, initialLoadComplete } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [applications, setApplications] = useState<IdeaSubmission[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(true);
  const [selectedApplication, setSelectedApplication] = useState<IdeaSubmission | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    if (initialLoadComplete && !authLoading) {
      if (!userProfile) {
        router.push('/login');
        return;
      }
      if (userProfile.role !== 'ADMIN_FACULTY') {
        toast({ title: "Access Denied", description: "You are not authorized to view this page.", variant: "destructive" });
        router.push('/dashboard');
      } else {
        fetchApplications();
      }
    }
  }, [userProfile, authLoading, initialLoadComplete, router, toast]);

  const fetchApplications = async () => {
    setLoadingApplications(true);
    try {
      const fetchedApplications = await getAllIdeaSubmissionsWithDetails();
      setApplications(fetchedApplications);
    } catch (error) {
      console.error("Error fetching applications:", error);
      toast({ title: "Error", description: "Could not fetch incubation applications.", variant: "destructive" });
    } finally {
      setLoadingApplications(false);
    }
  };

  const handleStatusChange = async (ideaId: string, newStatus: IdeaStatus) => {
    try {
      await updateIdeaStatus(ideaId, newStatus);
      setApplications(prevApps =>
        prevApps.map(app => app.id === ideaId ? { ...app, status: newStatus, updatedAt: new Date() } : app)
      );
      toast({ title: "Status Updated", description: `Application status changed to ${newStatus.replace('_', ' ')}.` });
    } catch (error) {
      console.error("Error updating status:", error);
      toast({ title: "Update Error", description: "Could not update application status.", variant: "destructive" });
      fetchApplications(); 
    }
  };

  const getStatusBadgeVariant = (status: IdeaStatus) => {
    switch (status) {
      case 'SELECTED': return 'default';
      case 'SUBMITTED': return 'secondary';
      case 'UNDER_REVIEW': return 'outline';
      case 'IN_EVALUATION': return 'outline';
      case 'NOT_SELECTED': return 'destructive';
      default: return 'secondary';
    }
  };

  const openDetailModal = (application: IdeaSubmission) => {
    setSelectedApplication(application);
    setIsDetailModalOpen(true);
  };

  if (authLoading || !initialLoadComplete || loadingApplications) {
    return <div className="flex justify-center items-center h-screen"><LoadingSpinner size={48} /></div>;
  }

  if (!userProfile || userProfile.role !== 'ADMIN_FACULTY') {
    return <div className="flex justify-center items-center h-screen"><p>Verifying access or redirecting...</p></div>;
  }

  return (
    <div className="space-y-8 animate-slide-in-up p-4 md:p-6 lg:p-8">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center">
          <FileText className="h-10 w-10 text-primary mr-3" />
          <div>
            <h1 className="text-3xl font-headline font-bold">View Incubation Applications</h1>
            <p className="text-muted-foreground">Review and manage all submitted ideas and innovations.</p>
          </div>
        </div>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Submitted Applications</CardTitle>
          <CardDescription>Overview of applications received for the incubation program. Click "View Details" for more.</CardDescription>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No applications found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px] md:min-w-[200px]">Idea Title</TableHead>
                    <TableHead className="hidden md:table-cell">Applicant Name</TableHead>
                    <TableHead className="hidden lg:table-cell">Applicant Email</TableHead>
                    <TableHead className="hidden sm:table-cell">Submitted</TableHead>
                    <TableHead className="min-w-[200px]">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium max-w-[150px] md:max-w-xs truncate" title={app.title}>
                        {app.title}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{app.applicantDisplayName}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{app.applicantEmail}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {app.submittedAt ? format(app.submittedAt.toDate(), 'MMM d, yyyy') : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Select
                            defaultValue={app.status}
                            onValueChange={(value) => handleStatusChange(app.id!, value as IdeaStatus)}
                          >
                            <SelectTrigger className="w-[150px] h-9 text-xs">
                              <SelectValue placeholder="Set status" />
                            </SelectTrigger>
                            <SelectContent>
                              {ideaStatuses.map(statusVal => (
                                <SelectItem key={statusVal} value={statusVal} className="text-xs">
                                  {statusVal.replace(/_/g, ' ')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Badge variant={getStatusBadgeVariant(app.status)} className="capitalize hidden xl:inline-flex text-xs">
                            {app.status.replace(/_/g, ' ').toLowerCase()}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => openDetailModal(app)}>
                          <Eye className="mr-1 h-3.5 w-3.5" /> Details
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

      {selectedApplication && (
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl flex items-center">
                <Info className="h-6 w-6 mr-2 text-primary" /> Application Details
              </DialogTitle>
              <DialogDescription>
                Full information for: <span className="font-semibold">{selectedApplication.title}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <h4 className="font-semibold text-muted-foreground">Idea Title</h4>
                  <p>{selectedApplication.title}</p>
                </div>
                 <div>
                  <h4 className="font-semibold text-muted-foreground">Status</h4>
                  <Badge variant={getStatusBadgeVariant(selectedApplication.status)} className="capitalize text-sm">
                      {selectedApplication.status.replace(/_/g, ' ').toLowerCase()}
                  </Badge>
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground">Applicant Name</h4>
                  <p>{selectedApplication.applicantDisplayName || 'N/A'}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground">Applicant Email</h4>
                  <p>{selectedApplication.applicantEmail || 'N/A'}</p>
                </div>
                 <div>
                  <h4 className="font-semibold text-muted-foreground">Applicant Category</h4>
                  <p>{selectedApplication.applicantType?.replace(/_/g, ' ') || 'N/A'}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground">Development Stage</h4>
                  <p>{selectedApplication.developmentStage.replace(/_/g, ' ') || 'N/A'}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground">Submitted At</h4>
                  <p>{selectedApplication.submittedAt ? format(selectedApplication.submittedAt.toDate(), 'MMM d, yyyy, HH:mm') : 'N/A'}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground">Last Updated At</h4>
                  <p>{selectedApplication.updatedAt ? format(selectedApplication.updatedAt.toDate(), 'MMM d, yyyy, HH:mm') : 'N/A'}</p>
                </div>
              </div>
              <div className="space-y-3 pt-2">
                <div>
                  <h4 className="font-semibold text-muted-foreground">Problem Definition</h4>
                  <p className="whitespace-pre-wrap bg-muted/30 p-2 rounded-md">{selectedApplication.problem}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground">Proposed Solution</h4>
                  <p className="whitespace-pre-wrap bg-muted/30 p-2 rounded-md">{selectedApplication.solution}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground">Uniqueness/Distinctiveness</h4>
                  <p className="whitespace-pre-wrap bg-muted/30 p-2 rounded-md">{selectedApplication.uniqueness}</p>
                </div>
                 {selectedApplication.fileURL && (
                    <div>
                        <h4 className="font-semibold text-muted-foreground">Attachment</h4>
                        <a href={selectedApplication.fileURL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {selectedApplication.fileName || 'View Attachment'}
                        </a>
                    </div>
                )}
                {selectedApplication.studioLocation && (
                    <div>
                        <h4 className="font-semibold text-muted-foreground">Preferred Studio Location</h4>
                        <p>{selectedApplication.studioLocation}</p>
                    </div>
                )}
              </div>
            </div>
             <div className="pt-4 flex justify-end">
                <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

