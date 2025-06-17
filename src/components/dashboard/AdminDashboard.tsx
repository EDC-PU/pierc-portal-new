
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Users, Settings, BarChart3, Megaphone, UserCog } from 'lucide-react'; // Added UserCog for Manage Users
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

export default function AdminDashboard() {
  const router = useRouter();
  const { userProfile } = useAuth(); // Get userProfile for super admin check

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Administrator & Faculty Dashboard</CardTitle>
          <CardDescription>Manage portal content, users, and view analytics.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Overview of portal activities and management tools.</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">150</div> {/* Placeholder */}
            <p className="text-xs text-muted-foreground">
              +10 this week
            </p>
          </CardContent>
        </Card>
         <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">25</div> {/* Placeholder */}
            <p className="text-xs text-muted-foreground">
              5 pending approval
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Announcements</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5 Active</div> {/* Placeholder */}
             <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => router.push('/dashboard/admin/manage-announcements')}>Manage</Button>
          </CardContent>
        </Card>
         <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Settings</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             <div className="text-2xl font-bold">Configuration</div>
            <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => router.push('/dashboard/admin/system-settings')}>Access Settings</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-xl">Management Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button variant="outline" onClick={() => router.push('/dashboard/admin/manage-announcements')}>
            <Megaphone className="mr-2 h-4 w-4" /> Manage Announcements
          </Button>
           <Button variant="outline" onClick={() => router.push('/dashboard/admin/system-settings')}>
            <Settings className="mr-2 h-4 w-4" /> System Settings
          </Button>
           {userProfile?.isSuperAdmin && (
            <Button variant="outline" onClick={() => router.push('/dashboard/admin/manage-users')}>
              <UserCog className="mr-2 h-4 w-4" /> Manage Users & Permissions
            </Button>
          )}
          <Button variant="outline" disabled>View Incubation Applications (Coming Soon)</Button>
          <Button variant="outline" disabled>Platform Analytics (Coming Soon)</Button>
        </CardContent>
      </Card>
    </div>
  );
}
