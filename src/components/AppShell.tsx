
'use client';

import { type ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Navbar } from '@/components/common/Navbar';
import { Footer } from '@/components/common/Footer';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    // SidebarProvider needs to be inside AuthProvider, which is now in RootLayout
    // defaultOpen={false} ensures sidebar is collapsed on desktop initially for SidebarProvider
    <SidebarProvider defaultOpen={false}> 
      {/* This div is the main flex container for the AppShell content (Navbar, children, Footer) */}
      <div className="flex flex-col flex-1 min-h-0"> {/* min-h-0 is important for flex children that scroll */}
        <Navbar />
        {/* flex-1 allows this children container to grow and take available space */}
        {/* overflow-auto allows content within children (like DashboardLayout's main area) to scroll if needed */}
        <div className="flex-1 overflow-auto"> 
          {children}
        </div>
        <Footer />
      </div>
    </SidebarProvider>
  );
}
