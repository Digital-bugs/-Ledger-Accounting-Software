import { useState, useEffect } from "react";
import {
  useListBackups,
  useCreateBackup,
  useDeleteBackup,
  useRestoreBackup,
  useGetBackupHealth,
  useGetBackupSettings,
  useUpdateBackupSettings,
  getListBackupsQueryKey,
  getGetBackupSettingsQueryKey,
  getGetBackupHealthQueryKey,
} from "@workspace/api-client-react";
import type { BackupHealth, BackupSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Database,
  Plus,
  RefreshCw,
  Trash2,
  RotateCcw,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldCheck,
  Clock,
  HardDrive,
  Settings2,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  try {
    return format(new Date(iso), "MMM d, yyyy 'at' h:mm a");
  } catch {
    return iso;
  }
}

const SCHEDULE_LABELS: Record<string, string> = {
  startup: "Every Startup",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

// ─── Health Check Panel ───────────────────────────────────────────────────────

function HealthPanel() {
  const [checked, setChecked] = useState(false);
  const healthQuery = useGetBackupHealth({ query: { enabled: false, queryKey: getGetBackupHealthQueryKey() } });

  const run = () => {
    setChecked(true);
    healthQuery.refetch();
  };

  const health = healthQuery.data as BackupHealth | undefined;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Database Health Check</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={run}
            disabled={healthQuery.isFetching}
          >
            {healthQuery.isFetching ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
            )}
            {healthQuery.isFetching ? "Checking…" : "Check Database Integrity"}
          </Button>
        </div>
        <CardDescription>
          Verify SQLite integrity, foreign-key relationships, WAL mode, and table schema.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!checked && !healthQuery.isFetching ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Click &ldquo;Check Database Integrity&rdquo; to run diagnostics.
          </div>
        ) : healthQuery.isFetching ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 w-48" />
              </div>
            ))}
          </div>
        ) : healthQuery.isError ? (
          <div className="text-sm text-destructive flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Failed to run health check. Please try again.
          </div>
        ) : health ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {health.status === "healthy" ? (
                <Badge variant="outline" className="gap-1.5 border-green-500/40 text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Database Healthy
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1.5">
                  <XCircle className="h-3.5 w-3.5" />
                  Database Error Detected
                </Badge>
              )}
            </div>
            <div className="space-y-2 pt-1">
              {health.checks.map((check) => (
                <div key={check.name} className="flex items-start gap-2.5 text-sm">
                  {check.passed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-medium">{check.name}:</span>{" "}
                    <span className="text-muted-foreground">{check.message}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

function SettingsPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const settingsQuery = useGetBackupSettings();
  const updateSettings = useUpdateBackupSettings();

  const [local, setLocal] = useState<Partial<BackupSettings>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settingsQuery.data && !dirty) {
      setLocal(settingsQuery.data);
    }
  }, [settingsQuery.data, dirty]);

  function patch<K extends keyof BackupSettings>(key: K, value: BackupSettings[K]) {
    setLocal((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  const settings = { ...settingsQuery.data, ...local } as BackupSettings;

  const save = () => {
    if (!settings) return;
    updateSettings.mutate(
      { data: settings },
      {
        onSuccess: () => {
          toast({ title: "Settings Saved", description: "Backup settings updated." });
          queryClient.invalidateQueries({ queryKey: getGetBackupSettingsQueryKey() });
          setDirty(false);
        },
        onError: () => {
          toast({ title: "Save Failed", description: "Could not save settings.", variant: "destructive" });
        },
      }
    );
  };

  if (settingsQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-muted-foreground" /> Auto-Backup Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Auto-Backup Settings</CardTitle>
        </div>
        <CardDescription>
          Configure automatic backup schedule and retention policy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="auto-backup-toggle" className="text-sm font-medium">
              Enable Auto-Backup
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automatically create backups on the selected schedule.
            </p>
          </div>
          <Switch
            id="auto-backup-toggle"
            checked={settings.autoBackupEnabled ?? false}
            onCheckedChange={(v) => patch("autoBackupEnabled", v)}
          />
        </div>

        <Separator />

        {/* Schedule */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <Label className="text-sm font-medium">Backup Schedule</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              How often automatic backups are created.
            </p>
          </div>
          <Select
            value={settings.autoBackupSchedule ?? "daily"}
            onValueChange={(v) => patch("autoBackupSchedule", v as BackupSettings["autoBackupSchedule"])}
            disabled={!settings.autoBackupEnabled}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="startup">Every Startup</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Max backup history */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <Label className="text-sm font-medium">Maximum Backup History</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Oldest backups beyond this limit are removed automatically.
            </p>
          </div>
          <Select
            value={settings.maxBackupHistory === null ? "unlimited" : String(settings.maxBackupHistory ?? 10)}
            onValueChange={(v) => patch("maxBackupHistory", v === "unlimited" ? null : Number(v))}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 backups</SelectItem>
              <SelectItem value="10">10 backups</SelectItem>
              <SelectItem value="20">20 backups</SelectItem>
              <SelectItem value="unlimited">Unlimited</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Backup folder (read-only display) */}
        <div>
          <Label className="text-sm font-medium">Backup Folder</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Server-side path where backup files are stored.
          </p>
          <div className="mt-1.5 px-3 py-2 bg-muted rounded-md font-mono text-xs text-muted-foreground break-all">
            {settings.backupFolder ?? BACKUPS_DIR_PLACEHOLDER}
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={save}
            disabled={updateSettings.isPending || !dirty}
          >
            {updateSettings.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Save Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const BACKUPS_DIR_PLACEHOLDER = "data/backups/";

// ─── Backup History Table ─────────────────────────────────────────────────────

interface BackupTableProps {
  onRestore: (filename: string) => void;
}

function BackupTable({ onRestore }: BackupTableProps) {
  const { data: backups, isLoading, isError } = useListBackups();
  const deleteBackup = useDeleteBackup();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleDelete = (filename: string) => {
    deleteBackup.mutate(
      { filename },
      {
        onSuccess: () => {
          toast({ title: "Backup Deleted", description: `${filename} has been removed.` });
          queryClient.invalidateQueries({ queryKey: getListBackupsQueryKey() });
          setDeleteTarget(null);
        },
        onError: () => {
          toast({ title: "Delete Failed", description: "Could not delete the backup.", variant: "destructive" });
          setDeleteTarget(null);
        },
      }
    );
  };

  const handleDownload = (filename: string) => {
    const url = `/api/backup/download/${encodeURIComponent(filename)}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <>
      {isError ? (
        <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20 flex items-center gap-2">
          <XCircle className="h-4 w-4 shrink-0" />
          Failed to load backup history. Please try again later.
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : !backups?.length ? (
        <EmptyState
          icon={Database}
          title="No Backups Yet"
          description="Create your first backup using the button above. Backups include the complete accounting database."
          buttonText="Create Backup"
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Backup Name</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Date
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1.5">
                      <HardDrive className="h-3.5 w-3.5" /> Size
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup, idx) => (
                  <TableRow key={backup.filename}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-foreground">{backup.filename}</span>
                        {idx === 0 && (
                          <Badge variant="secondary" className="text-xs shrink-0">Latest</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(backup.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatSize(backup.sizeBytes)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Download backup"
                          onClick={() => handleDownload(backup.filename)}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Restore from this backup"
                          onClick={() => onRestore(backup.filename)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Delete backup"
                          onClick={() => setDeleteTarget(backup.filename)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Backup?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono text-xs break-all">{deleteTarget}</span>
              <br />
              <br />
              This backup file will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              disabled={deleteBackup.isPending}
            >
              {deleteBackup.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Restore Dialog ───────────────────────────────────────────────────────────

interface RestoreDialogProps {
  filename: string | null;
  onClose: () => void;
}

function RestoreDialog({ filename, onClose }: RestoreDialogProps) {
  const restoreBackup = useRestoreBackup();
  const { toast } = useToast();
  const [restoring, setRestoring] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const poll = async () => {
    const MAX_ATTEMPTS = 30;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        const res = await fetch("/api/healthz");
        if (res.ok) {
          setReconnecting(false);
          toast({
            title: "Restore Complete",
            description: "Database restored successfully. The app has reconnected.",
          });
          onClose();
          // Reload the page so all queries use the restored database
          setTimeout(() => window.location.reload(), 800);
          return;
        }
      } catch {
        // server still restarting
      }
    }
    setReconnecting(false);
    toast({
      title: "Reconnect Timeout",
      description: "Server took too long to restart. Please refresh the page.",
      variant: "destructive",
    });
    onClose();
  };

  const handleRestore = () => {
    if (!filename) return;
    setRestoring(true);
    restoreBackup.mutate(
      { data: { filename } },
      {
        onSuccess: () => {
          setRestoring(false);
          setReconnecting(true);
          poll();
        },
        onError: () => {
          setRestoring(false);
          toast({
            title: "Restore Failed",
            description: "Could not restore from this backup. The file may be invalid.",
            variant: "destructive",
          });
          onClose();
        },
      }
    );
  };

  return (
    <AlertDialog open={!!filename} onOpenChange={(open) => !open && !restoring && !reconnecting && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore from Backup?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              {reconnecting ? (
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Server restarting… waiting to reconnect
                </div>
              ) : (
                <>
                  <p>
                    <strong className="text-foreground">Current database will be replaced.</strong>
                  </p>
                  <p>
                    All data entered after this backup was created will be lost. The application will
                    restart automatically after the restore completes.
                  </p>
                  <div className="bg-muted rounded px-3 py-2 font-mono text-xs break-all">
                    {filename}
                  </div>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {!reconnecting && (
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRestore}
              disabled={restoring}
            >
              {restoring && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {restoring ? "Restoring…" : "Yes, Restore Database"}
            </AlertDialogAction>
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Info Cards ───────────────────────────────────────────────────────────────

function InfoCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Card className="bg-muted/40">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium">Auto-Save</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Every add, edit, and delete operation is saved immediately to disk. No manual save required.
          </p>
        </CardContent>
      </Card>
      <Card className="bg-muted/40">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium">Crash Recovery</span>
          </div>
          <p className="text-xs text-muted-foreground">
            WAL mode + synchronous=NORMAL ensures committed transactions survive unexpected shutdowns.
          </p>
        </CardContent>
      </Card>
      <Card className="bg-muted/40">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium">Delete Protection</span>
          </div>
          <p className="text-xs text-muted-foreground">
            A confirmation dialog is shown before every record deletion to prevent accidental data loss.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Backup() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createBackup = useCreateBackup();
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);

  const handleCreateBackup = () => {
    createBackup.mutate(undefined, {
      onSuccess: (backup) => {
        toast({
          title: "Backup Created",
          description: `Saved as ${backup.filename}`,
        });
        queryClient.invalidateQueries({ queryKey: getListBackupsQueryKey() });
      },
      onError: () => {
        toast({
          title: "Backup Failed",
          description: "Failed to create backup. Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Backup &amp; Restore</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Protect your Crown King accounting data with manual and automatic backups.
          </p>
        </div>
        <Button onClick={handleCreateBackup} disabled={createBackup.isPending}>
          {createBackup.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          {createBackup.isPending ? "Creating…" : "Create Backup Now"}
        </Button>
      </div>

      {/* Info cards */}
      <InfoCards />

      {/* Health + Settings row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HealthPanel />
        <SettingsPanel />
      </div>

      {/* Backup History */}
      <div>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          Backup History
        </h2>
        <BackupTable onRestore={(filename) => setRestoreTarget(filename)} />
      </div>

      {/* Restore Dialog */}
      <RestoreDialog
        filename={restoreTarget}
        onClose={() => setRestoreTarget(null)}
      />
    </div>
  );
}
