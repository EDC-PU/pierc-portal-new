'use client';

import { useState, useEffect } from 'react';
import type { Announcement } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow } from 'date-fns';
import { UserCircle, CalendarDays, AlertTriangle } from 'lucide-react';

interface AnnouncementCardProps {
  announcement: Announcement;
  isAdmin?: boolean;
  onEdit?: (announcement: Announcement) => void;
  onDelete?: (announcementId: string) => void;
}

export function AnnouncementCard({ announcement, isAdmin = false, onEdit, onDelete }: AnnouncementCardProps) {
  const [timeAgo, setTimeAgo] = useState<string>('');

  const absoluteDate = announcement.createdAt
    ? format(announcement.createdAt.toDate(), 'MMM d, yyyy')
    : 'Date not available';

  useEffect(() => {
    if (announcement.createdAt) {
      setTimeAgo(formatDistanceToNow(announcement.createdAt.toDate(), { addSuffix: true }));
    }
  }, [announcement.createdAt]);

  return (
    <Card className={`transition-all duration-300 hover:shadow-lg ${announcement.isUrgent ? 'border-accent ring-2 ring-accent/50' : 'border-border'}`}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="font-headline text-xl mb-1">{announcement.title}</CardTitle>
          {announcement.isUrgent && (
            <Badge variant="destructive" className="ml-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> URGENT
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
          <span className="flex items-center">
            <UserCircle className="h-4 w-4 mr-1" /> {announcement.creatorDisplayName || 'Admin'}
          </span>
          <span className="flex items-center">
            <CalendarDays className="h-4 w-4 mr-1" /> {timeAgo || absoluteDate}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-foreground whitespace-pre-wrap">{announcement.content}</p>
      </CardContent>
      {isAdmin && onEdit && onDelete && announcement.id && (
        <CardFooter className="flex justify-end gap-2">
          {/* Admin actions can be added here if needed on this card directly */}
          {/* e.g.
          <Button variant="outline" size="sm" onClick={() => onEdit(announcement)}>Edit</Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(announcement.id!)}>Delete</Button> 
          */}
        </CardFooter>
      )}
    </Card>
  );
}
