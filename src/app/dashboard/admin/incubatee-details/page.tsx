'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getIncubatedIdeas } from '@/lib/firebase/firestore';
import type { IdeaSubmission, IncubationDocument, IncubationDocumentType } from '@/types';
import { ALL_INCUBATION_DOCUMENT_TYPES } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Briefcase, Eye, Download, Info, Users, DollarSign, List, CheckCircle, XCircle, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';

export default function IncubateeDetailsPage() {
  const { userProfile, loading: authLoading, initialLoadComplete } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [incubatedIdeas, setIncubatedIdeas] = useState<IdeaSubmission[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(true);
  const [selectedIdea, setSelectedIdea] = useState<IdeaSubmission | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<{
    url: string;
    fileName: string;
    type: IncubationDocumentType;
  } | null>(null);
  const [isDocViewerOpen, setIsDocViewerOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(0.7);

  // Helper function to format download filename
  const formatDownloadFilename = (originalFilename: string, applicantName: string | null | undefined) => {
    // Sanitize applicant name - remove spaces and special characters
    const sanitizedName = (applicantName || 'user')
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, '')
      .trim();

    // Get file extension from original filename
    const lastDotIndex = originalFilename.lastIndexOf('.');
    const extension = lastDotIndex !== -1 ? originalFilename.slice(lastDotIndex) : '';
    const nameWithoutExt = lastDotIndex !== -1 ? originalFilename.slice(0, lastDotIndex) : originalFilename;

    // Create new filename
    return `${sanitizedName}-${nameWithoutExt}${extension}`;
  };

  // Helper function to handle file downloads
  const handleFileDownload = (url: string, originalFilename: string, applicantName: string | null | undefined) => {
    const formattedFilename = formatDownloadFilename(originalFilename, applicantName);
    console.log('Download filename:', formattedFilename); // Debug log
    
    try {
      // Create a temporary anchor element for download
      const link = document.createElement('a');
      link.href = url;
      link.download = formattedFilename;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      
      // Add to DOM temporarily and click
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({ 
        title: "Download Initiated", 
        description: `File: ${formattedFilename}. The file should download automatically. If not, please try right-clicking the  image and selecting 'Save Image as'.`,
        duration: 5000
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({ 
        title: "Download Failed", 
        description: "Could not initiate download. Please try right-clicking the image and selecting 'Save Image as'.",
        variant: "destructive"
      });
    }
  };

  // Zoom control functions
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.1, 2.0));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.1, 0.3));
  };

  const handleZoomReset = () => {
    setZoomLevel(0.7);
  };

  // Reset zoom when opening a new document
  const openDocumentViewer = (doc: { url: string; fileName: string; type: IncubationDocumentType }) => {
    setViewingDoc(doc);
    setZoomLevel(0.7);
    setIsDocViewerOpen(true);
  };

  useEffect(() => {
    if (initialLoadComplete && !authLoading) {
      if (!userProfile) {
        router.push('/login');
        return;
      }
      if (userProfile.role !== 'ADMIN_FACULTY') {
        toast({ title: "Access Denied", description: "You are not authorized to view this page.", variant: "destructive" });
        router.push('/dashboard');
        return;
      }
      fetchIdeas();
    }
  }, [userProfile, authLoading, initialLoadComplete, router, toast]);

  const fetchIdeas = async () => {
    setLoadingIdeas(true);
    try {
      const ideas = await getIncubatedIdeas();
      setIncubatedIdeas(ideas);
    } catch (error) {
      console.error("Error fetching incubated ideas:", error);
      toast({ title: "Error", description: "Could not fetch incubated ideas.", variant: "destructive" });
    } finally {
      setLoadingIdeas(false);
    }
  };

  const openDetailModal = (idea: IdeaSubmission) => {
    setSelectedIdea(idea);
    setIsDetailModalOpen(true);
  };
  
  const formatDate = (dateValue: Date | Timestamp | undefined | null): string => {
    if (!dateValue) return 'N/A';
    let dateToFormat: Date;
    if ((dateValue as Timestamp)?.toDate) {
      dateToFormat = (dateValue as Timestamp).toDate();
    } else if (dateValue instanceof Date) {
      dateToFormat = dateValue;
    } else {
      return 'Invalid Date';
    }
    return format(dateToFormat, 'MMM d, yyyy');
  };

  if (authLoading || !initialLoadComplete || loadingIdeas) {
    return <div className="flex justify-center items-center h-screen"><LoadingSpinner size={48} /></div>;
  }

  if (!userProfile || userProfile.role !== 'ADMIN_FACULTY') {
    return <div className="flex justify-center items-center h-screen"><p>Verifying access or redirecting...</p></div>;
  }

  return (
    <div className="space-y-8 animate-slide-in-up p-4 md:p-6 lg:p-8">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center">
          <Briefcase className="h-10 w-10 text-primary mr-3" />
          <div>
            <h1 className="text-3xl font-headline font-bold">Incubatee Details</h1>
            <p className="text-muted-foreground">Manage and review information for all incubated startups.</p>
          </div>
        </div>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Incubated Startups</CardTitle>
          <CardDescription>A list of all startups currently in the incubation (funding) phase.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingIdeas ? (
            <div className="flex justify-center items-center py-10"><LoadingSpinner /><p className="ml-2">Loading...</p></div>
          ) : incubatedIdeas.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No startups are currently in the incubation phase.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Idea Title</TableHead>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Mentor</TableHead>
                    <TableHead className="text-right">Total Funding</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incubatedIdeas.map((idea) => (
                    <TableRow key={idea.id}>
                      <TableCell className="font-medium">{idea.title}</TableCell>
                      <TableCell>{idea.applicantDisplayName}</TableCell>
                      <TableCell>{idea.mentor || 'N/A'}</TableCell>
                      <TableCell className="text-right">{idea.totalFundingAllocated ? `₹${idea.totalFundingAllocated.toLocaleString()}` : 'Not Set'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => openDetailModal(idea)}>
                          <Eye className="mr-2 h-4 w-4" /> View Details
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
      
      {selectedIdea && (
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl">{selectedIdea.title}</DialogTitle>
              <DialogDescription>Full details for the incubated startup.</DialogDescription>
            </DialogHeader>
            <div className="flex-grow overflow-y-auto pr-4">
              <Accordion type="multiple" defaultValue={['documents', 'info']} className="w-full">
                
                <AccordionItem value="documents">
                  <AccordionTrigger>Incubation Documents</AccordionTrigger>
                  <AccordionContent className="space-y-2">
                    <ul className="space-y-2">
                      {ALL_INCUBATION_DOCUMENT_TYPES.map(docType => {
                        const uploadedDoc = selectedIdea.incubationDocuments?.[docType.type];
                        return (
                          <li key={docType.type} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                            <div className="flex items-center">
                              {uploadedDoc ? <CheckCircle className="h-5 w-5 mr-3 text-green-500"/> : <XCircle className="h-5 w-5 mr-3 text-muted-foreground"/>}
                              <div>
                                <p className="font-medium">{docType.label}</p>
                                <p className="text-xs text-muted-foreground">{docType.description}</p>
                              </div>
                            </div>
                            {uploadedDoc ? (
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    setViewingDoc({
                                      url: uploadedDoc.url,
                                      fileName: uploadedDoc.fileName,
                                      type: docType.type
                                    });
                                    setZoomLevel(0.7);
                                    setIsDocViewerOpen(true);
                                  }}
                                >
                                  <Eye className="mr-2 h-4 w-4" /> View
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleFileDownload(
                                    uploadedDoc.url, 
                                    uploadedDoc.fileName,
                                    selectedIdea.applicantDisplayName
                                  )}
                                >
                                  <Download className="mr-2 h-4 w-4" /> Download
                                </Button>
                              </div>
                            ) : (
                              <Badge variant="secondary">Not Uploaded</Badge>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="info">
                  <AccordionTrigger>Basic Info</AccordionTrigger>
                  <AccordionContent className="space-y-2">
                    <p><strong>Applicant:</strong> {selectedIdea.applicantDisplayName}</p>
                    <p><strong>Email:</strong> {selectedIdea.applicantEmail}</p>
                    <p><strong>Problem:</strong> {selectedIdea.problem}</p>
                    <p><strong>Solution:</strong> {selectedIdea.solution}</p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="team">
                  <AccordionTrigger>Team Details</AccordionTrigger>
                  <AccordionContent>
                    {selectedIdea.structuredTeamMembers && selectedIdea.structuredTeamMembers.length > 0 ? (
                      <ul className="space-y-2">
                        {selectedIdea.structuredTeamMembers.map(member => (
                          <li key={member.id} className="text-sm">
                            <strong>{member.name}</strong> - {member.email} ({member.phone})
                          </li>
                        ))}
                      </ul>
                    ) : <p>No detailed team members listed.</p>}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="funding">
                  <AccordionTrigger>Funding Status</AccordionTrigger>
                  <AccordionContent className="space-y-2">
                    <p><strong>Total Allocated:</strong> {selectedIdea.totalFundingAllocated ? `₹${selectedIdea.totalFundingAllocated.toLocaleString()}` : 'N/A'}</p>
                    <p><strong>Sanction 1:</strong> {selectedIdea.sanction1Amount ? `₹${selectedIdea.sanction1Amount.toLocaleString()}` : 'N/A'}</p>
                    <p><strong>Sanction 2:</strong> {selectedIdea.sanction2Amount ? `₹${selectedIdea.sanction2Amount.toLocaleString()}` : 'N/A'}</p>
                  </AccordionContent>
                </AccordionItem>
                
              </Accordion>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Document Viewer Modal */}
      {viewingDoc && (
        <Dialog open={isDocViewerOpen} onOpenChange={setIsDocViewerOpen}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="font-headline text-xl flex items-center">
                <Eye className="h-6 w-6 mr-2 text-primary"/> {viewingDoc?.fileName || 'Document'}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleZoomOut}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm font-mono">{Math.round(zoomLevel * 100)}%</span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleZoomIn}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleZoomReset}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              <div className="relative w-full h-[70vh] overflow-auto rounded-lg bg-muted/10">
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="w-full h-full flex items-center justify-center">
                    <iframe 
                      src={viewingDoc?.url || ''} 
                      className="max-w-full max-h-full object-contain"
                      title={viewingDoc?.fileName || 'Document'}
                      style={{ 
                        border: 'none',
                        transform: `scale(${zoomLevel})`,
                        transformOrigin: 'center center',
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="flex justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setIsDocViewerOpen(false)}>Close</Button>
              </div>
              <Button 
                variant="default"
                onClick={() => {
                  if (viewingDoc) {
                    handleFileDownload(
                      viewingDoc.url, 
                      viewingDoc.fileName,
                      selectedIdea?.applicantDisplayName
                    );
                  }
                }}
              >
                <Download className="mr-2 h-4 w-4"/> Download
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
