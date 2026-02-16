'use client';

import { useState } from 'react';
import { api, apiRaw } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type WizardStep = 'check' | 'download' | 'backup' | 'install';
type StepStatus = 'idle' | 'loading' | 'done' | 'error';

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  currentCommit: string;
  remoteCommit: string;
  behindBy: number;
  releaseNotes: string[];
}

interface UpdateWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const steps: { id: WizardStep; label: string }[] = [
  { id: 'check', label: 'Check' },
  { id: 'download', label: 'Download' },
  { id: 'backup', label: 'Backup' },
  { id: 'install', label: 'Install' },
];

export function UpdateWizard({ open, onOpenChange }: UpdateWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('check');
  const [stepStatus, setStepStatus] = useState<Record<WizardStep, StepStatus>>({
    check: 'idle',
    download: 'idle',
    backup: 'idle',
    install: 'idle',
  });
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [installOutput, setInstallOutput] = useState<string | null>(null);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetWizard = () => {
    setCurrentStep('check');
    setStepStatus({ check: 'idle', download: 'idle', backup: 'idle', install: 'idle' });
    setUpdateInfo(null);
    setInstallOutput(null);
    setNewVersion(null);
    setError(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetWizard();
    }
    onOpenChange(newOpen);
  };

  const handleCheck = async () => {
    setStepStatus((prev) => ({ ...prev, check: 'loading' }));
    setError(null);
    try {
      const result = await api<UpdateInfo>('/settings/update/check', { method: 'POST' });
      setUpdateInfo(result);
      setStepStatus((prev) => ({ ...prev, check: 'done' }));
      if (result.behindBy > 0) {
        setCurrentStep('download');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to check for updates');
      setStepStatus((prev) => ({ ...prev, check: 'error' }));
    }
  };

  const handleDownload = async () => {
    setStepStatus((prev) => ({ ...prev, download: 'loading' }));
    setError(null);
    try {
      const result = await api<{ success: boolean; message: string }>('/settings/update/download', {
        method: 'POST',
      });
      if (result.success) {
        setStepStatus((prev) => ({ ...prev, download: 'done' }));
        setCurrentStep('backup');
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to download update');
      setStepStatus((prev) => ({ ...prev, download: 'error' }));
    }
  };

  const handleBackup = async () => {
    setStepStatus((prev) => ({ ...prev, backup: 'loading' }));
    setError(null);
    try {
      const resp = await apiRaw('/settings/backup', { method: 'POST' });
      const blob = await resp.blob();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${timestamp}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStepStatus((prev) => ({ ...prev, backup: 'done' }));
      setCurrentStep('install');
    } catch (err: any) {
      setError(err.message || 'Failed to create backup');
      setStepStatus((prev) => ({ ...prev, backup: 'error' }));
    }
  };

  const handleInstall = async () => {
    setStepStatus((prev) => ({ ...prev, install: 'loading' }));
    setError(null);
    try {
      const result = await api<{ success: boolean; output: string; newVersion: string }>(
        '/settings/update/apply',
        { method: 'POST' },
      );
      setInstallOutput(result.output);
      setNewVersion(result.newVersion);
      if (result.success) {
        setStepStatus((prev) => ({ ...prev, install: 'done' }));
      } else {
        throw new Error('Update completed with errors. Check the output for details.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to install update');
      setStepStatus((prev) => ({ ...prev, install: 'error' }));
    }
  };

  const getStepIndex = (step: WizardStep) => steps.findIndex((s) => s.id === step);
  const currentStepIndex = getStepIndex(currentStep);

  const isUpToDate = updateInfo && updateInfo.behindBy === 0;
  const hasUpdates = updateInfo && updateInfo.behindBy > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>System Updates</DialogTitle>
          <DialogDescription>
            Check for and install system updates from GitHub
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 py-4">
          {steps.map((step, index) => {
            const status = stepStatus[step.id];
            const isActive = currentStep === step.id;
            const isPast = getStepIndex(step.id) < currentStepIndex;
            const isDone = status === 'done';

            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-all duration-300',
                      isDone && 'border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/20',
                      isActive && !isDone && 'border-cyan-500 bg-cyan-500 text-white shadow-lg shadow-cyan-500/20',
                      !isActive && !isDone && 'border-border/40 text-muted-foreground',
                      status === 'error' && 'border-rose-500 bg-rose-500 text-white shadow-lg shadow-rose-500/20',
                    )}
                  >
                    {isDone ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : status === 'error' ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : status === 'loading' ? (
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className="mt-1 text-xs text-muted-foreground">{step.label}</span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'mx-2 h-0.5 w-12 rounded-full transition-colors duration-300',
                      isPast || isDone ? 'bg-emerald-500' : 'bg-border/30',
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Error message */}
        {error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-sm text-rose-400">
            {error}
          </div>
        )}

        {/* Step content */}
        <div className="min-h-[200px] space-y-4">
          {currentStep === 'check' && (
            <div className="space-y-4">
              {!updateInfo && stepStatus.check === 'idle' && (
                <div className="text-center">
                  <p className="mb-4 text-muted-foreground">
                    Click the button below to check for available updates.
                  </p>
                  <Button onClick={handleCheck}>Check for Updates</Button>
                </div>
              )}

              {stepStatus.check === 'loading' && (
                <div className="flex flex-col items-center gap-2 py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                  <p className="text-muted-foreground">Checking for updates...</p>
                </div>
              )}

              {updateInfo && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 rounded-xl border border-border/40 bg-card/30 p-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Version</p>
                      <p className="text-lg font-semibold">v{updateInfo.currentVersion}</p>
                      <p className="text-xs text-muted-foreground">
                        Commit: <code className="rounded bg-accent/30 px-1">{updateInfo.currentCommit.slice(0, 8)}</code>
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Latest Version</p>
                      <p className="text-lg font-semibold">v{updateInfo.latestVersion}</p>
                      <p className="text-xs text-muted-foreground">
                        Commit: <code className="rounded bg-accent/30 px-1">{updateInfo.remoteCommit.slice(0, 8)}</code>
                      </p>
                    </div>
                  </div>

                  {isUpToDate && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                      <p className="font-medium text-emerald-400">
                        Your system is up to date!
                      </p>
                    </div>
                  )}

                  {hasUpdates && (
                    <>
                      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                        <p className="font-medium text-cyan-400">
                          {updateInfo.behindBy} update{updateInfo.behindBy > 1 ? 's' : ''} available
                        </p>
                      </div>

                      {updateInfo.releaseNotes.length > 0 && (
                        <div>
                          <p className="mb-2 text-sm font-medium">Release Notes:</p>
                          <ul className="max-h-32 space-y-1 overflow-y-auto rounded-xl border border-border/40 bg-card/30 p-3 text-sm">
                            {updateInfo.releaseNotes.map((note, i) => (
                              <li key={i} className="text-muted-foreground">
                                &bull; {note}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex justify-center">
                    <Button onClick={handleCheck} variant="outline" size="sm">
                      Re-check
                    </Button>
                  </div>
                </div>
              )}

              {stepStatus.check === 'error' && (
                <div className="text-center">
                  <Button onClick={handleCheck} variant="outline">
                    Retry
                  </Button>
                </div>
              )}
            </div>
          )}

          {currentStep === 'download' && (
            <div className="space-y-4">
              {stepStatus.download === 'idle' && (
                <div className="text-center">
                  <p className="mb-4 text-muted-foreground">
                    Download the update before installing. This will fetch all changes from the repository.
                  </p>
                  <Button onClick={handleDownload}>Download Update</Button>
                </div>
              )}

              {stepStatus.download === 'loading' && (
                <div className="flex flex-col items-center gap-2 py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                  <p className="text-muted-foreground">Downloading update...</p>
                </div>
              )}

              {stepStatus.download === 'done' && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                  <p className="font-medium text-emerald-400">
                    Update downloaded successfully!
                  </p>
                </div>
              )}

              {stepStatus.download === 'error' && (
                <div className="text-center">
                  <Button onClick={handleDownload} variant="outline">
                    Retry Download
                  </Button>
                </div>
              )}
            </div>
          )}

          {currentStep === 'backup' && (
            <div className="space-y-4">
              {stepStatus.backup === 'idle' && (
                <div className="text-center">
                  <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-400">
                    <strong>Recommended:</strong> Create a database backup before installing the update.
                    This allows you to restore your data if anything goes wrong.
                  </div>
                  <Button onClick={handleBackup}>Create Backup &amp; Download</Button>
                </div>
              )}

              {stepStatus.backup === 'loading' && (
                <div className="flex flex-col items-center gap-2 py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                  <p className="text-muted-foreground">Creating database backup...</p>
                </div>
              )}

              {stepStatus.backup === 'done' && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                  <p className="font-medium text-emerald-400">
                    Backup created and downloaded successfully!
                  </p>
                </div>
              )}

              {stepStatus.backup === 'error' && (
                <div className="text-center">
                  <Button onClick={handleBackup} variant="outline">
                    Retry Backup
                  </Button>
                </div>
              )}
            </div>
          )}

          {currentStep === 'install' && (
            <div className="space-y-4">
              {stepStatus.install === 'idle' && (
                <div className="text-center">
                  <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-400">
                    <strong>Warning:</strong> Installing the update will run database migrations and rebuild the application.
                    The server may need to be restarted afterward.
                  </div>
                  <Button onClick={handleInstall}>Install Update</Button>
                </div>
              )}

              {stepStatus.install === 'loading' && (
                <div className="flex flex-col items-center gap-2 py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                  <p className="text-muted-foreground">Installing update...</p>
                  <p className="text-xs text-muted-foreground">This may take several minutes</p>
                </div>
              )}

              {(stepStatus.install === 'done' || stepStatus.install === 'error') && (
                <div className="space-y-4">
                  {stepStatus.install === 'done' && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <p className="font-medium text-emerald-400">
                        Update installed successfully!
                      </p>
                      {newVersion && (
                        <p className="mt-1 text-sm text-emerald-400/80">
                          New version: v{newVersion}
                        </p>
                      )}
                      <p className="mt-2 text-sm text-emerald-400/80">
                        Please restart the server to apply all changes.
                      </p>
                    </div>
                  )}

                  {installOutput && (
                    <div>
                      <p className="mb-2 text-sm font-medium">Installation Output:</p>
                      <pre className="max-h-48 overflow-auto rounded-xl border border-border/40 bg-card/30 p-3 text-xs font-mono">
                        {installOutput}
                      </pre>
                    </div>
                  )}

                  {stepStatus.install === 'error' && (
                    <div className="text-center">
                      <Button onClick={handleInstall} variant="outline">
                        Retry Install
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between border-t border-border/40 pt-4">
          <Button
            variant="ghost"
            onClick={() => {
              const prevIndex = currentStepIndex - 1;
              if (prevIndex >= 0) {
                setCurrentStep(steps[prevIndex].id);
              }
            }}
            disabled={currentStepIndex === 0 || stepStatus[currentStep] === 'loading'}
          >
            Back
          </Button>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
