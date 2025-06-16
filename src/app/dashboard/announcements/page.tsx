'use client';

import { AnnouncementsFeed } from '@/components/announcements/AnnouncementsFeed';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Rss } from 'lucide-react';

// Note: UrgentAnnouncementModal is already in dashboard/page.tsx, so it covers this page too.
// If it should only be on specific pages, its placement would need to be adjusted.

export default function AnnouncementsPage() {
  return (
    <div className="space-y-8 animate-slide-in-up">
      <header className="text-center md:text-left">
         <div className="flex items-center justify-center md:justify-start mb-4">
            <Rss className="h-12 w-12 text-primary" />
            <h1 className="text-4xl font-headline font-bold ml-3">Announcements</h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto md:mx-0">
          Stay updated with the latest news, events, and important information from PIERC.
        </p>
      </header>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">General Announcements</CardTitle>
          <CardDescription>Recent updates and communications.</CardDescription>
        </CardHeader>
        <CardContent>
          <AnnouncementsFeed />
        </CardContent>
      </Card>
    </div>
  );
}
