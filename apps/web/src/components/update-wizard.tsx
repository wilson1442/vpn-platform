'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type WizardStep = 'check' | 'download' | 'install';
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
  { id: 'install', label: 'Install' },
];

export function UpdateWizard({ open, onOpenChange }: UpdateWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('check');
  const [stepStatus, setStepStatus] = useState<Record<WizardStep, StepStatus>>({
    check: 'idle',
    download: 'idle',
    install: 'idle',
  });
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [installOutput, setInstallOutput] = useState<string | null>(null);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetWizard = () => {
    setCurrentStep('check');
    setStepStatus({ check: 'idle', download: 'idle', install: 'idle' });
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
        setCurrentStep('install');
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to download update');
      setStepStatus((prev) => ({ ...prev, download: 'error' }));
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
                      'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors',
                      isDone && 'border-green-500 bg-green-500 text-white',
                      isActive && !isDone && 'border-primary bg-primary text-primary-foreground',
                      !isActive && !isDone && 'border-muted-foreground/30 text-muted-foreground',
                      status === 'error' && 'border-red-500 bg-red-500 text-white',
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
                      'mx-2 h-0.5 w-12',
                      isPast || isDone ? 'bg-green-500' : 'bg-muted-foreground/30',
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Error message */}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
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
                  <svg className="h-8 w-8 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-muted-foreground">Checking for updates...</p>
                </div>
              )}

              {updateInfo && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 rounded-md border p-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Version</p>
                      <p className="text-lg font-semibold">v{updateInfo.currentVersion}</p>
                      <p className="text-xs text-muted-foreground">
                        Commit: <code>{updateInfo.currentCommit.slice(0, 8)}</code>
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Latest Version</p>
                      <p className="text-lg font-semibold">v{updateInfo.latestVersion}</p>
                      <p className="text-xs text-muted-foreground">
                        Commit: <code>{updateInfo.remoteCommit.slice(0, 8)}</code>
                      </p>
                    </div>
                  </div>

                  {isUpToDate && (
                    <div className="rounded-md border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-950/20">
                      <p className="font-medium text-green-800 dark:text-green-400">
                        Your system is up to date!
                      </p>
                    </div>
                  )}

                  {hasUpdates && (
                    <>
                      <div className="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
                        <p className="font-medium text-blue-800 dark:text-blue-400">
                          {updateInfo.behindBy} update{updateInfo.behindBy > 1 ? 's' : ''} available
                        </p>
                      </div>

                      {updateInfo.releaseNotes.length > 0 && (
                        <div>
                          <p className="mb-2 text-sm font-medium">Release Notes:</p>
                          <ul className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-3 text-sm">
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
                  <svg className="h-8 w-8 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-muted-foreground">Downloading update...</p>
                </div>
              )}

              {stepStatus.download === 'done' && (
                <div className="rounded-md border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-950/20">
                  <p className="font-medium text-green-800 dark:text-green-400">
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

          {currentStep === 'install' && (
            <div className="space-y-4">
              {stepStatus.install === 'idle' && (
                <div className="text-center">
                  <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-400">
                    <strong>Warning:</strong> Installing the update will run database migrations and rebuild the application.
                    The server may need to be restarted afterward.
                  </div>
                  <Button onClick={handleInstall}>Install Update</Button>
                </div>
              )}

              {stepStatus.install === 'loading' && (
                <div className="flex flex-col items-center gap-2 py-8">
                  <svg className="h-8 w-8 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-muted-foreground">Installing update...</p>
                  <p className="text-xs text-muted-foreground">This may take several minutes</p>
                </div>
              )}

              {(stepStatus.install === 'done' || stepStatus.install === 'error') && (
                <div className="space-y-4">
                  {stepStatus.install === 'done' && (
                    <div className="rounded-md border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/20">
                      <p className="font-medium text-green-800 dark:text-green-400">
                        Update installed successfully!
                      </p>
                      {newVersion && (
                        <p className="mt-1 text-sm text-green-700 dark:text-green-500">
                          New version: v{newVersion}
                        </p>
                      )}
                      <p className="mt-2 text-sm text-green-700 dark:text-green-500">
                        Please restart the server to apply all changes.
                      </p>
                    </div>
                  )}

                  {installOutput && (
                    <div>
                      <p className="mb-2 text-sm font-medium">Installation Output:</p>
                      <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
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
        <div className="flex justify-between border-t pt-4">
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
