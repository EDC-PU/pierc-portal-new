
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Briefcase, LinkIcon, MessageSquare, Handshake, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ExternalUserDashboard() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">External Collaborator Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Welcome! Access relevant PIERC information and resources.</p>
        </CardContent>
      </Card>

       <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partnership Info</CardTitle>
            <Handshake className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Details</div>
            <p className="text-xs text-muted-foreground">
              View your collaboration status (Coming Soon).
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shared Resources</CardTitle>
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Access</div>
            <p className="text-xs text-muted-foreground">
              Key documents and guidelines (Coming Soon).
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Communication</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Contact</div>
            <p className="text-xs text-muted-foreground">
              Reach out to PIERC admin (Coming Soon).
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-xl">Key Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button variant="outline" onClick={() => router.push('/dashboard/incubation-phases')}>
            Incubation Program Overview <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => router.push('/dashboard/announcements')}>
            Upcoming PIERC Events <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
           <Button variant="outline" disabled>
             Contact PIERC Staff (Coming Soon)
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
