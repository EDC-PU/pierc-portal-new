
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
import type { UserProfile } from '@/types';
// import { updateSystemSettings, getSystemSettings } from '@/lib/firebase/firestore'; // To be implemented

// Define a schema for system settings
const systemSettingsSchema = z.object({
  portalName: z.string().min(3, 'Portal name must be at least 3 characters').max(50),
  maintenanceMode: z.boolean().default(false),
  defaultCohortSize: z.number().min(1).max(100).optional(),
  // Add more settings as needed
});

export type SystemSettingsFormData = z.infer<typeof systemSettingsSchema>;

interface SystemSettingsFormProps {
  currentUserProfile: UserProfile;
}

// Placeholder for actual settings fetching and updating
const getSystemSettings = async (): Promise<SystemSettingsFormData | null> => {
  console.log("Fetching system settings...");
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));
  // Return dummy data or null if not found
  return {
    portalName: "PIERC Portal Default",
    maintenanceMode: false,
    defaultCohortSize: 20,
  };
};

const updateSystemSettings = async (data: SystemSettingsFormData): Promise<void> => {
  console.log("Updating system settings with:", data);
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000));
};


export function SystemSettingsForm({ currentUserProfile }: SystemSettingsFormProps) {
  const { toast } = useToast();
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SystemSettingsFormData>({
    resolver: zodResolver(systemSettingsSchema),
    defaultValues: {
      portalName: '',
      maintenanceMode: false,
    }
  });

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoadingSettings(true);
      try {
        const settings = await getSystemSettings(); // Replace with actual Firestore call
        if (settings) {
          reset(settings);
        } else {
          // Initialize with defaults if no settings found
          reset({
            portalName: 'PIERC Portal',
            maintenanceMode: false,
            defaultCohortSize: 15,
          });
        }
      } catch (error) {
        toast({ title: "Error", description: "Could not load system settings.", variant: "destructive" });
      } finally {
        setIsLoadingSettings(false);
      }
    };
    loadSettings();
  }, [reset, toast]);

  const onSubmit = async (data: SystemSettingsFormData) => {
    try {
      await updateSystemSettings(data); // Replace with actual Firestore call
      toast({ title: "Settings Saved", description: "System settings have been updated successfully." });
    } catch (error) {
      toast({ title: "Save Error", description: "Could not save system settings.", variant: "destructive" });
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
        {/* Column 1: Portal Configuration */}
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
                  />
                )}
              />
            </div>
             {errors.maintenanceMode && <p className="text-sm text-destructive mt-1">{errors.maintenanceMode.message}</p>}
            
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
                    onChange={e => field.onChange(parseInt(e.target.value,10) || 0)}
                    value={field.value || ''}
                  />
                )} 
              />
              {errors.defaultCohortSize && <p className="text-sm text-destructive mt-1">{errors.defaultCohortSize.message}</p>}
            </div>

            {/* Add more configuration settings here */}
          </CardContent>
        </Card>

        {/* Column 2: Access Control & Save Button */}
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
                <Button type="submit" className="w-full" disabled={isSubmitting}>
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
