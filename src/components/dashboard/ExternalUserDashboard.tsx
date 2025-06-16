'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, LinkIcon, MessageSquare } from 'lucide-react';

export default function ExternalUserDashboard() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">External Collaborator Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Welcome! Access shared projects and communication channels.</p>
        </CardContent>
      </Card>

       <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shared Projects</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1 Active</div>
            <p className="text-xs text-muted-foreground">
              Project Phoenix
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resources</CardTitle>
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5 Documents</div>
            <p className="text-xs text-muted-foreground">
              Guidelines & MOUs
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2 Unread</div>
            <p className="text-xs text-muted-foreground">
              From PIERC Admin
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder for more external user-specific content */}
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-xl">Collaboration Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>Project Portals</li>
            <li>Shared Calendar</li>
            <li>Contact PIERC Staff</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
