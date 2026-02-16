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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-scanlines" style={{ backgroundColor: '#060810' }}>
      {/* Animated grid background */}
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />

      {/* Scan-line overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(6,200,220,0.015) 2px, rgba(6,200,220,0.015) 4px)',
          zIndex: 1,
        }}
      />

      {/* Background glow orbs */}
      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 0 }}>
        <div
          className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full blur-3xl animate-pulse-glow"
          style={{ backgroundColor: 'rgba(6,182,212,0.15)' }}
        />
        <div
          className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full blur-3xl animate-pulse-glow animation-delay-300"
          style={{ backgroundColor: 'rgba(20,184,166,0.12)' }}
        />
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md px-4 animate-fade-up">
        <div
          className="backdrop-blur-xl rounded-2xl p-8 shadow-2xl"
          style={{
            backgroundColor: 'rgba(10,14,26,0.7)',
            border: '1px solid rgba(6,182,212,0.08)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6), 0 0 40px -12px rgba(6,182,212,0.08)',
          }}
        >
          {/* Shield icon with cyan-to-teal gradient */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div
                className="absolute inset-0 rounded-2xl blur-xl opacity-50 animate-pulse-glow"
                style={{ background: 'linear-gradient(to bottom right, #06b6d4, #0d9488)' }}
              />
              <div
                className="relative rounded-2xl p-4"
                style={{ background: 'linear-gradient(to bottom right, #06b6d4, #0d9488)' }}
              >
                <Shield className="w-10 h-10 text-white" />
              </div>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <h1
              className="font-heading text-3xl font-bold mb-2 text-gradient animate-gradient"
              style={{
                backgroundImage: 'linear-gradient(to right, #22d3ee, #2dd4bf, #22d3ee)',
                backgroundSize: '200% 200%',
              }}
            >
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
              <div
                className="rounded-xl p-3 text-sm animate-slide-in"
                style={{
                  backgroundColor: 'rgba(244,63,94,0.08)',
                  border: '1px solid rgba(244,63,94,0.15)',
                  color: '#fb7185',
                }}
              >
                {error}
              </div>
            )}

            {/* Username field */}
            <div className="space-y-2">
              <label className="font-body block text-sm font-medium text-foreground/90">
                Username
              </label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
                className="transition-all duration-200 !bg-[#0a0e1a]/80 !border-[rgba(6,182,212,0.12)] focus-visible:!ring-cyan-500/40 focus-visible:!border-cyan-500/40"
              />
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <label className="font-body block text-sm font-medium text-foreground/90">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="transition-all duration-200 !bg-[#0a0e1a]/80 !border-[rgba(6,182,212,0.12)] focus-visible:!ring-cyan-500/40 focus-visible:!border-cyan-500/40"
              />
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              className="w-full mt-6 !bg-cyan-600 hover:!brightness-110 !shadow-lg !shadow-cyan-600/20 hover:!shadow-cyan-600/40 !from-cyan-600 !to-cyan-600"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </div>

        {/* Footer text */}
        <div className="text-center mt-6 text-xs text-muted-foreground font-mono tracking-wider animate-fade-in animation-delay-200">
          Secure VPN Management Platform
        </div>
      </div>
    </div>
  );
}
