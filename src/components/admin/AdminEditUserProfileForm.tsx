
'use client';

import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import type { UserProfile, Role, ApplicantCategory, CurrentStage } from '@/types';

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

// Base schema for fields common to all or most editable profiles
const baseProfileSchema = z.object({
  fullName: z.string().min(3, 'Full name must be at least 3 characters').max(100),
  contactNumber: z.string().min(10, 'Contact number must be at least 10 digits').max(15, 'Contact number seems too long'),
  enrollmentNumber: z.string().optional(),
  college: z.string().optional(),
  instituteName: z.string().optional(),
});

// Schema for idea owners (non-team members)
const ideaOwnerEditableSchema = baseProfileSchema.extend({
  applicantCategory: z.enum(['PARUL_STUDENT', 'PARUL_STAFF', 'PARUL_ALUMNI', 'OTHERS'], {
    required_error: 'Applicant category is required.',
  }),
  startupTitle: z.string().min(5, 'Startup title must be at least 5 characters').max(200),
  problemDefinition: z.string().min(20, 'Problem definition is required').max(2000),
  solutionDescription: z.string().min(20, 'Solution description is required').max(2000),
  uniqueness: z.string().min(20, 'Uniqueness description is required').max(2000),
  currentStage: z.enum(['IDEA', 'PROTOTYPE_STAGE', 'STARTUP_STAGE'], {
    required_error: 'Current stage is required.',
  }),
  teamMembers: z.string().max(500, 'Team members list is too long').optional().default(''),
});

// Schema for team members (isTeamMemberOnly = true)
const teamMemberEditableSchema = baseProfileSchema;


export type AdminEditableProfileFormData = z.infer<typeof ideaOwnerEditableSchema> | z.infer<typeof teamMemberEditableSchema>;

interface AdminEditUserProfileFormProps {
  targetUserProfile: UserProfile;
  onSave: (updatedData: Partial<UserProfile>) => Promise<void>;
  onCancel: () => void;
}

export function AdminEditUserProfileForm({ targetUserProfile, onSave, onCancel }: AdminEditUserProfileFormProps) {
  const isTargetParulEmail = useMemo(() => targetUserProfile?.email?.endsWith('@paruluniversity.ac.in') || false, [targetUserProfile]);

  // Determine if the target user is primarily an idea owner or a team member based on their profile
  const isTargetTeamMemberOnly = targetUserProfile.isTeamMemberOnly === true;

  const activeSchema = useMemo(() => {
    return isTargetTeamMemberOnly ? teamMemberEditableSchema : ideaOwnerEditableSchema;
  }, [isTargetTeamMemberOnly]);


  const { control, handleSubmit, watch, formState: { errors, isSubmitting }, reset, trigger } = useForm<AdminEditableProfileFormData>({
    resolver: zodResolver(activeSchema),
    defaultValues: {},
  });

  useEffect(() => {
    // Populate form with targetUserProfile data
    const defaultVals: Partial<AdminEditableProfileFormData> = {
      fullName: targetUserProfile.fullName || '',
      contactNumber: targetUserProfile.contactNumber || '',
      enrollmentNumber: targetUserProfile.enrollmentNumber || '',
      college: targetUserProfile.college || '',
      instituteName: targetUserProfile.instituteName || '',
    };
    if (!isTargetTeamMemberOnly) {
        // Add idea owner specific fields
        (defaultVals as Partial<z.infer<typeof ideaOwnerEditableSchema>>).applicantCategory = targetUserProfile.applicantCategory || undefined;
        (defaultVals as Partial<z.infer<typeof ideaOwnerEditableSchema>>).startupTitle = targetUserProfile.startupTitle || '';
        (defaultVals as Partial<z.infer<typeof ideaOwnerEditableSchema>>).problemDefinition = targetUserProfile.problemDefinition || '';
        (defaultVals as Partial<z.infer<typeof ideaOwnerEditableSchema>>).solutionDescription = targetUserProfile.solutionDescription || '';
        (defaultVals as Partial<z.infer<typeof ideaOwnerEditableSchema>>).uniqueness = targetUserProfile.uniqueness || '';
        (defaultVals as Partial<z.infer<typeof ideaOwnerEditableSchema>>).currentStage = targetUserProfile.currentStage || undefined;
        (defaultVals as Partial<z.infer<typeof ideaOwnerEditableSchema>>).teamMembers = targetUserProfile.teamMembers || '';
    }
    reset(defaultVals);
  }, [targetUserProfile, reset, isTargetTeamMemberOnly]);

  const selectedApplicantCategory = watch('applicantCategory' as keyof z.infer<typeof ideaOwnerEditableSchema>);

  useEffect(() => {
    if (!isTargetTeamMemberOnly && selectedApplicantCategory) {
        trigger(['enrollmentNumber', 'college', 'instituteName']);
    }
  }, [selectedApplicantCategory, trigger, isTargetTeamMemberOnly]);


  const processSubmit = async (formData: AdminEditableProfileFormData) => {
    // Construct the data to save, only including fields relevant to the schema
    const dataToSave: Partial<UserProfile> = {
        fullName: formData.fullName,
        contactNumber: formData.contactNumber,
        enrollmentNumber: formData.enrollmentNumber || undefined,
        college: formData.college || undefined,
        instituteName: formData.instituteName || undefined,
    };

    if (!isTargetTeamMemberOnly) {
        const ideaOwnerData = formData as z.infer<typeof ideaOwnerEditableSchema>;
        dataToSave.applicantCategory = ideaOwnerData.applicantCategory;
        dataToSave.startupTitle = ideaOwnerData.startupTitle;
        dataToSave.problemDefinition = ideaOwnerData.problemDefinition;
        dataToSave.solutionDescription = ideaOwnerData.solutionDescription;
        dataToSave.uniqueness = ideaOwnerData.uniqueness;
        dataToSave.currentStage = ideaOwnerData.currentStage;
        dataToSave.teamMembers = ideaOwnerData.teamMembers;
    }

    await onSave(dataToSave);
  };

  return (
    <form onSubmit={handleSubmit(processSubmit)} className="space-y-6 py-4 max-h-[75vh] overflow-y-auto pr-2">
        <div className="p-4 border-b mb-4">
            <h3 className="text-lg font-medium">Editing Profile for: {targetUserProfile.displayName || targetUserProfile.email}</h3>
            <p className="text-sm text-muted-foreground">Role: {targetUserProfile.role?.replace('_', ' ').toLowerCase() || 'N/A'} {targetUserProfile.isSuperAdmin ? '(Super Admin)' : ''}</p>
            {isTargetTeamMemberOnly && targetUserProfile.associatedIdeaId && <p className="text-sm text-muted-foreground">Team Member for an idea.</p>}
        </div>
        <div>
            <Label htmlFor="fullNameAdmin">Full Name *</Label>
            <Controller name="fullName" control={control} render={({ field }) => <Input id="fullNameAdmin" placeholder="Full name" {...field} />} />
            {errors.fullName && <p className="text-sm text-destructive mt-1">{errors.fullName.message}</p>}
        </div>
        <div>
            <Label htmlFor="contactNumberAdmin">Contact Number *</Label>
            <Controller name="contactNumber" control={control} render={({ field }) => <Input id="contactNumberAdmin" type="tel" placeholder="+91 XXXXXXXXXX" {...field} />} />
            {errors.contactNumber && <p className="text-sm text-destructive mt-1">{errors.contactNumber.message}</p>}
        </div>

        {isTargetParulEmail && (
            <>
            <div>
                <Label htmlFor="enrollmentNumberAdmin">Enrollment Number</Label>
                <Controller name="enrollmentNumber" control={control} render={({ field }) => <Input id="enrollmentNumberAdmin" placeholder="Parul Enrollment Number" {...field} value={field.value || ''} />} />
                {errors.enrollmentNumber && <p className="text-sm text-destructive mt-1">{errors.enrollmentNumber.message}</p>}
            </div>
            <div>
                <Label htmlFor="collegeAdmin">College/Faculty at Parul University</Label>
                <Controller name="college" control={control} render={({ field }) => <Input id="collegeAdmin" placeholder="e.g., Parul Institute of Engineering & Technology" {...field} value={field.value || ''} />} />
                {errors.college && <p className="text-sm text-destructive mt-1">{errors.college.message}</p>}
            </div>
            </>
        )}

        {(!isTargetParulEmail || (!isTargetTeamMemberOnly && selectedApplicantCategory === 'OTHERS')) && (
             <div>
                <Label htmlFor="instituteNameAdmin">Institute/Organization Name</Label>
                <Controller name="instituteName" control={control} render={({ field }) => <Input id="instituteNameAdmin" placeholder="Institute/Organization name" {...field} value={field.value || ''} />} />
                {errors.instituteName && <p className="text-sm text-destructive mt-1">{errors.instituteName.message}</p>}
            </div>
        )}
        
        {!isTargetTeamMemberOnly && (selectedApplicantCategory === 'PARUL_STAFF' || selectedApplicantCategory === 'PARUL_ALUMNI') && !isTargetParulEmail && (
            <div>
                <Label htmlFor="collegeAdminStaffAlumni">College/Department/Last Affiliated College at PU</Label>
                <Controller name="college" control={control} render={({ field }) => <Input id="collegeAdminStaffAlumni" placeholder="e.g., Dept of CS / PIET" {...field} value={field.value || ''} />} />
                {errors.college && <p className="text-sm text-destructive mt-1">{errors.college.message}</p>}
            </div>
        )}


        {!isTargetTeamMemberOnly && (
            <>
                <hr className="my-6" />
                <h4 className="text-md font-semibold mb-3 text-primary">Idea/Startup Details</h4>
                <div>
                  <Label>Applicant Category *</Label>
                  <Controller
                    name="applicantCategory"
                    control={control}
                    render={({ field }: any) => (
                      <RadioGroup onValueChange={field.onChange} value={field.value as ApplicantCategory | undefined} className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                        {applicantCategories.map(({value, label}) => (
                          <Label key={value} htmlFor={`admin-edit-ac-${value}`} className="flex flex-col items-center text-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary cursor-pointer text-xs sm:text-sm">
                            <RadioGroupItem value={value} id={`admin-edit-ac-${value}`} className="sr-only" /> {label}
                          </Label>
                        ))}
                      </RadioGroup>
                    )} />
                  {errors.applicantCategory && <p className="text-sm text-destructive mt-1">{(errors.applicantCategory as any).message}</p>}
                </div>
                <div>
                  <Label htmlFor="startupTitleAdmin">Title of the Startup/Idea *</Label>
                  <Controller name="startupTitle" control={control} render={({ field }: any) => <Input id="startupTitleAdmin" placeholder="Startup/Idea title" {...field} />} />
                  {errors.startupTitle && <p className="text-sm text-destructive mt-1">{(errors.startupTitle as any).message}</p>}
                </div>
                <div>
                  <Label htmlFor="teamMembersAdmin">Team Members (Names, comma-separated, if any)</Label>
                  <Controller name="teamMembers" control={control} render={({ field }: any) => <Input id="teamMembersAdmin" placeholder="e.g., John Doe, Jane Smith" {...field} value={field.value || ''}/>} />
                  {errors.teamMembers && <p className="text-sm text-destructive mt-1">{(errors.teamMembers as any).message}</p>}
                </div>
                <div>
                  <Label htmlFor="problemDefinitionAdmin">Define the Problem *</Label>
                  <Controller name="problemDefinition" control={control} render={({ field }: any) => <Textarea id="problemDefinitionAdmin" placeholder="Problem definition" {...field} rows={3}/>} />
                  {errors.problemDefinition && <p className="text-sm text-destructive mt-1">{(errors.problemDefinition as any).message}</p>}
                  <p className="text-xs text-muted-foreground mt-1">Users can use Markdown for basic formatting.</p>
                </div>
                <div>
                  <Label htmlFor="solutionDescriptionAdmin">Describe the Solution *</Label>
                  <Controller name="solutionDescription" control={control} render={({ field }: any) => <Textarea id="solutionDescriptionAdmin" placeholder="Solution description" {...field} rows={3}/>} />
                  {errors.solutionDescription && <p className="text-sm text-destructive mt-1">{(errors.solutionDescription as any).message}</p>}
                  <p className="text-xs text-muted-foreground mt-1">Users can use Markdown for basic formatting.</p>
                </div>
                <div>
                  <Label htmlFor="uniquenessAdmin">Explain Uniqueness *</Label>
                  <Controller name="uniqueness" control={control} render={({ field }: any) => <Textarea id="uniquenessAdmin" placeholder="Uniqueness/Distinctiveness" {...field} rows={3}/>} />
                  {errors.uniqueness && <p className="text-sm text-destructive mt-1">{(errors.uniqueness as any).message}</p>}
                  <p className="text-xs text-muted-foreground mt-1">Users can use Markdown for basic formatting.</p>
                </div>
                <div>
                  <Label>Current Stage of Idea/Startup *</Label>
                  <Controller
                    name="currentStage"
                    control={control}
                    render={({ field }: any) => (
                      <RadioGroup onValueChange={field.onChange} value={field.value as CurrentStage | undefined} className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                        {currentStages.map(({value, label}) => (
                          <Label key={value} htmlFor={`admin-edit-cs-${value}`} className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary cursor-pointer">
                            <RadioGroupItem value={value} id={`admin-edit-cs-${value}`} className="sr-only" /> {label}
                          </Label>
                        ))}
                      </RadioGroup>
                    )} />
                  {errors.currentStage && <p className="text-sm text-destructive mt-1">{(errors.currentStage as any).message}</p>}
                </div>
            </>
        )}

        <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <LoadingSpinner className="mr-2" /> : null}
                Save Changes
            </Button>
        </div>
    </form>
  );
}
