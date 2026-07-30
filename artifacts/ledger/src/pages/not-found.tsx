import { Link } from "wouter";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex h-[400px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card text-center shadow-xs">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="mb-1 text-lg font-semibold tracking-tight text-foreground">Page Not Found</h3>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link href="/">
        <Button variant="outline">Return to Dashboard</Button>
      </Link>
    </div>
  );
}
