
import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import { AppShell } from '@/components/AppShell';
import { AuthInitializer } from '@/components/AuthInitializer';
import { ThemeProvider } from '@/components/common/ThemeProvider';

const inter = Inter({ 
  subsets: ['latin'], 
  variable: '--font-inter',
  display: 'swap',
});
const spaceGrotesk = Space_Grotesk({ 
  subsets: ['latin'], 
  variable: '--font-space-grotesk',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PIERC Portal',
  description: 'Parul Innovation & Entrepreneurship Research Centre Portal. Your hub for incubation, research, and innovation.',
  icons: {
    icon: '/favicon.ico', // Assuming you might add a favicon later
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} h-full`} suppressHydrationWarning={true}>
      <body className="font-body bg-background text-foreground flex flex-col h-full" suppressHydrationWarning={true}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <AuthInitializer> {/* Ensures Firebase auth is checked before rendering children */}
              <AppShell> {/* AppShell includes SidebarProvider, Navbar, Footer */}
                {children}
              </AppShell>
              <Toaster />
            </AuthInitializer>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
