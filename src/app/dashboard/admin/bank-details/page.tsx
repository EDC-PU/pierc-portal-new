
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Landmark, Filter as FilterIcon, Search as SearchIcon, Download } from 'lucide-react';
import { getAllIdeaSubmissionsWithDetails } from '@/lib/firebase/firestore';
import type { IdeaSubmission, BeneficiaryAccountType } from '@/types';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

interface BankDetailsFilters {
  searchTerm: string;
}

export default function BankDetailsPage() {
  const { userProfile, loading: authLoading, initialLoadComplete } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [fundedIdeas, setFundedIdeas] = useState<IdeaSubmission[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [filters, setFilters] = useState<BankDetailsFilters>({ searchTerm: '' });

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
      fetchFundedIdeas();
    }
  }, [userProfile, authLoading, initialLoadComplete, router, toast]);

  const fetchFundedIdeas = async () => {
    setLoadingData(true);
    try {
      const allIdeas = await getAllIdeaSubmissionsWithDetails();
      const incubatedAndFunded = allIdeas.filter(idea => 
        idea.programPhase === 'INCUBATED' && 
        (idea.beneficiaryName || idea.beneficiaryAccountNo) // Basic check if some bank detail is present
      );
      setFundedIdeas(incubatedAndFunded);
    } catch (error) {
      console.error("Error fetching funded ideas bank details:", error);
      toast({ title: "Data Load Error", description: "Could not load bank details for funded ideas.", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  };

  const filteredIdeas = useMemo(() => {
    let ideas = [...fundedIdeas];
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      ideas = ideas.filter(idea =>
        idea.title.toLowerCase().includes(term) ||
        (idea.applicantDisplayName && idea.applicantDisplayName.toLowerCase().includes(term)) ||
        (idea.beneficiaryName && idea.beneficiaryName.toLowerCase().includes(term)) ||
        (idea.beneficiaryAccountNo && idea.beneficiaryAccountNo.includes(term))
      );
    }
    return ideas;
  }, [fundedIdeas, filters.searchTerm]);

  const handleExportXLSX = () => {
    if (filteredIdeas.length === 0) {
      toast({ title: "No Data", description: "There are no bank details to export with current filters.", variant: "default" });
      return;
    }

    const dataForSheet = filteredIdeas.map(idea => ({
      "Idea Title": idea.title,
      "Applicant Name": idea.applicantDisplayName,
      "Applicant Email": idea.applicantEmail,
      "Beneficiary Name": idea.beneficiaryName || 'N/A',
      "Account Number": idea.beneficiaryAccountNo || 'N/A',
      "Bank Name": idea.beneficiaryBankName || 'N/A',
      "IFSC Code": idea.beneficiaryIfscCode || 'N/A',
      "Account Type": idea.beneficiaryAccountType ? idea.beneficiaryAccountType.charAt(0) + idea.beneficiaryAccountType.slice(1).toLowerCase() : 'N/A',
      "Branch Name": idea.beneficiaryBranchName || 'N/A',
      "City": idea.beneficiaryCity || 'N/A',
      "Total Funding Allocated": idea.totalFundingAllocated ?? 'N/A',
      "Sanction 1 Amount": idea.sanction1Amount ?? 'N/A',
      "Sanction 1 Disbursed": idea.sanction1DisbursedAt ? format(idea.sanction1DisbursedAt.toDate(), 'MMM d, yyyy') : 'No',
      "Sanction 2 Amount": idea.sanction2Amount ?? 'N/A',
      "Sanction 2 Disbursed": idea.sanction2DisbursedAt ? format(idea.sanction2DisbursedAt.toDate(), 'MMM d, yyyy') : 'No',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Funded_Startup_Bank_Details");
    XLSX.writeFile(workbook, `pierc_funded_bank_details_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: "Export Successful", description: "Bank details XLSX has been downloaded." });
  };

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
          <Landmark className="h-10 w-10 text-primary mr-3" />
          <div>
            <h1 className="text-3xl font-headline font-bold">Funded Startup Bank Details</h1>
            <p className="text-muted-foreground">View bank account information for incubated and funded ideas.</p>
          </div>
        </div>
         <Button onClick={handleExportXLSX} disabled={filteredIdeas.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Export to XLSX
        </Button>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SearchIcon className="h-5 w-5" />
            Search & Filter
          </CardTitle>
          <div className="pt-4">
            <Input
              placeholder="Search by Idea Title, Applicant, Beneficiary Name, Account No..."
              value={filters.searchTerm}
              onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
              className="h-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loadingData ? (
            <div className="flex justify-center items-center py-10">
              <LoadingSpinner size={32} />
              <p className="ml-2 text-muted-foreground">Loading bank details...</p>
            </div>
          ) : filteredIdeas.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No bank details found for funded ideas matching your criteria.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Idea Title</TableHead>
                    <TableHead className="min-w-[150px]">Applicant</TableHead>
                    <TableHead className="min-w-[150px]">Beneficiary Name</TableHead>
                    <TableHead className="min-w-[150px]">Account Number</TableHead>
                    <TableHead className="min-w-[180px]">Bank Name</TableHead>
                    <TableHead className="min-w-[120px]">IFSC Code</TableHead>
                    <TableHead className="min-w-[120px]">Account Type</TableHead>
                    <TableHead className="min-w-[120px]">Branch Name</TableHead>
                    <TableHead className="min-w-[120px]">City</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIdeas.map((idea) => (
                    <TableRow key={idea.id}>
                      <TableCell className="text-xs font-medium" title={idea.title}>{idea.title}</TableCell>
                      <TableCell className="text-xs" title={idea.applicantDisplayName}>{idea.applicantDisplayName}</TableCell>
                      <TableCell className="text-xs">{idea.beneficiaryName || 'N/A'}</TableCell>
                      <TableCell className="text-xs">{idea.beneficiaryAccountNo || 'N/A'}</TableCell>
                      <TableCell className="text-xs">{idea.beneficiaryBankName || 'N/A'}</TableCell>
                      <TableCell className="text-xs">{idea.beneficiaryIfscCode || 'N/A'}</TableCell>
                      <TableCell className="text-xs capitalize">{idea.beneficiaryAccountType?.toLowerCase() || 'N/A'}</TableCell>
                      <TableCell className="text-xs">{idea.beneficiaryBranchName || 'N/A'}</TableCell>
                      <TableCell className="text-xs">{idea.beneficiaryCity || 'N/A'}</TableCell>
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
