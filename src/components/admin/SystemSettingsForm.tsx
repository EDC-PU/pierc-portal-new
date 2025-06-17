
'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile, SystemSettings } from '@/types';
import { updateSystemSettings as updateSettingsFS, getSystemSettings as getSettingsFS } from '@/lib/firebase/firestore';

const systemSettingsSchema = z.object({
  portalName: z.string().min(3, 'Portal name must be at least 3 characters').max(50),
  maintenanceMode: z.boolean().default(false),
  allowNewRegistrations: z.boolean().default(true),
  defaultCohortSize: z.coerce.number().min(1, 'Cohort size must be at least 1').max(100, 'Cohort size cannot exceed 100'),
});

export type SystemSettingsFormData = z.infer<typeof systemSettingsSchema>;

interface SystemSettingsFormProps {
  currentUserProfile: UserProfile; // Assuming this is passed and verified to be an admin
}

export function SystemSettingsForm({ currentUserProfile }: SystemSettingsFormProps) {
  const { toast } = useToast();
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSubmitting, setIsSubmittingState] = useState(false); // Local submitting state

  const { control, handleSubmit, reset, formState: { errors } } = useForm<SystemSettingsFormData>({
    resolver: zodResolver(systemSettingsSchema),
    defaultValues: {
      portalName: 'PIERC Portal', // Default initial value
      maintenanceMode: false,
      allowNewRegistrations: true,
      defaultCohortSize: 15,
    }
  });

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoadingSettings(true);
      try {
        const settings = await getSettingsFS();
        if (settings) {
          reset(settings); // Populate form with fetched settings
        } else {
          // If no settings document exists, the form will keep its defaultValues.
          // Optionally, create a default settings document here if desired.
          // For now, we'll assume defaults are fine if nothing is in Firestore.
          toast({ title: "Default Settings Loaded", description: "No existing settings found, using defaults. Save to create.", variant: "default"});
        }
      } catch (error) {
        console.error("Error loading system settings:", error);
        toast({ title: "Load Error", description: "Could not load system settings.", variant: "destructive" });
      } finally {
        setIsLoadingSettings(false);
      }
    };
    loadSettings();
  }, [reset, toast]);

  const onSubmit = async (data: SystemSettingsFormData) => {
    setIsSubmittingState(true);
    try {
      if (!currentUserProfile.uid) {
        throw new Error("Admin user ID not found.");
      }
      await updateSettingsFS(data, currentUserProfile.uid);
      toast({ title: "Settings Saved", description: "System settings have been updated successfully." });
    } catch (error) {
      console.error("Error saving system settings:", error);
      toast({ title: "Save Error", description: (error as Error).message || "Could not save system settings.", variant: "destructive" });
    } finally {
      setIsSubmittingState(false);
    }
  };

  if (isLoadingSettings) {
    return (
      <div className="flex justify-center items-center py-10">
        <LoadingSpinner size={32} />
        <p className="ml-2 text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="md:col-span-2 shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl">Portal Configuration</CardTitle>
            <CardDescription>General settings for the PIERC portal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="portalName">Portal Name</Label>
              <Controller name="portalName" control={control} render={({ field }) => <Input id="portalName" {...field} />} />
              {errors.portalName && <p className="text-sm text-destructive mt-1">{errors.portalName.message}</p>}
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <Label htmlFor="maintenanceMode" className="text-base">Maintenance Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Temporarily disable access to the portal for non-admins.
                </p>
              </div>
              <Controller
                name="maintenanceMode"
                control={control}
                render={({ field }) => (
                  <Switch
                    id="maintenanceMode"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSubmitting}
                  />
                )}
              />
            </div>
             {errors.maintenanceMode && <p className="text-sm text-destructive mt-1">{errors.maintenanceMode.message}</p>}

            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <Label htmlFor="allowNewRegistrations" className="text-base">Allow New Registrations</Label>
                <p className="text-sm text-muted-foreground">
                  Control whether new users can sign up for the portal.
                </p>
              </div>
              <Controller
                name="allowNewRegistrations"
                control={control}
                render={({ field }) => (
                  <Switch
                    id="allowNewRegistrations"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSubmitting}
                  />
                )}
              />
            </div>
            {errors.allowNewRegistrations && <p className="text-sm text-destructive mt-1">{errors.allowNewRegistrations.message}</p>}
            
            <div>
              <Label htmlFor="defaultCohortSize">Default Cohort Size</Label>
              <Controller 
                name="defaultCohortSize" 
                control={control} 
                render={({ field }) => (
                  <Input 
                    id="defaultCohortSize" 
                    type="number" 
                    {...field} 
                    onChange={e => field.onChange(parseInt(e.target.value,10) || 0)} // Ensure number
                    value={field.value || ''}
                    disabled={isSubmitting}
                  />
                )} 
              />
              {errors.defaultCohortSize && <p className="text-sm text-destructive mt-1">{errors.defaultCohortSize.message}</p>}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-8">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-xl">Access Control</CardTitle>
              <CardDescription>Manage administrator access.</CardDescription>
            </CardHeader>
            <CardContent>
              {currentUserProfile.isSuperAdmin ? (
                <Button type="button" variant="outline" className="w-full" disabled>
                  Manage Admins (Coming Soon)
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">Only Super Admins can manage other administrators.</p>
              )}
            </CardContent>
          </Card>
          
          <Card className="shadow-lg">
             <CardHeader>
                <CardTitle className="font-headline text-xl">Save Changes</CardTitle>
             </CardHeader>
            <CardContent>
                <Button type="submit" className="w-full" disabled={isSubmitting || isLoadingSettings}>
                {isSubmitting ? <LoadingSpinner className="mr-2" /> : null}
                Save System Settings
                </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
