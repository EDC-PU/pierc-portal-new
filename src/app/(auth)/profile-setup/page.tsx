
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile, Role, ApplicantCategory, CurrentStage } from '@/types';
import { UserCircle, Briefcase, Lightbulb, CheckSquare, XSquare, AlertTriangle, Trash2 } from 'lucide-react';
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


const applicantCategories: { value: ApplicantCategory; label: string }[] = [
  { value: 'PARUL_STUDENT', label: 'Parul University Student' },
  { value: 'PARUL_STAFF', label: 'Parul University Staff' },
  { value: 'PARUL_ALUMNI', label: 'Parul University Alumni' },
  { value: 'OTHERS', label: 'Others' },
];

const currentStages: { value: CurrentStage; label: string }[] = [
  { value: 'IDEA', label: 'Idea Stage' },
  { value: 'PROTOTYPE_STAGE', label: 'Prototype Stage' },
  { value: 'STARTUP_STAGE', label: 'Startup Stage' },
];

const rolesForSelection: { value: Role; label: string }[] = [
  { value: 'STUDENT', label: 'Student / Innovator' },
  { value: 'EXTERNAL_USER', label: 'External User / Collaborator' },
];

const profileSetupSchemaBase = z.object({
  fullName: z.string().min(3, 'Full name must be at least 3 characters').max(100),
  contactNumber: z.string().min(10, 'Contact number must be at least 10 digits').max(15, 'Contact number seems too long')
    .regex(/^(\+\d{1,3}[- ]?)?\d{10,14}$/, 'Invalid phone number format'),
  
  role: z.custom<Role>().optional(), 

  enrollmentNumber: z.string().max(50).optional(),
  college: z.string().max(100).optional(),
  instituteName: z.string().max(100).optional(),

  applicantCategory: z.custom<ApplicantCategory>().optional(),
  startupTitle: z.string().max(200).optional(),
  problemDefinition: z.string().max(2000).optional(),
  solutionDescription: z.string().max(2000).optional(),
  uniqueness: z.string().max(2000).optional(),
  currentStage: z.custom<CurrentStage>().optional(),
  teamMembers: z.string().max(500).optional(),
});

const profileSetupSchema = profileSetupSchemaBase.superRefine((data, ctx) => {
  const isIdeaOwnerContext = !data.role || (data.role && data.role !== 'ADMIN_FACULTY' && data.role !== 'EXTERNAL_USER'); 
                                       

  if (data.applicantCategory === 'PARUL_STUDENT' && !data.enrollmentNumber && isIdeaOwnerContext) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Enrollment number is required for Parul Students submitting an idea.',
      path: ['enrollmentNumber'],
    });
  }
  if (data.applicantCategory === 'PARUL_STUDENT' && !data.college && isIdeaOwnerContext) {
     ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'College is required for Parul Students submitting an idea.',
      path: ['college'],
    });
  }

  if (isIdeaOwnerContext) { 
    if (!data.applicantCategory) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Applicant category is required.', path: ['applicantCategory'] });
    if (!data.startupTitle) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Startup title is required.', path: ['startupTitle'] });
    if (!data.problemDefinition) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Problem definition is required.', path: ['problemDefinition'] });
    if (!data.solutionDescription) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Solution description is required.', path: ['solutionDescription'] });
    if (!data.uniqueness) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Uniqueness description is required.', path: ['uniqueness'] });
    if (!data.currentStage) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Current stage is required.', path: ['currentStage'] });
  }
});


type ProfileSetupFormData = z.infer<typeof profileSetupSchemaBase>; 

export default function ProfileSetupPage() {
  const authContext = useAuth();
  const { user, userProfile, loading: authLoading, initialLoadComplete, setRoleAndCompleteProfile, isTeamMemberForIdea, teamLeaderProfileForMember, deleteCurrentUserAccount } = authContext;
  const router = useRouter();
  const { toast } = useToast();

  const [pageLoading, setPageLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  
  const isSuperAdminEmail = useMemo(() => user?.email === 'pranavrathi07@gmail.com', [user?.email]);
  const isTeamMemberContext = useMemo(() => !!(!userProfile && isTeamMemberForIdea), [userProfile, isTeamMemberForIdea]);
  const isParulEmail = useMemo(() => user?.email?.endsWith('@paruluniversity.ac.in') || false, [user?.email]);

  const { control, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<ProfileSetupFormData>({
    resolver: zodResolver(profileSetupSchema), 
    defaultValues: {
      fullName: '',
      contactNumber: '',
      role: null,
      enrollmentNumber: '',
      college: '',
      instituteName: '',
      applicantCategory: undefined,
      startupTitle: '',
      problemDefinition: '',
      solutionDescription: '',
      uniqueness: '',
      currentStage: undefined,
      teamMembers: '',
    },
  });

  const selectedRole = watch('role');
  const selectedApplicantCategory = watch('applicantCategory');

  useEffect(() => {
    if (!authLoading && initialLoadComplete) {
      if (!user) {
        router.replace('/login');
        return;
      }
      
      setPageLoading(true);
      if (userProfile) {
        setIsEditing(true);
        reset({
          fullName: userProfile.fullName || '',
          contactNumber: userProfile.contactNumber || '',
          role: userProfile.role,
          enrollmentNumber: userProfile.enrollmentNumber || '',
          college: userProfile.college || '',
          instituteName: userProfile.instituteName || '',
          applicantCategory: userProfile.applicantCategory || undefined,
          startupTitle: userProfile.startupTitle || '',
          problemDefinition: userProfile.problemDefinition || '',
          solutionDescription: userProfile.solutionDescription || '',
          uniqueness: userProfile.uniqueness || '',
          currentStage: userProfile.currentStage || undefined,
          teamMembers: userProfile.teamMembers || '',
        });
      } else {
        setIsEditing(false);
        reset({ 
          fullName: user.displayName || '',
          contactNumber: '',
          role: isSuperAdminEmail ? 'ADMIN_FACULTY' : (isTeamMemberContext ? (isParulEmail ? 'STUDENT' : 'EXTERNAL_USER') : null),
          enrollmentNumber: '',
          college: '',
          instituteName: '',
          applicantCategory: undefined,
          startupTitle: isSuperAdminEmail ? 'Administrative Account' : '',
          problemDefinition: isSuperAdminEmail ? 'Handles portal administration.' : '',
          solutionDescription: isSuperAdminEmail ? 'Provides administrative functions and support.' : '',
          uniqueness: isSuperAdminEmail ? 'Unique administrative role for system management.' : '',
          currentStage: isSuperAdminEmail ? 'STARTUP_STAGE' : undefined, 
          teamMembers: '',
        });
      }
      setPageLoading(false);
    }
  }, [authLoading, initialLoadComplete, user, userProfile, router, reset, isTeamMemberContext, isSuperAdminEmail, isParulEmail]);


  const processSubmit: SubmitHandler<ProfileSetupFormData> = async (data) => {
    if (!user) return;

    let roleToSet: Role;
    if (isSuperAdminEmail) {
      roleToSet = 'ADMIN_FACULTY';
    } else if (userProfile?.role) { 
      roleToSet = userProfile.role;
    } else if (isTeamMemberContext) { 
      roleToSet = isParulEmail ? 'STUDENT' : 'EXTERNAL_USER'; 
    } else if (data.role) { 
      roleToSet = data.role;
    } else {
      toast({ title: "Role Error", description: "User role could not be determined. Please select a role.", variant: "destructive" });
      return;
    }

    const formDataForContext: Omit<UserProfile, 'uid' | 'email' | 'displayName' | 'photoURL' | 'role' | 'isSuperAdmin' | 'createdAt' | 'updatedAt' | 'isTeamMemberOnly' | 'associatedIdeaId' | 'associatedTeamLeaderUid'> = {
      fullName: data.fullName,
      contactNumber: data.contactNumber,
      enrollmentNumber: data.enrollmentNumber,
      college: data.college,
      instituteName: data.instituteName,
      applicantCategory: isTeamMemberContext ? null : data.applicantCategory,
      startupTitle: isTeamMemberContext ? null : (isSuperAdminEmail && !isEditing ? 'Administrative Account' : data.startupTitle),
      problemDefinition: isTeamMemberContext ? null : (isSuperAdminEmail && !isEditing ? 'Handles portal administration.' : data.problemDefinition),
      solutionDescription: isTeamMemberContext ? null : (isSuperAdminEmail && !isEditing ? 'Provides administrative functions and support.' : data.solutionDescription),
      uniqueness: isTeamMemberContext ? null : (isSuperAdminEmail && !isEditing ? 'Unique administrative role for system management.' : data.uniqueness),
      currentStage: isTeamMemberContext ? null : (isSuperAdminEmail && !isEditing ? 'STARTUP_STAGE' : data.currentStage),
      teamMembers: isTeamMemberContext ? null : data.teamMembers,
    };
    
    try {
      await setRoleAndCompleteProfile(roleToSet, formDataForContext);
    } catch (error) {
      console.error("Profile setup submission error:", error);
    }
  };
  
  const handleDeleteOwnAccount = async () => {
    try {
        await deleteCurrentUserAccount();
    } catch (error) {
        // Error toast is handled by deleteCurrentUserAccount
    }
  };


  const showRoleSelection = !isEditing && !isSuperAdminEmail && !isTeamMemberContext;
  const showIdeaDetailsSection = 
    (isEditing && userProfile && !userProfile.isTeamMemberOnly && userProfile.role !== 'ADMIN_FACULTY') ||
    (!isEditing && !isTeamMemberContext && selectedRole && selectedRole !== 'ADMIN_FACULTY' && selectedRole !== 'EXTERNAL_USER');
  const showAdminPlaceholderIdeaFields = isSuperAdminEmail && !isEditing && !isTeamMemberContext;


  if (authLoading || !initialLoadComplete || pageLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoadingSpinner size={48} />
        <p className="ml-3 text-muted-foreground">Loading Profile Setup...</p>
      </div>
    );
  }

  if (!user) {
    return <p className="text-center py-10">User not found. Redirecting...</p>;
  }
  
  const pageTitle = isEditing ? "Edit Your Profile" : (isTeamMemberContext ? "Complete Your Team Member Profile" : "Set Up Your Profile");
  const pageDescription = isEditing 
    ? "Update your personal, academic, and startup information."
    : (isTeamMemberContext 
        ? `You're being added as a team member for "${isTeamMemberForIdea?.title || 'an idea'}" by ${teamLeaderProfileForMember?.displayName || 'the team leader'}. Please complete your details.`
        : "Provide your details to get started with the PIERC portal.");


  return (
    <div className="flex flex-col flex-1 items-center justify-start animate-fade-in">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader>
          <div className="flex items-center mb-2">
            <UserCircle className="h-10 w-10 text-primary mr-3" />
            <div>
              <CardTitle className="text-3xl font-headline">{pageTitle}</CardTitle>
              <CardDescription>{pageDescription}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(processSubmit)}>
          <CardContent className="space-y-6 max-h-[calc(100vh-22rem)] overflow-y-auto p-6 pr-3 md:pr-6"> 
            
            <section className="space-y-3 p-4 border rounded-md bg-muted/30">
              <h3 className="font-semibold text-lg text-primary">Account Information</h3>
              <div>
                <Label>Email Address</Label>
                <p className="text-sm text-foreground/80">{user.email || 'N/A'}</p>
              </div>
              {userProfile?.role && (
                <div>
                  <Label>Current Role</Label>
                  <p className="text-sm text-foreground/80 capitalize">{userProfile.role.replace('_', ' ').toLowerCase()}{userProfile.isSuperAdmin ? ' (Super Admin)' : ''}</p>
                </div>
              )}
            </section>

            <section className="space-y-4 pt-4">
              <h3 className="font-semibold text-lg text-primary border-t pt-4">Personal Information</h3>
              <div>
                <Label htmlFor="fullName">Full Name *</Label>
                <Controller name="fullName" control={control} render={({ field }) => <Input id="fullName" placeholder="Enter your full name" {...field} />} />
                {errors.fullName && <p className="text-sm text-destructive mt-1">{errors.fullName.message}</p>}
              </div>
              <div>
                <Label htmlFor="contactNumber">Contact Number *</Label>
                <Controller name="contactNumber" control={control} render={({ field }) => <Input id="contactNumber" type="tel" placeholder="e.g., +91 XXXXXXXXXX" {...field} />} />
                {errors.contactNumber && <p className="text-sm text-destructive mt-1">{errors.contactNumber.message}</p>}
              </div>
            </section>

            {showRoleSelection && (
              <section className="space-y-4 pt-4">
                <h3 className="font-semibold text-lg text-primary border-t pt-4">Your Role *</h3>
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup onValueChange={field.onChange} value={field.value || undefined} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {rolesForSelection.map(r => (
                        <Label key={r.value} htmlFor={`role-${r.value}`} className="flex items-center space-x-2 rounded-md border p-3 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary cursor-pointer">
                          <RadioGroupItem value={r.value!} id={`role-${r.value}`} />
                          <span>{r.label}</span>
                        </Label>
                      ))}
                    </RadioGroup>
                  )}
                />
                {errors.role && <p className="text-sm text-destructive mt-1">{errors.role.message}</p>}
                <p className="text-xs text-muted-foreground">Select the role that best describes you.</p>
              </section>
            )}

            <section className="space-y-4 pt-4">
              <h3 className="font-semibold text-lg text-primary border-t pt-4">Academic & Institutional Information</h3>
              {(isParulEmail || (!isTeamMemberContext && selectedApplicantCategory === 'PARUL_STUDENT' && showIdeaDetailsSection)) && (
                <>
                  <div>
                    <Label htmlFor="enrollmentNumber">Enrollment Number {(!isTeamMemberContext && selectedApplicantCategory === 'PARUL_STUDENT' && showIdeaDetailsSection) && '*'}</Label>
                    <Controller name="enrollmentNumber" control={control} render={({ field }) => <Input id="enrollmentNumber" placeholder="Parul University Enrollment No." {...field} value={field.value || ''} />} />
                    {errors.enrollmentNumber && <p className="text-sm text-destructive mt-1">{errors.enrollmentNumber.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="college">College/Faculty at Parul University {(!isTeamMemberContext && selectedApplicantCategory === 'PARUL_STUDENT' && showIdeaDetailsSection) && '*'}</Label>
                    <Controller name="college" control={control} render={({ field }) => <Input id="college" placeholder="e.g., Parul Institute of Engineering" {...field} value={field.value || ''} />} />
                    {errors.college && <p className="text-sm text-destructive mt-1">{errors.college.message}</p>}
                  </div>
                </>
              )}
              {(!isParulEmail || (!isTeamMemberContext && selectedApplicantCategory === 'OTHERS' && showIdeaDetailsSection)) && (
                <div>
                  <Label htmlFor="instituteName">Institute/Organization Name</Label>
                  <Controller name="instituteName" control={control} render={({ field }) => <Input id="instituteName" placeholder="Your institute or organization" {...field} value={field.value || ''} />} />
                  {errors.instituteName && <p className="text-sm text-destructive mt-1">{errors.instituteName.message}</p>}
                </div>
              )}
               {(!isTeamMemberContext && (selectedApplicantCategory === 'PARUL_STAFF' || selectedApplicantCategory === 'PARUL_ALUMNI') && !isParulEmail && showIdeaDetailsSection) && (
                <div>
                    <Label htmlFor="college">Department/Last Affiliated College at PU</Label>
                    <Controller name="college" control={control} render={({ field }) => <Input id="college" placeholder="e.g., Dept of CS / PIET" {...field} value={field.value || ''} />} />
                    {errors.college && <p className="text-sm text-destructive mt-1">{errors.college.message}</p>}
                </div>
              )}
            </section>

            {(showIdeaDetailsSection || showAdminPlaceholderIdeaFields) && (
              <section className="space-y-4 pt-4">
                <div className="flex items-center gap-2 border-t pt-4">
                    <Lightbulb className="h-6 w-6 text-primary" />
                    <h3 className="font-semibold text-lg text-primary">Your Startup / Idea Details</h3>
                </div>
                 <p className="text-xs text-muted-foreground -mt-3">
                    {isEditing ? "Manage your existing startup/idea information." : "Tell us about your innovative concept."}
                    {showAdminPlaceholderIdeaFields && " (These are placeholder details for your admin account.)"}
                 </p>
                
                {!showAdminPlaceholderIdeaFields && (
                    <>
                        <div>
                        <Label>Applicant Category *</Label>
                        <Controller
                            name="applicantCategory"
                            control={control}
                            render={({ field }) => (
                            <RadioGroup onValueChange={field.onChange} value={field.value || undefined} className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
                                {applicantCategories.map(({value, label}) => (
                                <Label key={value} htmlFor={`ac-${value}`} className="flex flex-col items-center text-center justify-center rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary cursor-pointer text-xs sm:text-sm">
                                    <RadioGroupItem value={value} id={`ac-${value}`} className="sr-only" /> {label}
                                </Label>
                                ))}
                            </RadioGroup>
                            )} />
                        {errors.applicantCategory && <p className="text-sm text-destructive mt-1">{errors.applicantCategory.message}</p>}
                        </div>
                        <div>
                        <Label htmlFor="startupTitle">Title of the Startup/Idea *</Label>
                        <Controller name="startupTitle" control={control} render={({ field }) => <Input id="startupTitle" placeholder="Your brilliant startup/idea name" {...field} />} />
                        {errors.startupTitle && <p className="text-sm text-destructive mt-1">{errors.startupTitle.message}</p>}
                        </div>
                    </>
                )}
                {showAdminPlaceholderIdeaFields && (
                    <>
                        <div><Label>Applicant Category</Label><Input value="Parul Staff (Admin)" disabled /></div>
                        <div><Label>Startup Title</Label><Input value="Administrative Account" disabled /></div>
                    </>
                )}


                <div>
                  <Label htmlFor="teamMembers">Team Members (Names, comma-separated, if any)</Label>
                  <Controller name="teamMembers" control={control} render={({ field }) => <Input id="teamMembers" placeholder="e.g., John Doe, Jane Smith (or 'Solo Innovator')" {...field} value={field.value || ''}/>} />
                  {errors.teamMembers && <p className="text-sm text-destructive mt-1">{errors.teamMembers.message}</p>}
                </div>
                <div>
                  <Label htmlFor="problemDefinition">Define the Problem you are solving *</Label>
                  <Controller name="problemDefinition" control={control} render={({ field }) => <Textarea id="problemDefinition" placeholder="Clearly describe the problem statement" {...field} rows={3} disabled={showAdminPlaceholderIdeaFields}/>} />
                  {errors.problemDefinition && <p className="text-sm text-destructive mt-1">{errors.problemDefinition.message}</p>}
                </div>
                <div>
                  <Label htmlFor="solutionDescription">Describe your Solution *</Label>
                  <Controller name="solutionDescription" control={control} render={({ field }) => <Textarea id="solutionDescription" placeholder="Explain your proposed solution in detail" {...field} rows={3} disabled={showAdminPlaceholderIdeaFields}/>} />
                  {errors.solutionDescription && <p className="text-sm text-destructive mt-1">{errors.solutionDescription.message}</p>}
                </div>
                <div>
                  <Label htmlFor="uniqueness">What is Unique/Distinctive about your idea? *</Label>
                  <Controller name="uniqueness" control={control} render={({ field }) => <Textarea id="uniqueness" placeholder="Highlight the novelty and competitive advantage" {...field} rows={3} disabled={showAdminPlaceholderIdeaFields}/>} />
                  {errors.uniqueness && <p className="text-sm text-destructive mt-1">{errors.uniqueness.message}</p>}
                </div>
                {!showAdminPlaceholderIdeaFields && (
                    <div>
                    <Label>Current Stage of your Idea/Startup *</Label>
                    <Controller
                        name="currentStage"
                        control={control}
                        render={({ field }) => (
                        <RadioGroup onValueChange={field.onChange} value={field.value || undefined} className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-1">
                            {currentStages.map(({value, label}) => (
                            <Label key={value} htmlFor={`cs-${value}`} className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary cursor-pointer">
                                <RadioGroupItem value={value} id={`cs-${value}`} className="sr-only" /> {label}
                            </Label>
                            ))}
                        </RadioGroup>
                        )} />
                    {errors.currentStage && <p className="text-sm text-destructive mt-1">{errors.currentStage.message}</p>}
                    </div>
                )}
                 {showAdminPlaceholderIdeaFields && (
                    <div><Label>Current Stage</Label><Input value="Startup Stage (System)" disabled /></div>
                 )}
              </section>
            )}
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row justify-between items-center pt-6 border-t">
            <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting || pageLoading}>
              {(isSubmitting || pageLoading) && <LoadingSpinner className="mr-2" />}
              {isEditing ? 'Save Changes' : 'Save Profile & Proceed'}
            </Button>
            {isEditing && user?.email !== 'pranavrathi07@gmail.com' && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button type="button" variant="destructive" className="w-full sm:w-auto mt-3 sm:mt-0">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete My Account
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center"><AlertTriangle className="text-destructive mr-2"/>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete your account and all associated data from the PIERC portal.
                            If you are a team leader, this will also affect your team's idea submission.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteOwnAccount} className="bg-destructive hover:bg-destructive/90">
                            Yes, delete my account
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

