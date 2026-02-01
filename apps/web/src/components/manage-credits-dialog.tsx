'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface ManageCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resellerId: string;
  companyName: string;
  currentBalance: number;
  onSuccess: () => void;
}

export function ManageCreditsDialog({
  open,
  onOpenChange,
  resellerId,
  companyName,
  currentBalance,
  onSuccess,
}: ManageCreditsDialogProps) {
  const [mode, setMode] = useState<'add' | 'subtract'>('add');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const numAmount = parseFloat(amount) || 0;
  const afterBalance = mode === 'add' ? currentBalance + numAmount : currentBalance - numAmount;
  const isValid = numAmount > 0 && (mode === 'add' || afterBalance >= 0);

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const endpoint = mode === 'add' ? '/credits/add' : '/credits/deduct';
      await api(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          resellerId,
          amount: numAmount,
          description: description || undefined,
        }),
      });
      setSuccess(`Successfully ${mode === 'add' ? 'added' : 'deducted'} ${numAmount} credits`);
      setAmount('');
      setDescription('');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setAmount('');
      setDescription('');
      setError('');
      setSuccess('');
      setMode('add');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Credits</DialogTitle>
          <DialogDescription>{companyName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted p-3 text-center">
            <div className="text-sm text-muted-foreground">Current Balance</div>
            <div className="text-2xl font-bold">{currentBalance} credits</div>
          </div>

          <div className="flex gap-2">
            <Button
              variant={mode === 'add' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setMode('add')}
            >
              Add Credits
            </Button>
            <Button
              variant={mode === 'subtract' ? 'destructive' : 'outline'}
              className="flex-1"
              onClick={() => setMode('subtract')}
            >
              Subtract Credits
            </Button>
          </div>

          <Input
            type="number"
            placeholder="Amount"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <Input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {numAmount > 0 && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="text-muted-foreground">{currentBalance} credits</span>
              <span>→</span>
              <span className={afterBalance < 0 ? 'font-semibold text-destructive' : 'font-semibold'}>
                {afterBalance} credits
              </span>
            </div>
          )}

          {mode === 'subtract' && numAmount > 0 && afterBalance < 0 && (
            <p className="text-sm text-destructive">Insufficient balance for this deduction.</p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Close
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || loading}>
            {loading ? 'Processing...' : mode === 'add' ? 'Add Credits' : 'Deduct Credits'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
