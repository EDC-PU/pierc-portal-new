'use client';

import { useEffect, useState } from 'react';
import type { Announcement } from '@/types';
import { getUrgentAnnouncementsStream } from '@/lib/firebase/firestore';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

const URGENT_ANNOUNCEMENT_DISMISS_KEY_PREFIX = 'dismissedUrgentAnnouncement_';

export default function UrgentAnnouncementModal() {
  const [urgentAnnouncements, setUrgentAnnouncements] = useState<Announcement[]>([]);
  const [currentAnnouncement, setCurrentAnnouncement] = useState<Announcement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth(); // Use user to personalize dismissal if needed
  const [timeAgo, setTimeAgo] = useState<string>('');

  useEffect(() => {
    // Only subscribe if user is logged in to avoid unnecessary reads
    if (!user) return; 

    const unsubscribe = getUrgentAnnouncementsStream((fetchedAnnouncements) => {
      setUrgentAnnouncements(fetchedAnnouncements);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (urgentAnnouncements.length > 0) {
      const latestUrgent = urgentAnnouncements[0]; // Assuming they are sorted by date desc
      const dismissKey = `${URGENT_ANNOUNCEMENT_DISMISS_KEY_PREFIX}${latestUrgent.id}`;
      
      let dismissedTimestamp = null;
      if (typeof window !== 'undefined') {
        dismissedTimestamp = localStorage.getItem(dismissKey);
      }

      // Show if not dismissed, or dismissed but the announcement is newer than dismissal
      // For simplicity, we'll just check if it's been dismissed at all.
      // A more robust solution would involve storing dismissal timestamps.
      if (!dismissedTimestamp) {
        setCurrentAnnouncement(latestUrgent);
        setIsOpen(true);
      } else {
        // If you want to re-show if it's updated:
        // if (latestUrgent.updatedAt.toMillis() > parseInt(dismissedTimestamp)) {
        //   setCurrentAnnouncement(latestUrgent);
        //   setIsOpen(true);
        // }
      }
    }
  }, [urgentAnnouncements]);
  
  // This useEffect will run on the client after hydration to set the relative time.
  useEffect(() => {
    if (isOpen && currentAnnouncement?.createdAt) {
      setTimeAgo(formatDistanceToNow(currentAnnouncement.createdAt.toDate(), { addSuffix: true }));
    }
  }, [isOpen, currentAnnouncement]);


  const handleDismiss = () => {
    if (currentAnnouncement?.id && typeof window !== 'undefined') {
      localStorage.setItem(`${URGENT_ANNOUNCEMENT_DISMISS_KEY_PREFIX}${currentAnnouncement.id}`, Date.now().toString());
    }
    setIsOpen(false);
    setCurrentAnnouncement(null);
    // Potentially check for the next unread urgent announcement if multiple exist
  };

  if (!isOpen || !currentAnnouncement) {
    return null;
  }
  
  // Fallback/Server-side rendering format
  const absoluteDate = currentAnnouncement.createdAt
    ? format(currentAnnouncement.createdAt.toDate(), 'MMM d, yyyy')
    : 'Date not available';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if(!open) handleDismiss(); }}>
      <DialogContent className="sm:max-w-lg border-accent ring-2 ring-accent/80 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl font-headline text-destructive">
            <AlertTriangle className="h-7 w-7 mr-3" />
            Urgent Announcement!
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-1">
            Posted by {currentAnnouncement.creatorDisplayName || 'Admin'} - {timeAgo || absoluteDate}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2">
            <h3 className="text-xl font-semibold text-foreground">{currentAnnouncement.title}</h3>
            <p className="text-foreground whitespace-pre-wrap">{currentAnnouncement.content}</p>
        </div>
        <DialogFooter>
          <Button onClick={handleDismiss} className="bg-accent hover:bg-accent/90">
            <X className="mr-2 h-4 w-4" /> Got it, Dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
