'use client';

import { useEffect, useState } from 'react';
import type { Announcement } from '@/types';
import { getAnnouncementsStream } from '@/lib/firebase/firestore';
import { AnnouncementCard } from './AnnouncementCard';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

export function AnnouncementsFeed() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = getAnnouncementsStream((fetchedAnnouncements) => {
      setAnnouncements(fetchedAnnouncements);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10">
        <LoadingSpinner size={32} />
        <p className="ml-2 text-muted-foreground">Loading announcements...</p>
      </div>
    );
  }

  if (announcements.length === 0) {
    return <p className="text-center text-muted-foreground py-10">No general announcements at this time.</p>;
  }

  return (
    <ScrollArea className="h-[calc(100vh-20rem)] pr-4"> {/* Adjust height as needed */}
      <div className="space-y-6">
        {announcements.map((announcement, index) => (
          <div key={announcement.id || index}>
            <AnnouncementCard announcement={announcement} />
            {index < announcements.length - 1 && <Separator className="my-6" />}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
