import React from 'react';
import { Button } from './button';

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  buttonText?: string;
}

export function EmptyState({ icon: Icon, title, description, buttonText = "Add Entry" }: EmptyStateProps) {
  return (
    <div className="flex h-[400px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card text-center shadow-xs">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mb-1 text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      <Button variant="outline">{buttonText}</Button>
    </div>
  );
}
