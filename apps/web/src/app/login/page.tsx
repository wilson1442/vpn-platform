'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background bg-dots">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl animate-pulse-glow" />
        <div className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl animate-pulse-glow animation-delay-300" />
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md px-4 animate-fade-up">
        <div className="backdrop-blur-xl bg-card/30 border border-border/50 rounded-2xl p-8 shadow-2xl">
          {/* Logo/Icon with gradient */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl blur-xl opacity-50 animate-pulse-glow" />
              <div className="relative bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl p-4">
                <Shield className="w-10 h-10 text-white" />
              </div>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2 text-gradient bg-gradient-to-r from-indigo-400 via-blue-400 to-indigo-400 animate-gradient">
              VPN Platform
            </h1>
            <p className="text-muted-foreground text-sm">
              Sign in to your account
            </p>
          </div>

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error message */}
            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400 animate-slide-in">
                {error}
              </div>
            )}

            {/* Username field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground/90">
                Username
              </label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
                className="transition-all duration-200"
              />
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground/90">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="transition-all duration-200"
              />
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              className="w-full mt-6"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </div>

        {/* Footer text */}
        <div className="text-center mt-6 text-xs text-muted-foreground animate-fade-in animation-delay-200">
          Secure VPN Management Platform
        </div>
      </div>
    </div>
  );
}
