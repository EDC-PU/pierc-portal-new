
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Role, ApplicantCategory, CurrentStage } from '@/types';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';

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

const profileBaseSchema = z.object({
  fullName: z.string().min(3, 'Full name must be at least 3 characters').max(100),
  contactNumber: z.string().min(10, 'Contact number must be at least 10 digits').max(15, 'Contact number seems too long'),
  applicantCategory: z.enum(['PARUL_STUDENT', 'PARUL_STAFF', 'PARUL_ALUMNI', 'OTHERS'], {
    required_error: 'You need to select an applicant category.',
  }),
  teamMembers: z.string().max(500, 'Team members list is too long').optional().default(''),
  startupTitle: z.string().min(5, 'Startup title must be at least 5 characters').max(200),
  problemDefinition: z.string().min(20, 'Problem definition must be at least 20 characters').max(2000),
  solutionDescription: z.string().min(20, 'Solution description must be at least 20 characters').max(2000),
  uniqueness: z.string().min(20, 'Uniqueness description must be at least 20 characters').max(2000),
  currentStage: z.enum(['IDEA', 'PROTOTYPE_STAGE', 'STARTUP_STAGE'], {
    required_error: 'You need to select the current stage.',
  }),
  enrollmentNumber: z.string().optional(),
  college: z.string().optional(),
  instituteName: z.string().optional(),
});

const parulUserSchema = profileBaseSchema.extend({
  role: z.literal('STUDENT'),
}).superRefine((data, ctx) => {
  if (data.applicantCategory === 'PARUL_STUDENT') {
    if (!data.enrollmentNumber || data.enrollmentNumber.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enrollment number is required for Parul students.', path: ['enrollmentNumber'] });
    }
    if (!data.college || data.college.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'College is required for Parul students.', path: ['college'] });
    }
  } else if (data.applicantCategory === 'PARUL_STAFF' || data.applicantCategory === 'PARUL_ALUMNI') {
    if (!data.college || data.college.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'College name is required for Parul staff/alumni.', path: ['college'] });
    }
  } else if (data.applicantCategory === 'OTHERS') {
    // This case should not be reachable if role is STUDENT and category is OTHERS,
    // as @paruluniversity.ac.in emails get STUDENT role.
    // If a non-Parul email user somehow got STUDENT role and selected OTHERS, it's an edge case.
    // For now, schema implies student role is tied to Parul categories.
  }
});

const otherUserSchema = profileBaseSchema.extend({
  role: z.enum(['EXTERNAL_USER', 'ADMIN_FACULTY']),
}).superRefine((data, ctx) => {
  if (data.role === 'ADMIN_FACULTY') {
    if (data.applicantCategory !== 'OTHERS') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Admin category should be OTHERS.', path: ['applicantCategory'] });
    }
    if (!data.instituteName && data.applicantCategory === 'OTHERS') { // Admins are categorized as 'OTHERS' with an institute.
         ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Institute name is required for Admin role (e.g., PIERC Administration).', path: ['instituteName']});
    }
    return; // Skip other non-admin specific checks
  }

  // For EXTERNAL_USER role
  if (data.applicantCategory === 'PARUL_STUDENT') {
     ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Parul Student category is only for @paruluniversity.ac.in emails.', path: ['applicantCategory'] });
  } else if (data.applicantCategory === 'PARUL_STAFF' || data.applicantCategory === 'PARUL_ALUMNI') {
    if (!data.college || data.college.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'College name is required for Parul staff/alumni.', path: ['college'] });
    }
  } else if (data.applicantCategory === 'OTHERS') {
    if (!data.instituteName || data.instituteName.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Institute name is required for "Others".', path: ['instituteName'] });
    }
  }
});

type ProfileFormData = z.infer<typeof parulUserSchema> | z.infer<typeof otherUserSchema>;

export default function ProfileSetupPage() {
  const { user, userProfile, setRoleAndCompleteProfile, loading, signOut, initialLoadComplete } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isAutoSubmittingAdmin, setIsAutoSubmittingAdmin] = useState(false);

  const isParulEmail = useMemo(() => user?.email?.endsWith('@paruluniversity.ac.in') || false, [user]);
  const isAdminEmail = useMemo(() => user?.email === 'pranavrathi07@gmail.com', [user]);

  const determinedRole = useMemo<Role>(() => {
    if (isAdminEmail) return 'ADMIN_FACULTY';
    if (isParulEmail) return 'STUDENT';
    return 'EXTERNAL_USER';
  }, [isAdminEmail, isParulEmail]);

  const profileSchema = determinedRole === 'STUDENT' ? parulUserSchema : otherUserSchema;

  const { control, handleSubmit, watch, formState: { errors, isSubmitting }, setValue, trigger, reset } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: '',
      role: determinedRole,
      contactNumber: '',
      applicantCategory: undefined,
      teamMembers: '',
      startupTitle: '',
      problemDefinition: '',
      solutionDescription: '',
      uniqueness: '',
      currentStage: undefined,
      enrollmentNumber: '',
      college: '',
      instituteName: '',
    },
  });

  const selectedApplicantCategory = watch('applicantCategory');

  useEffect(() => {
    // Populate form with existing profile data if userProfile exists
    if (userProfile) {
      reset({
        fullName: userProfile.fullName || user?.displayName || '',
        role: userProfile.role || determinedRole,
        contactNumber: userProfile.contactNumber || '',
        applicantCategory: userProfile.applicantCategory || undefined,
        teamMembers: userProfile.teamMembers || '',
        startupTitle: userProfile.startupTitle || '',
        problemDefinition: userProfile.problemDefinition || '',
        solutionDescription: userProfile.solutionDescription || '',
        uniqueness: userProfile.uniqueness || '',
        currentStage: userProfile.currentStage || undefined,
        enrollmentNumber: userProfile.enrollmentNumber || '',
        college: userProfile.college || '',
        instituteName: userProfile.instituteName || '',
      });
    } else if (user) {
      // For new profiles, pre-fill with Firebase Auth display name if available
      reset({
        ...control._formValues, // Keep existing form values if any (e.g. role)
        fullName: user.displayName || '',
        role: determinedRole, // Ensure role is set based on email
      });
    }
  }, [userProfile, user, determinedRole, reset, control]);


  useEffect(() => {
    if (initialLoadComplete && !user) {
      router.push('/login'); // Redirect to login if not authenticated and auth state is fully loaded.
    }
    // DashboardLayout handles redirecting to /profile-setup if user is authenticated but profile is null.
    // No need for an explicit redirect from here TO /dashboard if profile is complete,
    // as the user might be intentionally visiting to edit.
  }, [user, initialLoadComplete, router]);

  useEffect(() => {
    // Auto-submit profile for admin if not already done and auth is fully initialized.
    if (initialLoadComplete && user && determinedRole === 'ADMIN_FACULTY' && !userProfile && !isAutoSubmittingAdmin) {
      const autoSubmitAdminProfile = async () => {
        setIsAutoSubmittingAdmin(true);
        toast({ title: "Setting up Admin Account", description: "Please wait..." });

        const adminDefaults: ProfileFormData = {
          role: 'ADMIN_FACULTY',
          fullName: user?.displayName || 'Admin User',
          contactNumber: '0000000000',
          applicantCategory: 'OTHERS',
          instituteName: 'PIERC Administration',
          teamMembers: 'N/A',
          startupTitle: 'Administrative Account',
          problemDefinition: 'This is an administrative account, not applicable for startup details.',
          solutionDescription: 'This is an administrative account, not applicable for startup details.',
          uniqueness: 'This is an administrative account, not applicable for startup details.',
          currentStage: 'IDEA',
        };
        try {
          await setRoleAndCompleteProfile('ADMIN_FACULTY', adminDefaults);
        } catch (error) {
          console.error("Admin profile auto-setup failed", error);
          toast({ title: "Admin Setup Error", description: "Could not auto-setup admin profile. Please try again or contact support.", variant: "destructive" });
          setIsAutoSubmittingAdmin(false);
        }
      };
      autoSubmitAdminProfile();
    }
  }, [initialLoadComplete, user, determinedRole, userProfile, setRoleAndCompleteProfile, toast, router, isAutoSubmittingAdmin]);


  useEffect(() => {
    // Ensure role is set based on email, and fullName is pre-filled if not already in form values
    if (user) {
      if (!control._formValues.fullName && user.displayName) {
         setValue('fullName', user.displayName);
      }
      setValue('role', determinedRole);
    }
  }, [user, control, determinedRole, setValue]);

  useEffect(() => {
    if (selectedApplicantCategory) {
        trigger(['enrollmentNumber', 'college', 'instituteName']);
    }
  }, [selectedApplicantCategory, trigger]);

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) {
      toast({ title: "Error", description: "You are not logged in.", variant: "destructive" });
      return;
    }
    try {
      await setRoleAndCompleteProfile(data.role as Role, data);
    } catch (error) {
      console.error("Profile setup failed on submit", error);
    }
  };

  if (!initialLoadComplete || (loading && !isAutoSubmittingAdmin && !userProfile) || (isAutoSubmittingAdmin && !userProfile)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size={48} />
        {isAutoSubmittingAdmin && <p className="ml-4">Setting up Administrator account...</p>}
      </div>
    );
  }

  if (!user && initialLoadComplete) {
    return <div className="flex items-center justify-center min-h-screen"><p>Redirecting to login...</p><LoadingSpinner size={32}/></div>;
  }

  if (determinedRole === 'ADMIN_FACULTY') {
     if (!userProfile && !isAutoSubmittingAdmin) { // Admin setup failed
        return (
             <div className="flex flex-col items-center justify-center min-h-screen">
                <p className="text-destructive mb-4">Administrator account setup encountered an issue.</p>
                <p className="text-muted-foreground mb-4">Please ensure your Firestore permissions are correctly set.</p>
                <Button onClick={() => window.location.reload()}>Try Again</Button>
                <Button variant="link" onClick={signOut} className="mt-2">Logout</Button>
            </div>
        );
     }
     // If admin profile exists or is being auto-submitted, AuthContext or other effects will redirect to dashboard.
     // This return is a safety net during the brief period before redirection or while auto-submitting.
     if (userProfile || isAutoSubmittingAdmin) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p>Redirecting to dashboard or completing setup...</p>
                <LoadingSpinner size={32} />
            </div>
        );
     }
  }

  const getRoleDisplayString = (role: Role) => {
    if (role === 'ADMIN_FACULTY') return 'Administrator / Faculty';
    if (role === 'STUDENT') return 'Student (Parul University)';
    if (role === 'EXTERNAL_USER') return 'External User';
    return 'N/A';
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] py-12 animate-fade-in">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">
            {userProfile ? 'Edit Your PIERC Portal Profile' : 'Complete Your PIERC Portal Profile'}
          </CardTitle>
          <CardDescription>
            {userProfile ? 'Update your details as needed.' : `Welcome, ${user?.displayName || 'User'}! Please provide these details to get started.`}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
            <div>
              <Label>Your Role (auto-assigned)</Label>
              <Input value={getRoleDisplayString(determinedRole)} readOnly className="bg-muted/50"/>
              <Controller name="role" control={control} render={({ field }) => <input type="hidden" {...field} value={determinedRole} />} />
              {errors.role && <p className="text-sm text-destructive mt-1">{(errors.role as any).message}</p>}
            </div>

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
             <div>
              <Label>Applicant Category *</Label>
              <Controller
                name="applicantCategory"
                control={control}
                render={({ field }) => (
                  <RadioGroup onValueChange={field.onChange} value={field.value as ApplicantCategory | undefined} className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                    {applicantCategories.map(({value, label}) => (
                       <Label key={value} htmlFor={value} className="flex flex-col items-center text-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary cursor-pointer text-xs sm:text-sm">
                        <RadioGroupItem value={value} id={value} className="sr-only" /> {label}
                      </Label>
                    ))}
                  </RadioGroup>
                )} />
              {errors.applicantCategory && <p className="text-sm text-destructive mt-1">{errors.applicantCategory.message}</p>}
            </div>

            {selectedApplicantCategory === 'PARUL_STUDENT' && (
              <>
                <div>
                  <Label htmlFor="enrollmentNumber">Enrollment Number *</Label>
                  <Controller name="enrollmentNumber" control={control} render={({ field }) => <Input id="enrollmentNumber" placeholder="Your Parul Enrollment Number" {...field} value={field.value || ''} />} />
                  {errors.enrollmentNumber && <p className="text-sm text-destructive mt-1">{errors.enrollmentNumber.message}</p>}
                </div>
                <div>
                  <Label htmlFor="college">College/Faculty at Parul University *</Label>
                  <Controller name="college" control={control} render={({ field }) => <Input id="college" placeholder="e.g., Parul Institute of Engineering & Technology" {...field} value={field.value || ''} />} />
                  {errors.college && <p className="text-sm text-destructive mt-1">{errors.college.message}</p>}
                </div>
              </>
            )}
             {(selectedApplicantCategory === 'PARUL_STAFF' || selectedApplicantCategory === 'PARUL_ALUMNI') && (
                <div>
                  <Label htmlFor="college">College/Department/Last Affiliated College at Parul University *</Label>
                  <Controller name="college" control={control} render={({ field }) => <Input id="college" placeholder="e.g., Department of Computer Science / PIET" {...field} value={field.value || ''} />} />
                  {errors.college && <p className="text-sm text-destructive mt-1">{errors.college.message}</p>}
                </div>
            )}
            {selectedApplicantCategory === 'OTHERS' && (
              <div>
                <Label htmlFor="instituteName">Name of Institute/Organization *</Label>
                <Controller name="instituteName" control={control} render={({ field }) => <Input id="instituteName" placeholder="Your institute/organization name" {...field} value={field.value || ''} />} />
                {errors.instituteName && <p className="text-sm text-destructive mt-1">{errors.instituteName.message}</p>}
              </div>
            )}

            <div>
              <Label htmlFor="startupTitle">Title of the Startup/Idea/Innovation *</Label>
              <Controller name="startupTitle" control={control} render={({ field }) => <Input id="startupTitle" placeholder="Your amazing idea title" {...field} />} />
              {errors.startupTitle && <p className="text-sm text-destructive mt-1">{errors.startupTitle.message}</p>}
            </div>
            <div>
              <Label htmlFor="teamMembers">Team Members (Names, comma-separated)</Label>
              <Controller name="teamMembers" control={control} render={({ field }) => <Input id="teamMembers" placeholder="e.g., John Doe, Jane Smith (leave empty if none)" {...field} value={field.value || ''}/>} />
              {errors.teamMembers && <p className="text-sm text-destructive mt-1">{errors.teamMembers.message}</p>}
            </div>
            <div>
              <Label htmlFor="problemDefinition">Define the Problem * (Min. 20 characters)</Label>
              <Controller name="problemDefinition" control={control} render={({ field }) => <Textarea id="problemDefinition" placeholder="What problem are you solving?" {...field} rows={4}/>} />
              {errors.problemDefinition && <p className="text-sm text-destructive mt-1">{errors.problemDefinition.message}</p>}
            </div>
            <div>
              <Label htmlFor="solutionDescription">Describe the Solution * (Min. 20 characters)</Label>
              <Controller name="solutionDescription" control={control} render={({ field }) => <Textarea id="solutionDescription" placeholder="How does your idea solve it?" {...field} rows={4}/>} />
              {errors.solutionDescription && <p className="text-sm text-destructive mt-1">{errors.solutionDescription.message}</p>}
            </div>
            <div>
              <Label htmlFor="uniqueness">Explain Uniqueness/Distinctiveness * (Min. 20 characters)</Label>
              <Controller name="uniqueness" control={control} render={({ field }) => <Textarea id="uniqueness" placeholder="What makes your idea unique?" {...field} rows={4}/>} />
              {errors.uniqueness && <p className="text-sm text-destructive mt-1">{errors.uniqueness.message}</p>}
            </div>
            <div>
              <Label>Current Stage of Your Idea/Startup *</Label>
               <Controller
                name="currentStage"
                control={control}
                render={({ field }) => (
                  <RadioGroup onValueChange={field.onChange} value={field.value as CurrentStage | undefined} className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                    {currentStages.map(({value, label}) => (
                       <Label key={value} htmlFor={`cs-${value}`} className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary cursor-pointer">
                        <RadioGroupItem value={value} id={`cs-${value}`} className="sr-only" /> {label}
                      </Label>
                    ))}
                  </RadioGroup>
                )} />
              {errors.currentStage && <p className="text-sm text-destructive mt-1">{errors.currentStage.message}</p>}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pt-6">
            <Button type="submit" className="w-full" disabled={isSubmitting || loading}>
              {isSubmitting || loading ? <LoadingSpinner className="mr-2" /> : null}
              {userProfile ? 'Update Profile' : 'Save Profile & Proceed'}
            </Button>
            <Button variant="link" onClick={signOut} className="text-muted-foreground">
              Logout
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
