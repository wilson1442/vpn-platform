'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function ChangelogPage() {
  const { user } = useAuth();
  const [content, setContent] = useState<string>('');

  useEffect(() => {
    fetch(`${API_URL}/settings/changelog`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.content) setContent(data.content);
      })
      .catch(() => {});
  }, []);

  const backHref = user?.role === 'ADMIN' ? '/admin' : user?.role === 'RESELLER' ? '/reseller' : '/user';

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={backHref}
        className="mb-6 inline-block text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        &larr; Back to Dashboard
      </Link>
      <div className="prose prose-invert max-w-none">
        {content.split('\n').map((line, i) => {
          if (line.startsWith('## ')) {
            return (
              <h2 key={i} className="mt-8 mb-3 text-xl font-semibold text-foreground">
                {line.replace('## ', '')}
              </h2>
            );
          }
          if (line.startsWith('# ')) {
            return (
              <h1 key={i} className="mb-6 text-3xl font-bold text-foreground">
                {line.replace('# ', '')}
              </h1>
            );
          }
          if (line.startsWith('- ')) {
            return (
              <li key={i} className="ml-4 text-sm text-muted-foreground">
                {line.replace('- ', '')}
              </li>
            );
          }
          if (line.trim() === '') {
            return null;
          }
          return (
            <p key={i} className="text-sm text-muted-foreground">
              {line}
            </p>
          );
        })}
      </div>
    </div>
  );
}
