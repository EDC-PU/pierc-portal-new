
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Lightbulb, Users, Activity, Loader2, ArrowRight, FileCheck2, Clock, ChevronsRight, UploadCloud, FileQuestion, AlertCircle, Download, CalendarDays, MapPin, ListChecks, Trash2, PlusCircle, Edit2, Save, UserCheck as UserCheckIcon, Briefcase, Award, Wand2 as AiIcon, Users2 as GroupIcon, ArchiveRestore, DollarSign, Banknote, FileUp, MessageSquare, Eye, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUserIdeaSubmissionsWithStatus,
  type IdeaSubmission,
  type Cohort,
  getAllCohortsStream,
  updateIdeaPhase2PptDetails,
  addTeamMemberToIdea,
  removeTeamMemberFromIdea,
  updateTeamMemberInIdea,
  logUserActivity,
  updateIdeaBeneficiaryDetailsFS,
  addExpenseToSanctionFS,
  applyForNextSanctionFS,
  updateIdeaOutlineAIGeneratedStatus, 
} from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Timestamp } from 'firebase/firestore';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { ProgramPhase, TeamMember, UserProfile, ApplicantCategory, CurrentStage, IdeaStatus, ExpenseEntry, SanctionApprovalStatus } from '@/types';
import { format, isValid } from 'date-fns';
import { uploadPresentation } from '@/ai/flows/upload-presentation-flow';
import { generatePitchDeckOutline, type GeneratePitchDeckOutlineOutput } from '@/ai/flows/generate-pitch-deck-outline-flow';
import { useForm, Controller, type SubmitHandler, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { nanoid } from 'nanoid';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent as ModalContent, DialogHeader as ModalHeader, DialogTitle as ModalTitle, DialogDescription as ModalDescription, DialogFooter as ModalFooter } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Textarea } from '@/components/ui/textarea';
import ReactMarkdown from 'react-markdown';


const getProgramPhaseLabel = (phase: ProgramPhase | null | undefined): string => {
  if (!phase) return 'N/A';
  switch (phase) {
    case 'PHASE_1': return 'Phase 1';
    case 'PHASE_2': return 'Phase 2';
    case 'COHORT': return 'Cohort';
    case 'INCUBATED': return 'Incubated (Funding)';
    default: return 'N/A';
  }
};

const applicantCategoryLabels: Record<ApplicantCategory, string> = {
  PARUL_STUDENT: 'Parul University Student',
  PARUL_STAFF: 'Parul University Staff',
  PARUL_ALUMNI: 'Parul University Alumni',
  OTHERS: 'Others',
};

const currentStageLabels: Record<CurrentStage, string> = {
  IDEA: 'Idea Stage',
  PROTOTYPE_STAGE: 'Prototype Stage',
  STARTUP_STAGE: 'Startup Stage',
};

const teamMemberSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required").max(100).optional().or(z.literal('')),
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  phone: z.string().min(10, "Contact number must be at least 10 digits").max(15).optional().or(z.literal('')),
  institute: z.string().min(1, "Institute is required").max(100).optional().or(z.literal('')),
  department: z.string().min(1, "Department is required").max(100).optional().or(z.literal('')),
  enrollmentNumber: z.string().max(50).optional().or(z.literal('')),
}).refine(data => {
    if (data.name && data.name.trim() !== '') {
        return !!(data.email && data.email.trim() !== '' &&
                  data.phone && data.phone.trim() !== '' &&
                  data.institute && data.institute.trim() !== '' &&
                  data.department && data.department.trim() !== '');
    }
    return true;
}, {
    message: "If member name is provided, then email, phone, institute, and department are also required.",
    path: ['name'],
});


const teamManagementSchema = z.object({
  members: z.array(teamMemberSchema).max(4, "You can add a maximum of 4 team members."),
});
type TeamManagementFormData = z.infer<typeof teamManagementSchema>;

const beneficiarySchema = z.object({
    beneficiaryName: z.string().min(3, "Beneficiary name is required (min 3 chars).").max(100),
    beneficiaryAccountNo: z.string().min(8, "Account number seems too short.").max(20, "Account number seems too long.")
                          .regex(/^[0-9]+$/, "Account number must contain only digits."),
    beneficiaryBankName: z.string().min(3, "Bank name is required (min 3 chars).").max(100),
    beneficiaryIfscCode: z.string().length(11, "IFSC code must be 11 characters long.")
                           .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code format (e.g., ABCD0123456)."),
});
type BeneficiaryFormData = z.infer<typeof beneficiarySchema>;

const expenseSchema = z.object({
    description: z.string().min(5, "Description is required (min 5 chars).").max(200),
    amount: z.coerce.number().positive("Amount must be a positive number."),
    proofFile: z.custom<File | null>((val) => val instanceof File, "Proof file is required.").nullable(),
});
type ExpenseFormData = z.infer<typeof expenseSchema>;

const MarkdownDisplayComponents = {
  p: ({node, ...props}: any) => <p className="mb-2 last:mb-0" {...props} />,
  ul: ({node, ...props}: any) => <ul className="list-disc pl-5 mb-2" {...props} />,
  ol: ({node, ...props}: any) => <ol className="list-decimal pl-5 mb-2" {...props} />,
  li: ({node, ...props}: any) => <li className="mb-1" {...props} />,
  strong: ({node, ...props}: any) => <strong className="font-semibold" {...props} />,
  em: ({node, ...props}: any) => <em className="italic" {...props} />,
};


export default function StudentDashboard() {
  const { user, userProfile, isTeamMemberForIdea, teamLeaderProfileForMember } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [userIdeas, setUserIdeas] = useState<IdeaSubmission[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(true);
  const [allCohorts, setAllCohorts] = useState<Cohort[]>([]);
  const [loadingCohorts, setLoadingCohorts] = useState(true);
  const [selectedPptFile, setSelectedPptFile] = useState<File | null>(null);
  const [uploadingPptIdeaId, setUploadingPptIdeaId] = useState<string | null>(null);
  const [isUploadingPpt, setIsUploadingPpt] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [selectedIdeaForTeamMgmt, setSelectedIdeaForTeamMgmt] = useState<IdeaSubmission | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);

  const [generatingOutlineIdeaId, setGeneratingOutlineIdeaId] = useState<string | null>(null);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [generatedOutline, setGeneratedOutline] = useState<GeneratePitchDeckOutlineOutput | null>(null);
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const [isOutlineModalOpen, setIsOutlineModalOpen] = useState(false);

  const [isBeneficiaryModalOpen, setIsBeneficiaryModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [currentSanctionForExpense, setCurrentSanctionForExpense] = useState<1 | 2 | null>(null);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [isSubmittingBeneficiary, setIsSubmittingBeneficiary] = useState(false);


  const { control, handleSubmit, reset: resetTeamManagementFormInternal, formState: { errors: teamManagementErrors, isSubmitting: isSubmittingTeamTable }, getValues } = useForm<TeamManagementFormData>({
    resolver: zodResolver(teamManagementSchema),
    defaultValues: {
      members: Array(4).fill(null).map(() => ({ id: '', name: '', email: '', phone: '', institute: '', department: '', enrollmentNumber: '' })),
    },
  });
  const { fields, replace } = useFieldArray({ control, name: "members" });

  const { control: beneficiaryControl, handleSubmit: handleBeneficiarySubmit, reset: resetBeneficiaryForm, formState: { errors: beneficiaryErrors } } = useForm<BeneficiaryFormData>({
    resolver: zodResolver(beneficiarySchema), defaultValues: { beneficiaryName: '', beneficiaryAccountNo: '', beneficiaryBankName: '', beneficiaryIfscCode: '' }
  });
  
  const { control: expenseControl, handleSubmit: handleExpenseSubmit, reset: resetExpenseForm, formState: { errors: expenseErrors }, setValue: setExpenseValue } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema), defaultValues: { description: '', amount: 0, proofFile: null }
  });


  const fetchUserIdeasAndUpdateState = async (currentSelectedIdeaIdToPreserve?: string) => {
    if (!user?.uid) {
        setUserIdeas([]);
        setLoadingIdeas(false);
        return;
    }
    setLoadingIdeas(true);
    try {
        const ideas = await getUserIdeaSubmissionsWithStatus(user.uid);
        setUserIdeas(ideas);

        if (currentSelectedIdeaIdToPreserve) {
            const updatedSelected = ideas.find(idea => idea.id === currentSelectedIdeaIdToPreserve);
            setSelectedIdeaForTeamMgmt(updatedSelected || null);
        } else if (ideas.length > 0 && !selectedIdeaForTeamMgmt) {
        } else if (ideas.length === 0) {
            setSelectedIdeaForTeamMgmt(null);
        }
    } catch (error) {
        console.error("Error fetching user ideas:", error);
        toast({ title: "Error", description: "Could not load your idea submissions.", variant: "destructive" });
        setUserIdeas([]);
        setSelectedIdeaForTeamMgmt(null);
    } finally {
        setLoadingIdeas(false);
    }
  };

  useEffect(() => {
    if (user?.uid && !isTeamMemberForIdea) {
      fetchUserIdeasAndUpdateState(selectedIdeaForTeamMgmt?.id);
    } else {
      setLoadingIdeas(false);
      setUserIdeas([]);
      setSelectedIdeaForTeamMgmt(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, isTeamMemberForIdea]);


  useEffect(() => {
    if (user?.uid) {
      setLoadingCohorts(true);
      const unsubscribeCohorts = getAllCohortsStream((fetchedCohorts) => {
        setAllCohorts(fetchedCohorts);
        setLoadingCohorts(false);
      });
      return () => {
        unsubscribeCohorts();
      };
    } else {
      setAllCohorts([]);
      setLoadingCohorts(false);
    }
  }, [user?.uid]);


  useEffect(() => {
    if (selectedIdeaForTeamMgmt && !isTeamMemberForIdea) {
        const currentMembers = selectedIdeaForTeamMgmt.structuredTeamMembers || [];
        const formMembersData = Array(4).fill(null).map((_, i) => {
            const member = currentMembers[i];
            return member
                ? { ...member, id: member.id || nanoid() }
                : { id: '', name: '', email: '', phone: '', institute: '', department: '', enrollmentNumber: '' };
        });
        replace(formMembersData);
    } else if (!isTeamMemberForIdea) {
        replace(Array(4).fill(null).map(() => ({ id: '', name: '', email: '', phone: '', institute: '', department: '', enrollmentNumber: '' })));
    }
  }, [selectedIdeaForTeamMgmt, replace, isTeamMemberForIdea]);
  
  const ideaForFundManagementTab = useMemo(() => {
    const incubated = userIdeas.filter(idea => idea.programPhase === 'INCUBATED');
    if (incubated.length > 0) {
      if (selectedIdeaForTeamMgmt && selectedIdeaForTeamMgmt.programPhase === 'INCUBATED') {
        return selectedIdeaForTeamMgmt;
      }
      return incubated[0];
    }
    return null;
  }, [userIdeas, selectedIdeaForTeamMgmt]);


  useEffect(() => {
    if (ideaForFundManagementTab?.programPhase === 'INCUBATED' && isBeneficiaryModalOpen) {
        resetBeneficiaryForm({
            beneficiaryName: ideaForFundManagementTab.beneficiaryName || '',
            beneficiaryAccountNo: ideaForFundManagementTab.beneficiaryAccountNo || '',
            beneficiaryBankName: ideaForFundManagementTab.beneficiaryBankName || '',
            beneficiaryIfscCode: ideaForFundManagementTab.beneficiaryIfscCode || '',
        });
    }
  }, [ideaForFundManagementTab, isBeneficiaryModalOpen, resetBeneficiaryForm]);


  const getStatusBadgeVariant = (status?: IdeaStatus) => {
    if (!status) return 'secondary';
    switch (status) {
      case 'SELECTED': return 'default';
      case 'SUBMITTED': return 'secondary';
      case 'UNDER_REVIEW': return 'outline';
      case 'IN_EVALUATION': return 'outline';
      case 'ARCHIVED_BY_ADMIN': return 'outline';
      case 'NOT_SELECTED': return 'destructive';
      default: return 'secondary';
    }
  };

  const formatDate = (timestamp: Timestamp | Date | undefined | null): string => {
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
    return dateToFormat.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateWithTime = (timestamp: Timestamp | Date | undefined | null): string => {
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

  const fileToDataUri = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handlePptFileChange = (event: React.ChangeEvent<HTMLInputElement>, ideaId: string) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type === "application/vnd.ms-powerpoint" || file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
        setSelectedPptFile(file);
        setUploadingPptIdeaId(ideaId);
        setUploadError(null);
      } else {
        toast({ title: "Invalid File Type", description: "Please upload a PPT or PPTX file.", variant: "destructive" });
        setSelectedPptFile(null);
        setUploadingPptIdeaId(null);
        setUploadError("Invalid file type. Please upload PPT or PPTX.");
        event.target.value = '';
      }
    } else {
      setSelectedPptFile(null);
      if (uploadingPptIdeaId === ideaId) {
        setUploadingPptIdeaId(null);
      }
      setUploadError(null);
    }
  };

  const handlePptUpload = async () => {
    if (!selectedPptFile || !uploadingPptIdeaId || !user?.uid || !userProfile) {
      toast({ title: "Upload Error", description: "No file selected or user/idea context missing.", variant: "destructive" });
      return;
    }

    setIsUploadingPpt(true);
    setUploadError(null);
    const ideaToUpdate = userIdeas.find(idea => idea.id === uploadingPptIdeaId);
    if (!ideaToUpdate) {
        toast({ title: "Upload Error", description: "Idea context not found for upload.", variant: "destructive" });
        setIsUploadingPpt(false);
        return;
    }

    try {
      const fileDataUri = await fileToDataUri(selectedPptFile);
      const flowResult = await uploadPresentation({
        ideaId: uploadingPptIdeaId,
        fileName: selectedPptFile.name,
        fileDataUri: fileDataUri,
      });

      await updateIdeaPhase2PptDetails(uploadingPptIdeaId, ideaToUpdate.title, flowResult.pptUrl, flowResult.pptFileName, userProfile);
      toast({ title: "Presentation Info Saved", description: `${flowResult.pptFileName} details recorded (Simulated Upload).` });
      fetchUserIdeasAndUpdateState(uploadingPptIdeaId);

    } catch (error) {
      console.error("Error during PPT upload process:", error);
      const errorMessage = (error instanceof Error) ? error.message : "Could not process PPT upload.";
      setUploadError(errorMessage);
      toast({ title: "Upload Process Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsUploadingPpt(false);
      setSelectedPptFile(null);
      const fileInput = document.getElementById(`ppt-upload-${uploadingPptIdeaId}`) as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      setUploadingPptIdeaId(null);
    }
  };

  const handleGenerateOutline = async (idea: IdeaSubmission) => {
    if (!userProfile || !idea.id) {
      toast({ title: "Error", description: "User or Idea context missing.", variant: "destructive" });
      return;
    }

    setIsGeneratingOutline(true);
    setGeneratingOutlineIdeaId(idea.id); 
    setGeneratedOutline(null);
    setOutlineError(null);

    if (!idea.problem || !idea.solution || !idea.uniqueness || 
        idea.problem.trim().length < 10 || 
        idea.solution.trim().length < 10 || 
        idea.uniqueness.trim().length < 10) {
      toast({
        title: "Complete Idea Details Required",
        description: "To generate a pitch deck outline, please ensure your idea's Problem, Solution, and Uniqueness sections are detailed (min 10 characters each) in your Profile Setup page.",
        variant: "default",
        duration: 8000,
      });
      setIsGeneratingOutline(false);
      setGeneratingOutlineIdeaId(null);
      return;
    }

    try {
      const outline = await generatePitchDeckOutline({
        ideaTitle: idea.title,
        problemStatement: idea.problem,
        proposedSolution: idea.solution,
        uniqueness: idea.uniqueness,
      });
      setGeneratedOutline(outline);
      setIsOutlineModalOpen(true);
      toast({ title: "Pitch Deck Outline Generated!", description: "Review the AI-suggested outline." });
      
      await updateIdeaOutlineAIGeneratedStatus(idea.id!, idea.title, true, userProfile);
      fetchUserIdeasAndUpdateState(idea.id); 

    } catch (error) {
      console.error("Error generating pitch deck outline:", error);
      const errorMessage = (error instanceof Error) ? error.message : "Could not generate outline.";
      setOutlineError(errorMessage); 
      setIsOutlineModalOpen(true); 
      toast({ title: "Outline Generation Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const handleDownloadOutline = (outline: GeneratePitchDeckOutlineOutput | null, ideaTitle: string) => {
    if (!outline) {
      toast({ title: "No Outline", description: "No outline data to download.", variant: "default"});
      return;
    }
    let textContent = `Pitch Deck Outline for: ${ideaTitle}\n\n`;
    Object.entries(outline).forEach(([key, slide]) => {
      if (slide && slide.title && slide.keyPoints) {
        const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        textContent += `## ${slide.title || formattedKey}\n`;
        slide.keyPoints.forEach(point => {
          textContent += `- ${point}\n`;
        });
        textContent += "\n";
      }
    });

    const element = document.createElement("a");
    const file = new Blob([textContent], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${ideaTitle.replace(/\s+/g, '_')}_pitch_outline.txt`;
    document.body.appendChild(element); 
    element.click();
    document.body.removeChild(element);
    toast({ title: "Download Started", description: "Pitch deck outline is downloading."});
  };


 const handleSaveTeamTable: SubmitHandler<TeamManagementFormData> = async (formData) => {
    if (!selectedIdeaForTeamMgmt || !selectedIdeaForTeamMgmt.id || !userProfile) {
      toast({ title: "Error", description: "No idea selected or user not found.", variant: "destructive" });
      return;
    }

    const ideaId = selectedIdeaForTeamMgmt.id;
    const ideaTitle = selectedIdeaForTeamMgmt.title;
    let membersProcessedCount = 0;

    try {
        const ideaDocRef = doc(db, 'ideas', ideaId);
        const ideaDocSnap = await getDoc(ideaDocRef);
        if (!ideaDocSnap.exists()) {
            throw new Error("Selected idea could not be found for team update.");
        }
        const currentIdeaData = ideaDocSnap.data() as IdeaSubmission;
        const existingStructuredMembers = currentIdeaData.structuredTeamMembers || [];

        for (const formMember of formData.members) {
            if (!formMember.name || formMember.name.trim() === '') {
                continue; 
            }

            const memberDataToSave: TeamMember = {
                id: formMember.id || nanoid(),
                name: formMember.name,
                email: formMember.email!,
                phone: formMember.phone!,
                institute: formMember.institute!,
                department: formMember.department!,
                enrollmentNumber: formMember.enrollmentNumber || '',
            };

            const existingMemberInIdea = existingStructuredMembers.find(em => em.id === memberDataToSave.id || (em.email.toLowerCase() === memberDataToSave.email.toLowerCase() && !formMember.id));

            if (existingMemberInIdea) {
                await updateTeamMemberInIdea(ideaId, ideaTitle, memberDataToSave, userProfile);
                membersProcessedCount++;
            } else {
                const currentTeamSize = (await getDoc(doc(db, 'ideas', ideaId))).data()?.structuredTeamMembers?.length || 0;
                if (currentTeamSize < 4) {
                    await addTeamMemberToIdea(ideaId, ideaTitle, memberDataToSave, userProfile);
                    membersProcessedCount++;
                } else {
                   toast({title: "Team Full", description: `Could not add new member ${memberDataToSave.name}. Maximum 4 members allowed for "${ideaTitle}".`, variant: "default"});
                }
            }
        }

        if (membersProcessedCount > 0) {
            toast({ title: "Team Updated", description: "Team member details have been saved successfully." });
        } else {
            toast({ title: "No Changes", description: "No new or modified team member information was submitted to save.", variant: "default" });
        }
        fetchUserIdeasAndUpdateState(ideaId);

    } catch (error) {
        console.error("Error saving team table:", error);
        toast({ title: "Error Saving Team", description: (error as Error).message || "Could not save team member details.", variant: "destructive" });
    }
  };


  const handleRemoveTeamMember = async (memberId: string) => {
    if (!selectedIdeaForTeamMgmt || !selectedIdeaForTeamMgmt.id || !memberId || !userProfile) {
        toast({ title: "Error", description: "Cannot remove member. Context missing.", variant: "destructive" });
        return;
    }
    const ideaId = selectedIdeaForTeamMgmt.id;
    const ideaTitle = selectedIdeaForTeamMgmt.title;
    const memberDataToRemove = (selectedIdeaForTeamMgmt.structuredTeamMembers || []).find(m => m.id === memberId);

    if (!memberDataToRemove) {
        toast({ title: "Error", description: "Member not found for removal.", variant: "destructive" });
        return;
    }
    try {
      await removeTeamMemberFromIdea(ideaId, ideaTitle, memberDataToRemove, userProfile);
      toast({ title: "Team Member Removed", description: `Member has been removed from the team for "${ideaTitle}".` });
      fetchUserIdeasAndUpdateState(ideaId);
    } catch (error) {
      console.error("Error removing team member:", error);
      toast({ title: "Error Removing Member", description: (error as Error).message || "Could not remove team member.", variant: "destructive" });
    }
    setMemberToRemove(null);
  };
  
  const onBeneficiarySubmit: SubmitHandler<BeneficiaryFormData> = async (data) => {
    if (!ideaForFundManagementTab || !ideaForFundManagementTab.id || !userProfile) {
      toast({ title: "Error", description: "Idea context or user profile missing.", variant: "destructive" });
      return;
    }
    setIsSubmittingBeneficiary(true);
    try {
      await updateIdeaBeneficiaryDetailsFS(ideaForFundManagementTab.id, ideaForFundManagementTab.title, data, userProfile);
      toast({ title: "Beneficiary Details Saved", description: "Your bank details for funding have been updated." });
      fetchUserIdeasAndUpdateState(ideaForFundManagementTab.id);
      setIsBeneficiaryModalOpen(false);
    } catch (error: any) {
      toast({ title: "Save Error", description: error.message || "Could not save beneficiary details.", variant: "destructive" });
    } finally {
      setIsSubmittingBeneficiary(false);
    }
  };

  const onExpenseSubmit: SubmitHandler<ExpenseFormData> = async (data) => {
    if (!ideaForFundManagementTab || !ideaForFundManagementTab.id || !currentSanctionForExpense || !data.proofFile || !userProfile) {
      toast({ title: "Error", description: "Required information for expense submission is missing.", variant: "destructive" });
      return;
    }
    setIsSubmittingExpense(true);
    try {
      const fileDataUri = await fileToDataUri(data.proofFile);
      const uploadResult = await uploadPresentation({ 
        ideaId: ideaForFundManagementTab.id,
        fileName: data.proofFile.name,
        fileDataUri: fileDataUri,
      });

      const newExpense: Omit<ExpenseEntry, 'id' | 'uploadedAt'> = {
        description: data.description,
        amount: data.amount,
        proofUrl: uploadResult.pptUrl, 
        proofFileName: uploadResult.pptFileName,
      };

      await addExpenseToSanctionFS(ideaForFundManagementTab.id, ideaForFundManagementTab.title, currentSanctionForExpense, newExpense, userProfile);
      toast({ title: "Expense Submitted", description: `Expense for Sanction ${currentSanctionForExpense} recorded.` });
      fetchUserIdeasAndUpdateState(ideaForFundManagementTab.id);
      setIsExpenseModalOpen(false);
      resetExpenseForm({description: '', amount: 0, proofFile: null});
    } catch (error: any) {
      toast({ title: "Expense Submission Error", description: error.message || "Could not submit expense.", variant: "destructive" });
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  const handleApplyForNextSanction = async (idea: IdeaSubmission) => {
    if (!idea.id || !userProfile) return;
    if (idea.sanction1UtilizationStatus !== 'APPROVED') {
        toast({title: "Cannot Apply", description: "Sanction 1 utilization must be approved by admin before applying for Sanction 2.", variant: "default"});
        return;
    }
    if (idea.sanction2DisbursedAt) {
         toast({title: "Already Disbursed", description: "Sanction 2 has already been disbursed.", variant: "default"});
        return;
    }
    try {
        await applyForNextSanctionFS(idea.id, idea.title, 1, userProfile); 
        toast({ title: "Application Submitted", description: "Your application for Sanction 2 has been noted for admin review."});
        fetchUserIdeasAndUpdateState(idea.id);
    } catch (error: any) {
        toast({ title: "Application Error", description: error.message || "Could not submit application for next sanction.", variant: "destructive"});
    }
  };


  const renderIdeaDetails = (idea: IdeaSubmission, assignedCohort: Cohort | null) => {
    return (
    <div className="space-y-6 animate-slide-in-up">
        <Card className="shadow-lg">
        <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">{idea.title}</CardTitle>
            <CardDescription>Project Details & Current Status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div>
            <Label className="text-sm font-semibold text-muted-foreground">Problem Statement</Label>
             <div className="text-sm bg-muted/30 p-3 rounded-md shadow-sm markdown-container">
                <ReactMarkdown components={MarkdownDisplayComponents}>{idea.problem || ''}</ReactMarkdown>
            </div>
            </div>
            <div>
            <Label className="text-sm font-semibold text-muted-foreground">Proposed Solution</Label>
            <div className="text-sm bg-muted/30 p-3 rounded-md shadow-sm markdown-container">
                <ReactMarkdown components={MarkdownDisplayComponents}>{idea.solution || ''}</ReactMarkdown>
            </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
                <Label className="text-sm font-semibold text-muted-foreground">Submission Status</Label>
                <div><Badge variant={getStatusBadgeVariant(idea.status)} className="capitalize text-base py-1 px-3 shadow-sm">{idea.status.replace(/_/g, ' ').toLowerCase()}</Badge></div>
            </div>
            {idea.programPhase && (
                <div>
                <Label className="text-sm font-semibold text-muted-foreground">Current Program Phase</Label>
                <div><Badge variant="outline" className="capitalize text-base py-1 px-3 shadow-sm">{getProgramPhaseLabel(idea.programPhase)}</Badge></div>
                </div>
            )}
            </div>
            {idea.programPhase === 'COHORT' && idea.mentor && (
                <div className="pt-2">
                    <Label className="text-sm font-semibold text-muted-foreground flex items-center"><Award className="h-4 w-4 mr-1.5 text-amber-500"/> Assigned Mentor</Label>
                    <p className="text-sm p-2 bg-amber-500/10 rounded-md shadow-sm border border-amber-500/30">{idea.mentor}</p>
                </div>
            )}
            {idea.programPhase === 'COHORT' && assignedCohort && (
                <div className="pt-2">
                    <Label className="text-sm font-semibold text-muted-foreground flex items-center"><GroupIcon className="h-4 w-4 mr-1.5 text-primary"/> Assigned Cohort</Label>
                    <p className="text-sm p-2 bg-primary/10 rounded-md shadow-sm border border-primary/30">{assignedCohort.name}</p>
                </div>
            )}
            {idea.status === 'SELECTED' && idea.programPhase && (
                <>
                    {idea.programPhase === 'COHORT' && assignedCohort ? (
                    <Card className="mt-3 border-primary/50 bg-primary/5 shadow-md">
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-lg font-semibold text-primary flex items-center">
                                <GroupIcon className="h-5 w-5 mr-2"/> Incubation Cohort Details
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Your idea is selected to be a part of "{assignedCohort.name}".
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm px-4 pb-4 space-y-1.5 text-foreground/90">
                            <p><strong className="text-primary/90">Cohort Name:</strong> {assignedCohort.name}</p>
                            <p><strong className="text-primary/90">Start Date:</strong> {formatDate(assignedCohort.startDate)}</p>
                            <p><strong className="text-primary/90">End Date:</strong> {formatDate(assignedCohort.endDate)}</p>
                        </CardContent>
                    </Card>
                    ) : (idea.programPhase === 'PHASE_1' || idea.programPhase === 'PHASE_2' || idea.programPhase === 'INCUBATED') && idea.nextPhaseDate ? (
                    <Card className="mt-3 border-primary/50 bg-primary/5 shadow-md">
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-lg font-semibold text-primary flex items-center">
                                <CalendarDays className="h-5 w-5 mr-2"/> Next Step: {getProgramPhaseLabel(idea.programPhase)} Meeting Scheduled
                            </CardTitle>
                            <CardDescription className="text-xs">Please find the details for your upcoming meeting below.</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm px-4 pb-4 space-y-1.5 text-foreground/90">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                                <p><strong className="text-primary/90">Date:</strong> {formatDateWithTime(idea.nextPhaseDate)}</p>
                                <p><strong className="text-primary/90">Time:</strong> {idea.nextPhaseStartTime} - {idea.nextPhaseEndTime}</p>
                            </div>
                            <p><strong><MapPin className="inline h-4 w-4 mr-1 mb-0.5"/>Venue:</strong> {idea.nextPhaseVenue}</p>
                            {idea.nextPhaseGuidelines && (
                                <div className="pt-1">
                                    <p className="font-medium text-primary/90 flex items-center"><ListChecks className="h-4 w-4 mr-1.5"/>Guidelines:</p>
                                    <p className="text-xs whitespace-pre-wrap bg-background/30 p-2 mt-1 rounded-md border border-border">{idea.nextPhaseGuidelines}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    ) : null}
                </>
            )}
            {idea.programPhase === 'PHASE_2' && idea.phase2PptUrl && (
                <Card className="mt-3 border-primary/50 bg-primary/5 shadow-md">
                    <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-base font-semibold text-primary flex items-center">
                        <Download className="h-4 w-4 mr-2"/> Phase 2 Presentation (Submitted by Team)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm px-4 pb-3">
                        <a href={idea.phase2PptUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                            {idea.phase2PptFileName || 'View Presentation'}
                        </a>
                        {idea.phase2PptUploadedAt && <p className="text-xs text-muted-foreground mt-0.5">Uploaded on {formatDate(idea.phase2PptUploadedAt)}</p>}
                    </CardContent>
                </Card>
            )}
             {idea.status === 'ARCHIVED_BY_ADMIN' && (
                <Card className="mt-3 bg-yellow-500/10 border-yellow-500/30">
                    <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 flex items-center">
                            <ArchiveRestore className="h-4 w-4 mr-2"/> Action Required
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-yellow-700/90 dark:text-yellow-400/90 px-4 pb-3">
                        This idea was archived by an administrator. Please review any feedback, update your idea details in your main profile (Profile Setup page), and save your profile to resubmit it for consideration.
                    </CardContent>
                </Card>
             )}
        </CardContent>
        </Card>
    </div>
    );
  }


  if (loadingIdeas || loadingCohorts) {
     return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-12rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading Dashboard...</p>
      </div>
    );
  }

  if (isTeamMemberForIdea && userProfile) {
    const assignedCohort = isTeamMemberForIdea.cohortId ? allCohorts.find(c => c.id === isTeamMemberForIdea.cohortId) : null;
    return (
      <div className="space-y-6 animate-slide-in-up">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl flex items-center">
              <Briefcase className="mr-3 h-7 w-7 text-primary" /> Team Member Dashboard
            </CardTitle>
            <CardDescription>
              Welcome, {userProfile?.displayName || userProfile?.fullName || user?.displayName || 'Team Member'}!
              You are part of the project: <span className="font-semibold text-primary">{isTeamMemberForIdea.title}</span>.
            </CardDescription>
          </CardHeader>
        </Card>

        {renderIdeaDetails(isTeamMemberForIdea, assignedCohort)}
        
         {isTeamMemberForIdea.programPhase === 'INCUBATED' && (
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-xl text-primary flex items-center"><DollarSign className="mr-2 h-5 w-5"/>Incubation Funding Status</CardTitle>
                    <CardDescription>Overview of your idea's funding from PIERC.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    <div><strong>Total Allocated:</strong> {isTeamMemberForIdea.totalFundingAllocated ? `₹${isTeamMemberForIdea.totalFundingAllocated.toLocaleString()}` : 'Not Set'}</div>
                    <div><strong>Sanction 1 Amount:</strong> {isTeamMemberForIdea.sanction1Amount ? `₹${isTeamMemberForIdea.sanction1Amount.toLocaleString()}` : 'Not Set'}</div>
                    <div><strong>Sanction 1 Disbursed:</strong> {isTeamMemberForIdea.sanction1DisbursedAt ? formatDate(isTeamMemberForIdea.sanction1DisbursedAt) : <Badge variant="outline">Pending</Badge>}</div>
                    <div><strong>Sanction 1 Utilization:</strong> <Badge variant={isTeamMemberForIdea.sanction1UtilizationStatus === 'APPROVED' ? 'default' : (isTeamMemberForIdea.sanction1UtilizationStatus === 'REJECTED' ? 'destructive' : 'secondary')}>{isTeamMemberForIdea.sanction1UtilizationStatus || 'Pending Review'}</Badge></div>
                    {isTeamMemberForIdea.sanction1UtilizationRemarks && <div className="text-xs text-muted-foreground italic">Admin Remarks (S1): {isTeamMemberForIdea.sanction1UtilizationRemarks}</div>}
                    <hr className="my-2"/>
                    <div><strong>Sanction 2 Amount:</strong> {isTeamMemberForIdea.sanction2Amount ? `₹${isTeamMemberForIdea.sanction2Amount.toLocaleString()}` : 'Not Set'}</div>
                    <div><strong>Sanction 2 Disbursed:</strong> {isTeamMemberForIdea.sanction2DisbursedAt ? formatDate(isTeamMemberForIdea.sanction2DisbursedAt) : (isTeamMemberForIdea.sanction1UtilizationStatus === 'APPROVED' ? <Badge variant="outline">Pending</Badge> : <Badge variant="outline">Awaiting S1 Approval</Badge>)}</div>
                    <div><strong>Sanction 2 Utilization:</strong> <Badge variant={isTeamMemberForIdea.sanction2UtilizationStatus === 'APPROVED' ? 'default' : (isTeamMemberForIdea.sanction2UtilizationStatus === 'REJECTED' ? 'destructive' : 'secondary')}>{isTeamMemberForIdea.sanction2UtilizationStatus || 'Pending Review'}</Badge></div>
                    {isTeamMemberForIdea.sanction2UtilizationRemarks && <div className="text-xs text-muted-foreground italic">Admin Remarks (S2): {isTeamMemberForIdea.sanction2UtilizationRemarks}</div>}
                </CardContent>
            </Card>
        )}


        {teamLeaderProfileForMember && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-xl flex items-center">
                <UserCheckIcon className="mr-2 h-6 w-6 text-primary" /> Team Leader Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <p><strong>Name:</strong> {teamLeaderProfileForMember.fullName || teamLeaderProfileForMember.displayName || 'N/A'}</p>
              <p><strong>Email:</strong> {teamLeaderProfileForMember.email || 'N/A'}</p>
              <p><strong>Contact:</strong> {teamLeaderProfileForMember.contactNumber || 'N/A'}</p>
            </CardContent>
          </Card>
        )}
         <Card>
          <CardHeader>
            <CardTitle className="font-headline text-xl">Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button variant="outline" onClick={() => router.push('/dashboard/incubation-phases')}>
                View Incubation Phases <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard/announcements')}>
                Check Announcements <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
               <Button variant="outline" onClick={() => router.push('/profile-setup')}>
                My Profile <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="flex w-full flex-wrap items-center justify-start rounded-md bg-muted/60 p-1 mb-4 border-b-2 border-primary/30">
        <TabsTrigger value="overview">Overview & Submissions</TabsTrigger>
        <TabsTrigger value="manageTeam">Manage Team (Max 4)</TabsTrigger>
        {userIdeas.some(idea => idea.programPhase === 'INCUBATED') && (
            <TabsTrigger value="fundManagement">Fund Management</TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Student Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Welcome, {userProfile?.displayName || user?.displayName || 'Student'}! Here are your resources and tools.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-6 w-6 text-primary" />
              <CardTitle className="font-headline text-xl">My Idea Submissions</CardTitle>
            </div>
            <CardDescription>Track the status and phase of your innovative ideas submitted to PIERC.</CardDescription>
          </CardHeader>
          <CardContent>
            {isUploadingPpt && uploadingPptIdeaId ? (
                 <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-2 text-muted-foreground">Uploading presentation for selected idea...</p>
                </div>
            ) : userIdeas.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">You haven't submitted any ideas yet. Your ideas will appear here once your profile (including startup details) is saved.</p>
            ) : (
              <ScrollArea className="h-auto pr-3" key={userIdeas.map(i=>i.id).join(',')}>
                <ul className="space-y-4">
                  {userIdeas.map((idea) => {
                    const assignedCohort = idea.cohortId ? allCohorts.find(c => c.id === idea.cohortId) : null;
                    const canViewOutline = generatedOutline && generatingOutlineIdeaId === idea.id && !isGeneratingOutline;
                    return (
                    <li key={idea.id} className="p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors shadow-sm">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                          <div>
                              <p className="font-semibold text-foreground text-lg">{idea.title}</p>
                              <p className="text-xs text-muted-foreground">
                                  Submitted: {formatDate(idea.submittedAt)} | Last Updated: {formatDate(idea.updatedAt)}
                              </p>
                              {idea.teamMembers && idea.teamMembers.trim() !== '' && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                      <span className="font-medium">Team Description:</span> {idea.teamMembers}
                                  </p>
                              )}
                              {(idea.structuredTeamMembers && idea.structuredTeamMembers.length > 0) && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    <span className="font-medium">Team Members ({idea.structuredTeamMembers.length}):</span> {(idea.structuredTeamMembers || []).map(m => m.name).join(', ')}
                                </p>
                              )}
                              {idea.programPhase === 'COHORT' && idea.mentor && (
                                 <p className="text-xs text-muted-foreground mt-1 flex items-center">
                                    <Award className="h-3.5 w-3.5 mr-1 text-amber-500"/> <span className="font-medium">Mentor:</span> {idea.mentor}
                                </p>
                              )}
                              {idea.programPhase === 'COHORT' && assignedCohort && (
                                 <p className="text-xs text-muted-foreground mt-1 flex items-center">
                                    <GroupIcon className="h-3.5 w-3.5 mr-1 text-primary"/> <span className="font-medium">Cohort:</span> {assignedCohort.name}
                                </p>
                              )}
                              {idea.isOutlineAIGenerated && (
                                <p className="text-xs text-green-600 mt-1 flex items-center">
                                    <Sparkles className="h-3.5 w-3.5 mr-1"/> Pitch Deck Outline was AI-assisted
                                </p>
                              )}
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2 sm:mt-0 flex-shrink-0">
                              <Badge variant={getStatusBadgeVariant(idea.status)} className="capitalize text-xs py-1 px-2.5">
                              {idea.status.replace(/_/g, ' ').toLowerCase()}
                              </Badge>
                              {idea.status === 'SELECTED' && idea.programPhase && (
                                  <Badge variant="outline" className="capitalize text-xs py-1 px-2.5 flex items-center">
                                      <ChevronsRight className="h-3 w-3 mr-1" />
                                      {getProgramPhaseLabel(idea.programPhase)}
                                  </Badge>
                              )}
                              {idea.programPhase === 'PHASE_2' && idea.phase2Marks && (
                              <Badge variant="outline" className="text-xs py-1 px-2.5">
                                      {Object.keys(idea.phase2Marks).length > 0 ? `Marked` : 'Awaiting Marks'}
                              </Badge>
                              )}
                          </div>
                      </div>

                        <div className="mt-3 pt-3 border-t border-border/50 space-y-2 text-sm">
                            {idea.applicantType && (
                                <div className="flex">
                                    <Label className="w-1/3 font-semibold text-muted-foreground">Applicant Category:</Label>
                                    <p className="w-2/3">{applicantCategoryLabels[idea.applicantType] || idea.applicantType.replace(/_/g, ' ')}</p>
                                </div>
                            )}
                            {idea.developmentStage && (
                                <div className="flex">
                                    <Label className="w-1/3 font-semibold text-muted-foreground">Current Stage:</Label>
                                    <p className="w-2/3">{currentStageLabels[idea.developmentStage] || idea.developmentStage.replace(/_/g, ' ')}</p>
                                </div>
                            )}
                             <div className="mt-2">
                                <Label className="font-semibold text-muted-foreground">Problem Definition:</Label>
                                <div className="whitespace-pre-wrap bg-background/30 p-2 rounded-md text-xs mt-0.5 markdown-container">
                                  <ReactMarkdown components={MarkdownDisplayComponents}>{idea.problem || 'N/A'}</ReactMarkdown>
                                </div>
                            </div>
                            <div>
                                <Label className="font-semibold text-muted-foreground">Solution Description:</Label>
                                <div className="whitespace-pre-wrap bg-background/30 p-2 rounded-md text-xs mt-0.5 markdown-container">
                                  <ReactMarkdown components={MarkdownDisplayComponents}>{idea.solution || 'N/A'}</ReactMarkdown>
                                </div>
                            </div>
                            <div>
                                <Label className="font-semibold text-muted-foreground">Uniqueness:</Label>
                                <div className="whitespace-pre-wrap bg-background/30 p-2 rounded-md text-xs mt-0.5 markdown-container">
                                  <ReactMarkdown components={MarkdownDisplayComponents}>{idea.uniqueness || 'N/A'}</ReactMarkdown>
                                </div>
                            </div>
                        </div>


                      {idea.status === 'NOT_SELECTED' && idea.rejectionRemarks && (
                          <Card className="mt-3 bg-destructive/10 border-destructive/30">
                              <CardHeader className="pb-2 pt-3 px-4">
                                  <CardTitle className="text-sm font-semibold text-destructive-foreground/90 flex items-center">
                                      <AlertCircle className="h-4 w-4 mr-2"/> Feedback & Guidance
                                  </CardTitle>
                              </CardHeader>
                              <CardContent className="text-xs text-destructive-foreground/80 px-4 pb-3 whitespace-pre-wrap">
                                  {idea.rejectionRemarks}
                                  {idea.rejectedAt && <p className="mt-1 text-destructive-foreground/60">Provided on: {formatDate(idea.rejectedAt)}</p>}
                              </CardContent>
                          </Card>
                      )}
                      {idea.status === 'ARCHIVED_BY_ADMIN' && (
                        <Card className="mt-3 bg-yellow-500/10 border-yellow-500/30">
                            <CardHeader className="pb-2 pt-3 px-4">
                                <CardTitle className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 flex items-center">
                                    <ArchiveRestore className="h-4 w-4 mr-2"/> Action Required
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-xs text-yellow-700/90 dark:text-yellow-400/90 px-4 pb-3">
                                This idea submission was archived by an administrator. You can update your core idea details (title, problem, solution, etc.) on your main "Profile Setup" page. Saving your profile will resubmit this idea for review.
                            </CardContent>
                        </Card>
                       )}

                        {idea.status === 'SELECTED' && idea.programPhase && (
                            <>
                                {idea.programPhase === 'COHORT' && assignedCohort ? (
                                <Card className="mt-3 border-primary/50 bg-primary/5 shadow-md">
                                    <CardHeader className="pb-2 pt-4 px-4">
                                        <CardTitle className="text-lg font-semibold text-primary flex items-center">
                                            <GroupIcon className="h-5 w-5 mr-2"/> Incubation Cohort Details
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            Your idea is part of the "{assignedCohort.name}" cohort.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="text-sm px-4 pb-4 space-y-1.5 text-foreground/90">
                                        <p><strong className="text-primary/90">Cohort Name:</strong> {assignedCohort.name}</p>
                                        <p><strong className="text-primary/90">Start Date:</strong> {formatDate(assignedCohort.startDate)}</p>
                                        <p><strong className="text-primary/90">End Date:</strong> {formatDate(assignedCohort.endDate)}</p>
                                    </CardContent>
                                </Card>
                                ) : (idea.programPhase === 'PHASE_1' || idea.programPhase === 'PHASE_2' || idea.programPhase === 'INCUBATED') && idea.nextPhaseDate ? (
                                <Card className="mt-3 border-primary/50 bg-primary/5 shadow-md">
                                    <CardHeader className="pb-2 pt-4 px-4">
                                        <CardTitle className="text-lg font-semibold text-primary flex items-center">
                                            <CalendarDays className="h-5 w-5 mr-2"/> Next Step: {getProgramPhaseLabel(idea.programPhase)} Meeting Scheduled
                                        </CardTitle>
                                        <CardDescription className="text-xs">Please find the details for your upcoming meeting below.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="text-sm px-4 pb-4 space-y-1.5 text-foreground/90">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                                            <p><strong className="text-primary/90">Date:</strong> {formatDateWithTime(idea.nextPhaseDate)}</p>
                                            <p><strong className="text-primary/90">Time:</strong> {idea.nextPhaseStartTime} - {idea.nextPhaseEndTime}</p>
                                        </div>
                                        <p><strong><MapPin className="inline h-4 w-4 mr-1 mb-0.5"/>Venue:</strong> {idea.nextPhaseVenue}</p>
                                        {idea.nextPhaseGuidelines && (
                                            <div className="pt-1">
                                                <p className="font-medium text-primary/90 flex items-center"><ListChecks className="h-4 w-4 mr-1.5"/>Guidelines:</p>
                                                <p className="text-xs whitespace-pre-wrap bg-background/30 p-2 mt-1 rounded-md border border-border">{idea.nextPhaseGuidelines}</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                                ) : null}
                            </>
                        )}

                      {idea.programPhase === 'PHASE_2' && (
                          <Card className="mt-3 border-primary/30">
                              <CardHeader className="pb-2 pt-3 px-4">
                                  <CardTitle className="text-sm font-semibold text-primary flex items-center">
                                    <UploadCloud className="h-4 w-4 mr-2"/> Phase 2 Presentation
                                  </CardTitle>
                              </CardHeader>
                              <CardContent className="text-xs px-4 pb-3 space-y-2">
                                  {idea.phase2PptUrl && idea.phase2PptFileName ? (
                                      <div className="flex items-center justify-between">
                                          <p>Uploaded: <span className="font-medium">{idea.phase2PptFileName}</span></p>
                                          <a href={idea.phase2PptUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs flex items-center">
                                              <Download className="h-3 w-3 mr-1" /> View (Simulated Link)
                                          </a>
                                      </div>
                                  ) : (
                                      <p className="text-muted-foreground">No presentation uploaded yet.</p>
                                  )}
                                  <div className="flex items-center gap-2 pt-1">
                                      <Input
                                          id={`ppt-upload-${idea.id}`}
                                          type="file"
                                          accept=".ppt, .pptx"
                                          onChange={(e) => handlePptFileChange(e, idea.id!)}
                                          className="text-xs h-8 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                          disabled={isUploadingPpt && uploadingPptIdeaId === idea.id}
                                      />
                                      <Button
                                          size="sm"
                                          onClick={handlePptUpload}
                                          disabled={!selectedPptFile || uploadingPptIdeaId !== idea.id || (isUploadingPpt && uploadingPptIdeaId === idea.id)}
                                          className="h-8"
                                      >
                                          {isUploadingPpt && uploadingPptIdeaId === idea.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UploadCloud className="h-4 w-4 mr-1"/>}
                                          Upload
                                      </Button>
                                  </div>
                                  {uploadError && uploadingPptIdeaId === idea.id && <p className="text-destructive text-xs mt-1">{uploadError}</p>}
                                  <p className="text-muted-foreground text-xs italic">Upload uses a simulated flow. Actual storage integration is a future step.</p>
                              </CardContent>
                          </Card>
                      )}
                      {idea.status !== 'ARCHIVED_BY_ADMIN' && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    if ( (generatedOutline && generatingOutlineIdeaId === idea.id && !isGeneratingOutline) || (idea.isOutlineAIGenerated && generatedOutline && generatingOutlineIdeaId === idea.id) ) {
                                        setIsOutlineModalOpen(true);
                                    } else {
                                        handleGenerateOutline(idea);
                                    }
                                }}
                                disabled={isGeneratingOutline && generatingOutlineIdeaId === idea.id}
                            >
                                {(isGeneratingOutline && generatingOutlineIdeaId === idea.id) ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : ( (generatedOutline && generatingOutlineIdeaId === idea.id && !isGeneratingOutline) || (idea.isOutlineAIGenerated && generatedOutline && generatingOutlineIdeaId === idea.id) ? <Eye className="h-4 w-4 mr-2"/> : <AiIcon className="h-4 w-4 mr-2"/>)}
                                { ( (generatedOutline && generatingOutlineIdeaId === idea.id && !isGeneratingOutline) || (idea.isOutlineAIGenerated && generatedOutline && generatingOutlineIdeaId === idea.id) ) ? "View AI Pitch Outline" : "Generate Pitch Deck Outline (AI)"}
                            </Button>
                        </div>
                      )}
                    </li>
                  )})}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
          <CardFooter>
              <p className="text-xs text-muted-foreground">Your idea submissions are automatically created or updated when you save your profile with startup details.</p>
          </CardFooter>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Learning Resources</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Explore</div>
              <p className="text-xs text-muted-foreground">
                Access workshops & materials (Coming Soon).
              </p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Collaboration Hub</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Connect</div>
              <p className="text-xs text-muted-foreground">
                Find team members & mentors (Coming Soon).
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-xl">Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button variant="outline" onClick={() => router.push('/dashboard/incubation-phases')}>
                View Incubation Phases <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard/announcements')}>
                Check Announcements <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" disabled>
                Research Repository (Coming Soon)
              </Button>
              <Button variant="outline" onClick={() => router.push('/profile-setup')}>
                My Profile <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="manageTeam" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-xl">Manage Team Members</CardTitle>
            <CardDescription>Select an idea to add, edit, or view its team members. You can add up to 4 members.</CardDescription>
          </CardHeader>
          <CardContent>
            {userIdeas.filter(idea => idea.status !== 'ARCHIVED_BY_ADMIN').length === 0 ? (
              <p className="text-muted-foreground">You have no active idea submissions to manage teams for. Archived ideas cannot have their teams managed here directly.</p>
            ) : (
              <div className="space-y-2 mb-6">
                <Label>Select an Active Idea to Manage its Team:</Label>
                <ScrollArea className="h-auto max-h-40 border rounded-md">
                  <div className="p-2 space-y-1">
                  {userIdeas.filter(idea => idea.status !== 'ARCHIVED_BY_ADMIN').map(idea => (
                    <Button
                      key={idea.id}
                      variant={selectedIdeaForTeamMgmt?.id === idea.id ? "default" : "outline"}
                      className="w-full justify-start text-left"
                      onClick={() => setSelectedIdeaForTeamMgmt(idea)}
                    >
                      {idea.title}
                    </Button>
                  ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {selectedIdeaForTeamMgmt && selectedIdeaForTeamMgmt.status !== 'ARCHIVED_BY_ADMIN' && (
              <form onSubmit={handleSubmit(handleSaveTeamTable)} className="space-y-6">
                <h3 className="text-lg font-semibold mb-1">Edit Team for: <span className="text-primary">{selectedIdeaForTeamMgmt.title}</span></h3>
                <p className="text-sm text-muted-foreground mb-3">
                    Current Members: {(selectedIdeaForTeamMgmt.structuredTeamMembers || []).length} / 4.
                    Fill in the table below. Empty rows (no name) will be ignored.
                </p>

                {teamManagementErrors.members?.root && <p className="text-sm text-destructive -mt-2 mb-2">{teamManagementErrors.members.root.message}</p>}
                {teamManagementErrors.members?.message && <p className="text-sm text-destructive -mt-2 mb-2">{teamManagementErrors.members.message}</p>}


                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Member #</TableHead>
                                <TableHead className="min-w-[150px]">Name</TableHead>
                                <TableHead className="min-w-[200px]">Email</TableHead>
                                <TableHead className="min-w-[120px]">Phone</TableHead>
                                <TableHead className="min-w-[150px]">Institute</TableHead>
                                <TableHead className="min-w-[150px]">Department</TableHead>
                                <TableHead className="min-w-[150px]">Enrollment No.</TableHead>
                                <TableHead className="w-[50px] text-right">Del</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((item, index) => (
                                <TableRow key={item.id}>
                                    <TableCell className="p-1 font-medium text-muted-foreground">Member {index + 1}</TableCell>
                                    <TableCell className="p-1">
                                        <Controller
                                            name={`members.${index}.name`}
                                            control={control}
                                            render={({ field }) => <Input {...field} placeholder="Full Name" className="text-xs h-9" />}
                                        />
                                        {teamManagementErrors.members?.[index]?.name && <p className="text-xs text-destructive mt-0.5">{teamManagementErrors.members?.[index]?.name?.message}</p>}
                                        {teamManagementErrors.members?.[index]?.root && <p className="text-xs text-destructive mt-0.5">{teamManagementErrors.members?.[index]?.root?.message}</p>}
                                    </TableCell>
                                    <TableCell className="p-1">
                                        <Controller
                                            name={`members.${index}.email`}
                                            control={control}
                                            render={({ field }) => <Input type="email" {...field} placeholder="Email Address" className="text-xs h-9" />}
                                        />
                                        {teamManagementErrors.members?.[index]?.email && <p className="text-xs text-destructive mt-0.5">{teamManagementErrors.members?.[index]?.email?.message}</p>}
                                    </TableCell>
                                    <TableCell className="p-1">
                                        <Controller
                                            name={`members.${index}.phone`}
                                            control={control}
                                            render={({ field }) => <Input type="tel" {...field} placeholder="Phone Number" className="text-xs h-9" />}
                                        />
                                        {teamManagementErrors.members?.[index]?.phone && <p className="text-xs text-destructive mt-0.5">{teamManagementErrors.members?.[index]?.phone?.message}</p>}
                                    </TableCell>
                                    <TableCell className="p-1">
                                        <Controller
                                            name={`members.${index}.institute`}
                                            control={control}
                                            render={({ field }) => <Input {...field} placeholder="Institute Name" className="text-xs h-9" />}
                                        />
                                        {teamManagementErrors.members?.[index]?.institute && <p className="text-xs text-destructive mt-0.5">{teamManagementErrors.members?.[index]?.institute?.message}</p>}
                                    </TableCell>
                                    <TableCell className="p-1">
                                        <Controller
                                            name={`members.${index}.department`}
                                            control={control}
                                            render={({ field }) => <Input {...field} placeholder="Department" className="text-xs h-9" />}
                                        />
                                        {teamManagementErrors.members?.[index]?.department && <p className="text-xs text-destructive mt-0.5">{teamManagementErrors.members?.[index]?.department?.message}</p>}
                                    </TableCell>
                                     <TableCell className="p-1">
                                        <Controller
                                            name={`members.${index}.enrollmentNumber`}
                                            control={control}
                                            render={({ field }) => <Input {...field} placeholder="Enrollment (Optional)" className="text-xs h-9" />}
                                        />
                                    </TableCell>
                                    <TableCell className="p-1 text-right">
                                        <Controller name={`members.${index}.id`} control={control} render={({ field }) => <input type="hidden" {...field} />} />
                                        {getValues(`members.${index}.id`) && (selectedIdeaForTeamMgmt.structuredTeamMembers || []).some(m => m.id === getValues(`members.${index}.id`)) && (
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                      variant="ghost"
                                                      size="icon"
                                                      className="text-destructive hover:text-destructive h-8 w-8"
                                                      onClick={() => {
                                                        const memberIdInRow = getValues(`members.${index}.id`);
                                                        const memberData = (selectedIdeaForTeamMgmt.structuredTeamMembers || []).find(m => m.id === memberIdInRow);
                                                        if(memberData) {
                                                            setMemberToRemove(memberData);
                                                        }
                                                    }}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                {memberToRemove && memberToRemove.id === getValues(`members.${index}.id`) && (
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                        <AlertDialogTitle>Remove {memberToRemove.name || 'this member'}?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Are you sure you want to remove {memberToRemove.name || 'this member'} from the team for "{selectedIdeaForTeamMgmt!.title}"? This action is permanent.
                                                        </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                        <AlertDialogCancel onClick={() => setMemberToRemove(null)}>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleRemoveTeamMember(memberToRemove!.id)} className="bg-destructive hover:bg-destructive/90">
                                                            Remove Member
                                                        </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                )}
                                            </AlertDialog>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                 {teamManagementErrors && Object.keys(teamManagementErrors).length > 0 && !teamManagementErrors.members && (
                    <p className="text-sm text-destructive mt-1">
                        Please correct the errors in the form. Remember, if a name is provided for a member, all other fields (except Enrollment No.) for that member become required.
                    </p>
                )}


                <Button type="submit" disabled={isSubmittingTeamTable} className="mt-4">
                    {isSubmittingTeamTable && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4"/> Save Team Changes
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </TabsContent>
      
      {ideaForFundManagementTab && (
        <TabsContent value="fundManagement" className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-xl flex items-center"><DollarSign className="mr-2 h-6 w-6 text-primary"/>Fund Management for: {ideaForFundManagementTab.title}</CardTitle>
                    <CardDescription>Manage beneficiary details, track sanctions, and upload expense proofs.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="multiple" defaultValue={['beneficiary', 'sanction1']} className="w-full">
                        <AccordionItem value="beneficiary">
                            <AccordionTrigger>Beneficiary Details</AccordionTrigger>
                            <AccordionContent className="pt-2">
                                <p className="text-xs text-muted-foreground mb-2">These details will be used for fund disbursement. Ensure they are accurate.</p>
                                {ideaForFundManagementTab.beneficiaryName ? (
                                    <div className="space-y-1 text-sm bg-muted/30 p-3 rounded-md">
                                        <p><strong>Name:</strong> {ideaForFundManagementTab.beneficiaryName}</p>
                                        <p><strong>Account No:</strong> {ideaForFundManagementTab.beneficiaryAccountNo}</p>
                                        <p><strong>Bank:</strong> {ideaForFundManagementTab.beneficiaryBankName}</p>
                                        <p><strong>IFSC:</strong> {ideaForFundManagementTab.beneficiaryIfscCode}</p>
                                        <Button size="sm" variant="outline" className="mt-2" onClick={() => setIsBeneficiaryModalOpen(true)}><Edit2 className="mr-2 h-3 w-3"/>Edit Details</Button>
                                    </div>
                                ) : (
                                    <Button onClick={() => setIsBeneficiaryModalOpen(true)}>Add Beneficiary Details</Button>
                                )}
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="sanction1">
                            <AccordionTrigger>Sanction 1 Details</AccordionTrigger>
                            <AccordionContent className="pt-2 space-y-3">
                                <div><strong>Amount:</strong> {ideaForFundManagementTab.sanction1Amount ? `₹${ideaForFundManagementTab.sanction1Amount.toLocaleString()}` : 'Not Set by Admin'}</div>
                                <div><strong>Disbursed:</strong> {ideaForFundManagementTab.sanction1DisbursedAt ? formatDate(ideaForFundManagementTab.sanction1DisbursedAt) : <Badge variant="outline">Pending Disbursement</Badge>}</div>
                                <div><strong>Utilization Status:</strong> <Badge variant={ideaForFundManagementTab.sanction1UtilizationStatus === 'APPROVED' ? 'default' : (ideaForFundManagementTab.sanction1UtilizationStatus === 'REJECTED' ? 'destructive' : 'secondary')}>{ideaForFundManagementTab.sanction1UtilizationStatus || 'Pending Review'}</Badge></div>
                                {ideaForFundManagementTab.sanction1UtilizationRemarks && <div className="text-xs text-muted-foreground italic p-2 bg-muted/20 rounded-md">Admin Remarks: {ideaForFundManagementTab.sanction1UtilizationRemarks}</div>}

                                {ideaForFundManagementTab.sanction1DisbursedAt && ideaForFundManagementTab.sanction1UtilizationStatus !== 'APPROVED' && (
                                    <Button size="sm" onClick={() => { setCurrentSanctionForExpense(1); setIsExpenseModalOpen(true); resetExpenseForm(); }}><FileUp className="mr-2 h-4 w-4"/>Upload S1 Expense</Button>
                                )}
                                {(ideaForFundManagementTab.sanction1Expenses?.length || 0) > 0 && (
                                    <div>
                                        <h4 className="text-sm font-semibold mt-2 mb-1">Uploaded Expenses (Sanction 1):</h4>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Description</TableHead>
                                                    <TableHead className="text-right">Amount</TableHead>
                                                    <TableHead>Proof</TableHead>
                                                    <TableHead className="text-right">Uploaded</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {ideaForFundManagementTab.sanction1Expenses?.map(exp => (
                                                    <TableRow key={exp.id}>
                                                        <TableCell className="text-xs">{exp.description}</TableCell>
                                                        <TableCell className="text-xs text-right">₹{exp.amount.toLocaleString()}</TableCell>
                                                        <TableCell><a href={exp.proofUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">{exp.proofFileName}</a></TableCell>
                                                        <TableCell className="text-xs text-right">{formatDate(exp.uploadedAt)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                                {ideaForFundManagementTab.sanction1DisbursedAt && ideaForFundManagementTab.sanction1UtilizationStatus === 'APPROVED' && !ideaForFundManagementTab.sanction2DisbursedAt && (
                                    <Button size="sm" onClick={() => handleApplyForNextSanction(ideaForFundManagementTab)} disabled={ideaForFundManagementTab.sanction1AppliedForNext}>
                                        {ideaForFundManagementTab.sanction1AppliedForNext ? 'Applied for Sanction 2' : 'Apply for Sanction 2'}
                                    </Button>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                        
                        <AccordionItem value="sanction2">
                            <AccordionTrigger disabled={ideaForFundManagementTab.sanction1UtilizationStatus !== 'APPROVED'}>Sanction 2 Details</AccordionTrigger>
                             <AccordionContent className="pt-2 space-y-3">
                                {ideaForFundManagementTab.sanction1UtilizationStatus !== 'APPROVED' ? (
                                    <p className="text-sm text-muted-foreground">Sanction 1 utilization must be approved before Sanction 2 details are available.</p>
                                ) : (
                                    <>
                                        <div><strong>Amount:</strong> {ideaForFundManagementTab.sanction2Amount ? `₹${ideaForFundManagementTab.sanction2Amount.toLocaleString()}` : 'Not Set by Admin'}</div>
                                        <div><strong>Disbursed:</strong> {ideaForFundManagementTab.sanction2DisbursedAt ? formatDate(ideaForFundManagementTab.sanction2DisbursedAt) : <Badge variant="outline">Pending Disbursement</Badge>}</div>
                                        <div><strong>Utilization Status:</strong> <Badge variant={ideaForFundManagementTab.sanction2UtilizationStatus === 'APPROVED' ? 'default' : (ideaForFundManagementTab.sanction2UtilizationStatus === 'REJECTED' ? 'destructive' : 'secondary')}>{ideaForFundManagementTab.sanction2UtilizationStatus || 'Pending Review'}</Badge></div>
                                        {ideaForFundManagementTab.sanction2UtilizationRemarks && <div className="text-xs text-muted-foreground italic p-2 bg-muted/20 rounded-md">Admin Remarks: {ideaForFundManagementTab.sanction2UtilizationRemarks}</div>}
                                        
                                        {ideaForFundManagementTab.sanction2DisbursedAt && ideaForFundManagementTab.sanction2UtilizationStatus !== 'APPROVED' && (
                                            <Button size="sm" onClick={() => { setCurrentSanctionForExpense(2); setIsExpenseModalOpen(true); resetExpenseForm(); }}><FileUp className="mr-2 h-4 w-4"/>Upload S2 Expense</Button>
                                        )}
                                        {(ideaForFundManagementTab.sanction2Expenses?.length || 0) > 0 && (
                                           <div>
                                                <h4 className="text-sm font-semibold mt-2 mb-1">Uploaded Expenses (Sanction 2):</h4>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Description</TableHead>
                                                            <TableHead className="text-right">Amount</TableHead>
                                                            <TableHead>Proof</TableHead>
                                                            <TableHead className="text-right">Uploaded</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {ideaForFundManagementTab.sanction2Expenses?.map(exp => (
                                                            <TableRow key={exp.id}>
                                                                <TableCell className="text-xs">{exp.description}</TableCell>
                                                                <TableCell className="text-xs text-right">₹{exp.amount.toLocaleString()}</TableCell>
                                                                <TableCell><a href={exp.proofUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">{exp.proofFileName}</a></TableCell>
                                                                <TableCell className="text-xs text-right">{formatDate(exp.uploadedAt)}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                    </>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>
        </TabsContent>
      )}


      <Dialog open={isOutlineModalOpen} onOpenChange={(isOpen) => {
            if (!isOpen) {
                setIsOutlineModalOpen(false);
                setGeneratedOutline(null); 
                setGeneratingOutlineIdeaId(null); 
                setOutlineError(null);
            } else {
                setIsOutlineModalOpen(isOpen);
            }
        }}>
            <ModalContent className="sm:max-w-2xl md:max-w-3xl max-h-[90vh]">
                <ModalHeader>
                    <ModalTitle className="font-headline text-xl flex items-center">
                        <AiIcon className="h-6 w-6 mr-2 text-primary"/> AI Generated Pitch Deck Outline
                    </ModalTitle>
                    <ModalDescription>
                        For idea: <span className="font-semibold">{userIdeas.find(i => i.id === generatingOutlineIdeaId)?.title || 'Selected Idea'}</span>.
                        This is a suggestion to help you get started. Customize it to best fit your vision.
                    </ModalDescription>
                </ModalHeader>
                {outlineError && !generatedOutline ? ( 
                    <div className="py-4 text-destructive text-center">
                        <p>Error generating outline: {outlineError}</p>
                    </div>
                ) : generatedOutline ? (
                <ScrollArea className="max-h-[calc(90vh-14rem)] overflow-y-auto p-1 pr-3">
                    <Accordion type="multiple" defaultValue={Object.keys(generatedOutline).map(key => key)} className="w-full">
                        {Object.entries(generatedOutline).map(([key, slide]) => {
                            if (!slide || !slide.title || !slide.keyPoints) return null;
                            const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                            return (
                                <AccordionItem value={key} key={key}>
                                    <AccordionTrigger className="text-md font-semibold hover:bg-muted/50 px-2 py-3">
                                        {slide.title || formattedKey}
                                    </AccordionTrigger>
                                    <AccordionContent className="px-2 py-2 bg-muted/20 rounded-b-md">
                                        <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/90">
                                            {slide.keyPoints.map((point, index) => (
                                                <li key={index}>{point}</li>
                                            ))}
                                        </ul>
                                    </AccordionContent>
                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                </ScrollArea>
                ) : ( 
                     <div className="py-4 text-muted-foreground text-center">
                        <p>No outline to display. Try generating one.</p>
                    </div>
                )}
                <ModalFooter className="mt-4 flex justify-between items-center">
                    <Button 
                        variant="outline" 
                        onClick={() => handleDownloadOutline(generatedOutline, userIdeas.find(i => i.id === generatingOutlineIdeaId)?.title || 'MyIdea')}
                        disabled={!generatedOutline || isGeneratingOutline}
                    >
                        <Download className="mr-2 h-4 w-4" /> Download Outline
                    </Button>
                    <Button variant="outline" onClick={() => {
                        setIsOutlineModalOpen(false);
                        setGeneratedOutline(null);
                        setGeneratingOutlineIdeaId(null);
                        setOutlineError(null);
                    }}>Close</Button>
                </ModalFooter>
            </ModalContent>
        </Dialog>
      )}

      {isBeneficiaryModalOpen && ideaForFundManagementTab && (
        <Dialog open={isBeneficiaryModalOpen} onOpenChange={setIsBeneficiaryModalOpen}>
            <ModalContent>
                <form onSubmit={handleBeneficiarySubmit(onBeneficiarySubmit)}>
                <ModalHeader><ModalTitle>Beneficiary Bank Details</ModalTitle><ModalDescription>Enter details for fund disbursement to the team leader/entity.</ModalDescription></ModalHeader>
                <div className="py-4 space-y-3">
                    <div><Label htmlFor="beneficiaryName">Beneficiary Name</Label><Controller name="beneficiaryName" control={beneficiaryControl} render={({field}) => <Input id="beneficiaryName" {...field} />} />{beneficiaryErrors.beneficiaryName && <p className="text-xs text-destructive mt-1">{beneficiaryErrors.beneficiaryName.message}</p>}</div>
                    <div><Label htmlFor="beneficiaryAccountNo">Account Number</Label><Controller name="beneficiaryAccountNo" control={beneficiaryControl} render={({field}) => <Input id="beneficiaryAccountNo" {...field} />} />{beneficiaryErrors.beneficiaryAccountNo && <p className="text-xs text-destructive mt-1">{beneficiaryErrors.beneficiaryAccountNo.message}</p>}</div>
                    <div><Label htmlFor="beneficiaryBankName">Bank Name</Label><Controller name="beneficiaryBankName" control={beneficiaryControl} render={({field}) => <Input id="beneficiaryBankName" {...field} />} />{beneficiaryErrors.beneficiaryBankName && <p className="text-xs text-destructive mt-1">{beneficiaryErrors.beneficiaryBankName.message}</p>}</div>
                    <div><Label htmlFor="beneficiaryIfscCode">IFSC Code</Label><Controller name="beneficiaryIfscCode" control={beneficiaryControl} render={({field}) => <Input id="beneficiaryIfscCode" {...field} />} />{beneficiaryErrors.beneficiaryIfscCode && <p className="text-xs text-destructive mt-1">{beneficiaryErrors.beneficiaryIfscCode.message}</p>}</div>
                </div>
                <ModalFooter><Button type="button" variant="outline" onClick={() => setIsBeneficiaryModalOpen(false)} disabled={isSubmittingBeneficiary}>Cancel</Button><Button type="submit" disabled={isSubmittingBeneficiary}>{isSubmittingBeneficiary && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Details</Button></ModalFooter>
                </form>
            </ModalContent>
        </Dialog>
      )}
      
      {isExpenseModalOpen && ideaForFundManagementTab && currentSanctionForExpense && (
        <Dialog open={isExpenseModalOpen} onOpenChange={(isOpen) => {if(!isOpen) setCurrentSanctionForExpense(null); setIsExpenseModalOpen(isOpen);}}>
            <ModalContent>
                <form onSubmit={handleExpenseSubmit(onExpenseSubmit)}>
                <ModalHeader><ModalTitle>Upload Expense for Sanction {currentSanctionForExpense}</ModalTitle><ModalDescription>Provide details and proof for your expenditure.</ModalDescription></ModalHeader>
                 <div className="py-4 space-y-3">
                    <div><Label htmlFor="expenseDescription">Description</Label><Controller name="description" control={expenseControl} render={({field}) => <Textarea id="expenseDescription" {...field} placeholder="e.g., Prototyping components purchase" />} />{expenseErrors.description && <p className="text-xs text-destructive mt-1">{expenseErrors.description.message}</p>}</div>
                    <div><Label htmlFor="expenseAmount">Amount (INR)</Label><Controller name="amount" control={expenseControl} render={({field}) => <Input id="expenseAmount" type="number" {...field} />} />{expenseErrors.amount && <p className="text-xs text-destructive mt-1">{expenseErrors.amount.message}</p>}</div>
                    <div><Label htmlFor="expenseProof">Proof (Image/PDF)</Label><Input id="expenseProof" type="file" accept="image/*,.pdf" onChange={e => setExpenseValue('proofFile', e.target.files ? e.target.files[0] : null)} className="text-xs h-9 file:mr-2 file:py-1 file:px-2"/>{expenseErrors.proofFile && <p className="text-xs text-destructive mt-1">{expenseErrors.proofFile.message}</p>}</div>
                 </div>
                <ModalFooter><Button type="button" variant="outline" onClick={() => setIsExpenseModalOpen(false)} disabled={isSubmittingExpense}>Cancel</Button><Button type="submit" disabled={isSubmittingExpense}>{isSubmittingExpense && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Submit Expense</Button></ModalFooter>
                </form>
            </ModalContent>
        </Dialog>
      )}

    </Tabs>
  );
}

