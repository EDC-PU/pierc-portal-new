
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LogIn, LogOut, User as UserIcon, LayoutDashboard, Settings, Megaphone, Menu } from 'lucide-react'; // Added Menu for SidebarTrigger
import { useRouter } from 'next/navigation';
import { Skeleton } from '../ui/skeleton';
import { useSidebar } from '@/hooks/use-sidebar'; 
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';

export function Navbar() {
  const { user, userProfile, signOut, loading, initialLoadComplete } = useAuth();
  const router = useRouter();
  const { toggleSidebar, isMobile } = useSidebar(); 

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <nav className="bg-card text-card-foreground shadow-md sticky top-0 z-50 h-16 flex items-center"> {/* Navbar height changed to h-16 (4rem) */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-full">
          <div className="flex items-center space-x-4">
            {isMobile && ( 
              <Button variant="ghost" size="icon" onClick={toggleSidebar} className="mr-2 md:hidden">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle Sidebar</span>
              </Button>
            )}
            <Link href="/" className="flex items-center space-x-2 text-primary hover:opacity-80 transition-opacity">
               <Image
                src="https://www.pierc.org/_next/static/media/PIERC.959ad75d.svg"
                alt="PIERC Portal Logo"
                width={110}
                height={45}
                className="h-11 w-auto dark:hidden"
                priority
              />
              <Image
                src="https://www.pierc.org/_next/static/media/PIERC%20WHITE.a9ef7cc8.svg"
                alt="PIERC Portal Logo"
                width={110}
                height={45}
                className="h-11 w-auto hidden dark:block"
                priority
              />
            </Link>
          </div>
          
          <div className="flex items-center space-x-2">
            <ThemeToggle />
            {loading && !initialLoadComplete ? (
                <Skeleton className="h-10 w-24 rounded-md" />
            ) : user && userProfile ? (
              <>
                <NotificationBell />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={userProfile?.photoURL || user.photoURL || undefined} alt={userProfile?.displayName || user.displayName || 'User'} />
                        <AvatarFallback>{getInitials(userProfile?.displayName || user.displayName)}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{userProfile?.displayName || user.displayName}</p>
                        <p className="text-xs leading-none text-muted-foreground">{userProfile?.email || user.email}</p>
                        {userProfile?.role && <p className="text-xs leading-none text-muted-foreground capitalize">{userProfile.role.replace('_', ' ').toLowerCase()}{userProfile.isSuperAdmin ? ' (Super Admin)' : ''}</p>}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push('/dashboard')}>
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/profile-setup')}>
                      <UserIcon className="mr-2 h-4 w-4" />
                      Profile
                    </DropdownMenuItem>
                    {userProfile?.role === 'ADMIN_FACULTY' && (
                      <>
                        <DropdownMenuItem onClick={() => router.push('/dashboard/admin/manage-announcements')}>
                            <Megaphone className="mr-2 h-4 w-4" /> Manage Announcements
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push('/dashboard/admin/system-settings')}>
                            <Settings className="mr-2 h-4 w-4" /> System Settings
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={signOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button onClick={() => router.push('/login')} variant="default">
                <LogIn className="mr-2 h-4 w-4" /> Login
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
