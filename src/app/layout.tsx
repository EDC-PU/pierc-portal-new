
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext'; // Client Component
import { Toaster } from '@/components/ui/toaster';   // Client Component
import { AuthInitializer } from '@/components/AuthInitializer'; // Client Component
import { AppShell } from '@/components/AppShell'; // New Client Component wrapper

export const metadata: Metadata = {
  title: 'PIERC Portal',
  description: 'Portal for PIERC Incubation and Research',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased flex flex-col min-h-screen bg-background text-foreground">
        <AuthProvider>
          <AuthInitializer>
            {/* AppShell now wraps the main structural elements that need SidebarContext */}
            <AppShell>{children}</AppShell>
            <Toaster />
          </AuthInitializer>
        </AuthProvider>
      </body>
    </html>
  );
}
