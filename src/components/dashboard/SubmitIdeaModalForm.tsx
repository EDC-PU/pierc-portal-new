
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import type { UserProfile } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

const ideaDetailsSchema = z.object({
  startupTitle: z.string().min(3, 'Idea title must be at least 3 characters').max(200),
  problemDefinition: z.string().min(10, 'Problem definition is required (min 10 chars)').max(2000),
  solutionDescription: z.string().min(10, 'Solution description is required (min 10 chars)').max(2000),
  uniqueness: z.string().min(10, 'Uniqueness description is required (min 10 chars)').max(2000),
});

type IdeaDetailsFormData = z.infer<typeof ideaDetailsSchema>;

interface SubmitIdeaModalFormProps {
  currentUserProfile: UserProfile;
  onSuccess: () => void;
}

export function SubmitIdeaModalForm({ currentUserProfile, onSuccess }: SubmitIdeaModalFormProps) {
  const { setRoleAndCompleteProfile, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<IdeaDetailsFormData>({
    resolver: zodResolver(ideaDetailsSchema),
    defaultValues: {
      startupTitle: currentUserProfile.startupTitle || '',
      problemDefinition: currentUserProfile.problemDefinition || '',
      solutionDescription: currentUserProfile.solutionDescription || '',
      uniqueness: currentUserProfile.uniqueness || '',
    },
  });

  const processSubmit = async (data: IdeaDetailsFormData) => {
    if (!currentUserProfile.role) {
      toast({ title: "Error", description: "User role not found. Please complete full profile setup first.", variant: "destructive" });
      return;
    }

    const profileUpdateData = {
      ...currentUserProfile, // Spread existing profile to preserve other fields
      startupTitle: data.startupTitle,
      problemDefinition: data.problemDefinition,
      solutionDescription: data.solutionDescription,
      uniqueness: data.uniqueness,
    };
    
    // Remove fields that are not part of the Omit type for setRoleAndCompleteProfile's additionalData
    const { uid, email, displayName, photoURL, role, isSuperAdmin, createdAt, updatedAt, isTeamMemberOnly, associatedIdeaId, associatedTeamLeaderUid, ...additionalDataForContext } = profileUpdateData;


    try {
      await setRoleAndCompleteProfile(currentUserProfile.role, additionalDataForContext);
      toast({ title: "Idea Details Saved", description: "Your idea information has been updated in your profile." });
      onSuccess(); // Close modal
    } catch (error) {
      // Error is already toasted by AuthContext
      console.error("Error submitting idea details via modal:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit(processSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
      <div>
        <Label htmlFor="startupTitle">Idea / Startup Title*</Label>
        <Controller name="startupTitle" control={control} render={({ field }) => <Input id="startupTitle" placeholder="Your brilliant idea name" {...field} />} />
        {errors.startupTitle && <p className="text-sm text-destructive mt-1">{errors.startupTitle.message}</p>}
      </div>
      <div>
        <Label htmlFor="problemDefinition">Define the Problem you are solving*</Label>
        <Controller name="problemDefinition" control={control} render={({ field }) => <Textarea id="problemDefinition" placeholder="Clearly describe the problem statement" {...field} rows={4} />} />
        {errors.problemDefinition && <p className="text-sm text-destructive mt-1">{errors.problemDefinition.message}</p>}
        <p className="text-xs text-muted-foreground mt-1">You can use Markdown for basic formatting (e.g., **bold**, *italic*, lists).</p>
      </div>
      <div>
        <Label htmlFor="solutionDescription">Describe your Solution*</Label>
        <Controller name="solutionDescription" control={control} render={({ field }) => <Textarea id="solutionDescription" placeholder="Explain your proposed solution in detail" {...field} rows={4} />} />
        {errors.solutionDescription && <p className="text-sm text-destructive mt-1">{errors.solutionDescription.message}</p>}
        <p className="text-xs text-muted-foreground mt-1">You can use Markdown for basic formatting.</p>
      </div>
      <div>
        <Label htmlFor="uniqueness">What is Unique/Distinctive about your idea?*</Label>
        <Controller name="uniqueness" control={control} render={({ field }) => <Textarea id="uniqueness" placeholder="Highlight the novelty and competitive advantage" {...field} rows={4} />} />
        {errors.uniqueness && <p className="text-sm text-destructive mt-1">{errors.uniqueness.message}</p>}
        <p className="text-xs text-muted-foreground mt-1">You can use Markdown for basic formatting.</p>
      </div>
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSubmitting || authLoading}>
          {(isSubmitting || authLoading) && <LoadingSpinner className="mr-2" />}
          Save Idea Details
        </Button>
      </div>
    </form>
  );
}
