
'use client';

import { useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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

// Base schema for all profile fields required by PRD
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

// Schema for Parul University email users (role is 'STUDENT')
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
    if (!data.instituteName || data.instituteName.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Institute name is required for "Others".', path: ['instituteName'] });
    }
  }
});

// Schema for other users (role can be 'EXTERNAL_USER' or 'ADMIN_FACULTY')
// ADMIN_FACULTY is allowed here for pranavrathi07@gmail.com, others will be EXTERNAL_USER
const otherUserSchema = profileBaseSchema.extend({
  role: z.enum(['EXTERNAL_USER', 'ADMIN_FACULTY']),
}).superRefine((data, ctx) => {
  if (data.applicantCategory === 'PARUL_STUDENT') {
     ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Parul Student category only for @paruluniversity.ac.in emails.', path: ['applicantCategory'] });
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

  const isParulEmail = useMemo(() => user?.email?.endsWith('@paruluniversity.ac.in') || false, [user]);
  const isAdminEmail = useMemo(() => user?.email === 'pranavrathi07@gmail.com', [user]);

  const determinedRole = useMemo<Role>(() => {
    if (isAdminEmail) return 'ADMIN_FACULTY';
    if (isParulEmail) return 'STUDENT';
    return 'EXTERNAL_USER';
  }, [isAdminEmail, isParulEmail]);
  
  const profileSchema = isParulEmail ? parulUserSchema : otherUserSchema;

  const { control, handleSubmit, watch, formState: { errors, isSubmitting }, setValue, trigger } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.displayName || '',
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
    if (initialLoadComplete && !user) {
      router.push('/login');
    }
    if (initialLoadComplete && user && userProfile) {
      router.push('/dashboard');
    }
  }, [user, userProfile, initialLoadComplete, router]);

  useEffect(() => {
    if (user && !control._formValues.fullName && user.displayName) {
       setValue('fullName', user.displayName);
    }
    // Set determined role when user or role logic changes
    setValue('role', determinedRole);
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
      // The `data.role` here will be the programmatically determined role.
      // AuthContext will also apply its own check for the admin email.
      await setRoleAndCompleteProfile(data.role as Role, data);
    } catch (error) {
      console.error("Profile setup failed", error);
    }
  };
  
  if (!initialLoadComplete || loading && !userProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size={48} />
      </div>
    );
  }

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen"><p>Redirecting to login...</p><LoadingSpinner size={32}/></div>;
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
          <CardTitle className="text-3xl font-headline">Complete Your PIERC Portal Profile</CardTitle>
          <CardDescription>Welcome, {user?.displayName || 'User'}! Please provide these details to get started.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
            <div>
              <Label>Your Role</Label>
              <Input value={getRoleDisplayString(determinedRole)} readOnly className="bg-muted/50"/>
              {/* Hidden input to ensure react-hook-form has the role value */}
              <Controller name="role" control={control} render={({ field }) => <input type="hidden" {...field} />} />
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
                  <RadioGroup onValueChange={field.onChange} defaultValue={field.value as ApplicantCategory | undefined} className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
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
                  <RadioGroup onValueChange={field.onChange} defaultValue={field.value as CurrentStage | undefined} className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
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
              Save Profile & Proceed
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

