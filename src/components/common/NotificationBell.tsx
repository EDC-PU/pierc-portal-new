
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getNotificationsStreamForUser, markNotificationsAsRead } from '@/lib/firebase/firestore';
import type { AppNotification } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, ArrowRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

export function NotificationBell() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = getNotificationsStreamForUser(user.uid, (fetchedNotifications) => {
      setNotifications(fetchedNotifications);
      const newUnreadCount = fetchedNotifications.filter(n => !n.isRead).length;
      setUnreadCount(newUnreadCount);
    }, 15); // Fetch up to 15 recent notifications for the popover

    return () => unsubscribe();
  }, [user?.uid]);

  const handlePopoverOpenChange = async (open: boolean) => {
    setIsPopoverOpen(open);
    if (open && user && userProfile && unreadCount > 0) {
      // Mark visible unread notifications as read
      const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id!);
      if (unreadIds.length > 0) {
        try {
          await markNotificationsAsRead(user.uid, unreadIds, userProfile);
          // The stream will update the state, so no need to manually set unreadCount to 0
        } catch (error) {
          console.error("Failed to mark notifications as read:", error);
        }
      }
    }
  };

  const handleNotificationClick = (notification: AppNotification) => {
    if (notification.link) {
      router.push(notification.link);
    }
    setIsPopoverOpen(false);
  };

  return (
    <Popover open={isPopoverOpen} onOpenChange={handlePopoverOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0.5 text-xs"
            >
              {unreadCount}
            </Badge>
          )}
          <span className="sr-only">Toggle notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4">
          <h4 className="font-medium text-sm">Notifications</h4>
        </div>
        <ScrollArea className="h-auto max-h-80">
          <div className="p-2">
            {notifications.length > 0 ? (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className="mb-1 w-full rounded-lg p-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
                >
                  <p className={`font-semibold ${!notif.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>{notif.title}</p>
                  <p className={`text-xs ${!notif.isRead ? 'text-foreground/80' : 'text-muted-foreground/80'}`}>{notif.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true })}
                  </p>
                </div>
              ))
            ) : (
              <p className="p-4 text-center text-sm text-muted-foreground">No new notifications.</p>
            )}
          </div>
        </ScrollArea>
        <div className="p-2 border-t border-border">
            <Button variant="link" size="sm" className="w-full" onClick={() => { setIsPopoverOpen(false); router.push('/dashboard/notifications'); }}>
                View All Notifications <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
