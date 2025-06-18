'use client';

export function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="bg-card text-card-foreground py-6 mt-auto border-t border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-sm text-muted-foreground">
          &copy; {currentYear} Parul Innovation & Entrepreneurship Research Centre. All rights reserved.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Innovation and Entrepreneurship at its best.
        </p>
      </div>
    </footer>
  );
}
