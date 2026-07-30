import { useListBackups, useCreateBackup, getListBackupsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Database, Plus, RefreshCw, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";

export function Backup() {
  const { data: backups, isLoading, isError } = useListBackups();
  const createBackup = useCreateBackup();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCreateBackup = () => {
    createBackup.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: "Backup Created",
          description: "Database backup was successfully generated.",
        });
        queryClient.invalidateQueries({ queryKey: getListBackupsQueryKey() });
      },
      onError: () => {
        toast({
          title: "Backup Failed",
          description: "Failed to generate database backup. Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  const formatSize = (bytes: number) => {
    return `${(bytes / 1024).toFixed(2)} KB`;
  };

  return (
    <div className="space-y-8 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Backup & Restore</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your database backups. Regular backups ensure your financial data is secure.
          </p>
        </div>
        <Button 
          onClick={handleCreateBackup} 
          disabled={createBackup.isPending}
          data-testid="button-create-backup"
        >
          {createBackup.isPending ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Create Backup
        </Button>
      </div>

      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        Backups stored in: <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">data/backups/</code>
      </div>

      <div className="flex-1">
        {isError ? (
          <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">
            Failed to load backups. Please try again later.
          </div>
        ) : isLoading ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filename</TableHead>
                    <TableHead>Date Created</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-[250px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-[80px] ml-auto" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : !backups?.length ? (
          <EmptyState 
            icon={Database} 
            title="No Backups" 
            description="No database backups have been created yet. Click 'Create Backup' to generate your first one." 
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filename</TableHead>
                    <TableHead>Date Created</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((backup) => (
                    <TableRow key={backup.filename} data-testid={`row-backup-${backup.filename}`}>
                      <TableCell className="font-mono text-sm">{backup.filename}</TableCell>
                      <TableCell>
                        {format(new Date(backup.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatSize(backup.sizeBytes)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
