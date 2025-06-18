
'use client';

import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Home, LayoutDashboard, User, FileText, Rss, Settings, Megaphone, Users as UsersIcon, BarChartBig, BarChart3, LogOut, ShieldCheck, UserCog, Menu as MenuIcon } from 'lucide-react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, userProfile, loading, initialLoadComplete, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (initialLoadComplete) {
      if (!user) {
        router.replace('/login');
      } else if (!userProfile) {
        router.replace('/profile-setup');
      }
    }
  }, [user, userProfile, initialLoadComplete, router]);

  if (loading || !initialLoadComplete) {
    return (
      // Adjusted for new navbar height (h-16 = 4rem)
      <div className="flex items-center justify-center h-full"> 
        <LoadingSpinner size={48} />
      </div>
    );
  }

  if (!user || !userProfile) {
     return (
      <div className="flex items-center justify-center h-full">
        <p>Authenticating...</p>
        <LoadingSpinner size={32} />
      </div>
    );
  }

  const menuItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['STUDENT', 'EXTERNAL_USER', 'ADMIN_FACULTY'] },
    { label: 'My Profile', href: '/profile-setup', icon: User, roles: ['STUDENT', 'EXTERNAL_USER', 'ADMIN_FACULTY'] },
    { label: 'Announcements', href: '/dashboard/announcements', icon: Rss, roles: ['STUDENT', 'EXTERNAL_USER', 'ADMIN_FACULTY'] },
    { label: 'Incubation Phases', href: '/dashboard/incubation-phases', icon: FileText, roles: ['STUDENT', 'EXTERNAL_USER', 'ADMIN_FACULTY'] },
  ];

  const adminMenuItems = [
    { label: 'Manage Announcements', href: '/dashboard/admin/manage-announcements', icon: Megaphone, roles: ['ADMIN_FACULTY'] },
    { label: 'View Applications', href: '/dashboard/admin/view-applications', icon: BarChart3, roles: ['ADMIN_FACULTY'] },
    { label: 'System Settings', href: '/dashboard/admin/system-settings', icon: Settings, roles: ['ADMIN_FACULTY'] },
    { label: 'Platform Analytics', href: '/dashboard/admin/platform-analytics', icon: BarChartBig, roles: ['ADMIN_FACULTY'] },
    { label: 'Manage Users', href: '/dashboard/admin/manage-users', icon: UserCog, roles: ['ADMIN_FACULTY'], superAdminOnly: true },
  ];

  return (
    <div className="flex flex-1">
      <Sidebar side="left" variant="sidebar" collapsible="icon" className="h-full">
        <SidebarHeader className="flex items-center justify-between p-2 md:justify-center">
           <SidebarTrigger className="hidden md:flex" />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {menuItems.filter(item => item.roles.includes(userProfile.role || '')).map((item) => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  onClick={() => router.push(item.href)}
                  isActive={pathname === item.href || (item.href === '/dashboard' && pathname.startsWith('/dashboard/(main)'))}
                  tooltip={item.label}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}

            {userProfile.role === 'ADMIN_FACULTY' && (
              <>
                <SidebarSeparator />
                <SidebarGroup>
                  <SidebarGroupLabel className="flex items-center"><ShieldCheck className="mr-2" />Admin Tools</SidebarGroupLabel>
                  <SidebarMenu>
                    {adminMenuItems.filter(item => !item.superAdminOnly || userProfile.isSuperAdmin).map((item) => (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          onClick={() => router.push(item.href)}
                          isActive={pathname === item.href}
                          tooltip={item.label}
                        >
                          <item.icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroup>
              </>
            )}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={signOut} tooltip="Logout">
                <LogOut />
                <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      
      {/* Main content area for the dashboard pages */}
      <div className="flex-1 w-0 transition-all duration-200 ease-linear md:ml-[var(--sidebar-width-icon)] peer-data-[state=expanded]:md:ml-[var(--sidebar-width)]">
         {/* Removed 'container' and 'mx-auto' to allow full width utilization */}
        <div className="px-4 sm:px-6 lg:px-8 py-8 h-full">
           {children}
        </div>
      </div>
    </div>
  );
}
