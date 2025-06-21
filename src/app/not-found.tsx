
'use client';

import { Button } from '@/components/ui/button';
import { Mail, Home, Frown } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  // Using a calculation similar to login page for vertical centering between header and footer
  // Navbar (h-16 = 4rem) + Footer (py-6 = 3rem)
  const mainContentMinHeight = "min-h-[calc(100vh_-_theme(spacing.16)_-_theme(spacing.12))]";

  return (
    <div className={`flex flex-col items-center justify-center text-center p-4 animate-fade-in ${mainContentMinHeight}`}>
      <Frown className="h-24 w-24 text-primary/50 mb-4" aria-hidden="true" />
      <h1 className="text-6xl font-bold text-primary font-headline">404</h1>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight">Page Not Found</h2>
      <p className="mt-2 max-w-md text-lg text-muted-foreground">
        Oops! The page you are looking for does not exist. It might have been moved or deleted.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row gap-4">
        <Button asChild size="lg">
          <Link href="/">
            <Home className="mr-2 h-5 w-5" />
            Go to Homepage
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <a href="mailto:portal.pierc@paruluniversity.ac.in">
            <Mail className="mr-2 h-5 w-5" />
            Contact Support
          </a>
        </Button>
      </div>
    </div>
  );
}
