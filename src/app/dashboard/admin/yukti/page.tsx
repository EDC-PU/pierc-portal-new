
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getAllIdeasWithYuktiDetails } from '@/lib/firebase/firestore';
import type { IdeaSubmission } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Eye, Copy, Sparkles as YuktiIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function YuktiSubmissionsPage() {
  const { userProfile, loading: authLoading, initialLoadComplete } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<IdeaSubmission[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [filter, setFilter] = useState('');

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
      fetchYuktiData();
    }
  }, [userProfile, authLoading, initialLoadComplete, router, toast]);

  const fetchYuktiData = async () => {
    setLoadingData(true);
    try {
      const data = await getAllIdeasWithYuktiDetails();
      setSubmissions(data);
    } catch (error) {
      console.error("Error fetching Yukti submissions:", error);
      toast({ title: "Data Load Error", description: "Could not load Yukti portal submissions.", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: 'Password copied to clipboard.' });
  };
  
  const filteredSubmissions = submissions.filter(s => 
    s.title.toLowerCase().includes(filter.toLowerCase()) ||
    (s.applicantDisplayName && s.applicantDisplayName.toLowerCase().includes(filter.toLowerCase())) ||
    (s.yuktiId && s.yuktiId.toLowerCase().includes(filter.toLowerCase()))
  );

  if (authLoading || !initialLoadComplete || loadingData) {
    return <div className="flex justify-center items-center h-screen"><LoadingSpinner size={48} /></div>;
  }

  if (!userProfile || userProfile.role !== 'ADMIN_FACULTY') {
    return <div className="flex justify-center items-center h-screen"><p>Verifying access or redirecting...</p></div>;
  }

  return (
    <div className="space-y-8 animate-slide-in-up p-4 md:p-6 lg:p-8">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center">
          <YuktiIcon className="h-10 w-10 text-primary mr-3" />
          <div>
            <h1 className="text-3xl font-headline font-bold">Yukti Portal Submissions</h1>
            <p className="text-muted-foreground">Review credentials and screenshots submitted by Phase 2 teams.</p>
          </div>
        </div>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>All Yukti Submissions</CardTitle>
          <CardDescription>Details submitted by teams after registering on the Yukti Portal.</CardDescription>
          <div className="pt-4">
              <Input 
                placeholder="Filter by idea, applicant, or Yukti ID..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="max-w-sm"
              />
          </div>
        </CardHeader>
        <CardContent>
          {loadingData ? (
             <div className="flex justify-center items-center py-10">
              <LoadingSpinner size={32} />
              <p className="ml-2 text-muted-foreground">Loading submissions...</p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No Yukti portal submissions found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Idea Title</TableHead>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Yukti ID</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead className="text-right">Screenshot</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmissions.map((idea) => (
                    <TableRow key={idea.id}>
                      <TableCell className="font-medium">{idea.title}</TableCell>
                      <TableCell>{idea.applicantDisplayName}</TableCell>
                      <TableCell className="font-mono text-xs">{idea.yuktiId}</TableCell>
                      <TableCell className="flex items-center gap-1">
                        <span className="font-mono text-xs text-muted-foreground">••••••••</span>
                        {idea.yuktiPassword && (
                           <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(idea.yuktiPassword!)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {idea.yuktiScreenshotUrl ? (
                          <Button asChild variant="link" size="sm">
                            <a href={idea.yuktiScreenshotUrl} target="_blank" rel="noopener noreferrer">
                              <Eye className="mr-1 h-4 w-4" /> View
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not provided</span>
                        )}
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
