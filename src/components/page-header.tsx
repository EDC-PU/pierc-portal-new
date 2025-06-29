import React from 'react';

interface PageHeaderProps {
  title: string;
  description: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header>
      <h1 className="text-3xl font-headline font-bold">{title}</h1>
      <p className="text-muted-foreground mt-1">{description}</p>
    </header>
  );
}
