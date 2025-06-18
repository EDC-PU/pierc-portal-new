
'use client';

import { type ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Navbar } from '@/components/common/Navbar';
import { Footer } from '@/components/common/Footer';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false}> {/* Changed defaultOpen to false */}
      <div className="flex flex-col min-h-screen"> {/* Ensure full height for flex */}
        <Navbar />
        {/* The main content area now directly takes children. Height management needs to be correct. */}
        {/* The 'flex-grow container...' was previously in RootLayout's main, now part of the page itself or dashboard layout */}
        <div className="flex-grow"> 
          {children}
        </div>
        <Footer />
      </div>
    </SidebarProvider>
  );
}
