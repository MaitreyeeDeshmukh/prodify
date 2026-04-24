'use client';

import { useState, useRef, useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const initials = session?.user?.name?.slice(0, 2).toUpperCase() ?? 'U';

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 rounded-full p-1 pr-3 transition-all focus:outline-none"
        style={{ border: '1px solid transparent' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#323779'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(87,94,254,0.08)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
      >
        <Avatar className="h-7 w-7">
          <AvatarImage src={session?.user?.image ?? undefined} />
          <AvatarFallback
            className="text-xs font-semibold"
            style={{ background: 'linear-gradient(135deg, #575efe, #00d7ff)', color: '#ffffff' }}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium max-w-[120px] truncate" style={{ color: '#e3f4f8' }}>
          {session?.user?.name ?? session?.user?.email}
        </span>
        <svg className="w-3.5 h-3.5" style={{ color: '#8589b2' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-52 rounded-2xl py-1 z-50"
          style={{
            background: 'rgba(27,30,61,0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid #323779',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          }}
        >
          <div className="px-3 py-2.5" style={{ borderBottom: '1px solid #323779' }}>
            <p className="text-xs truncate" style={{ color: '#8589b2' }}>{session?.user?.email}</p>
          </div>
          <button
            onClick={() => { setOpen(false); window.location.href = '/settings'; }}
            className="w-full text-left px-3 py-2 text-sm transition-colors"
            style={{ color: '#e3f4f8' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(87,94,254,0.1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            Settings
          </button>
          <button
            onClick={() => { setOpen(false); window.location.href = '/billing'; }}
            className="w-full text-left px-3 py-2 text-sm transition-colors"
            style={{ color: '#e3f4f8' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(87,94,254,0.1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            Billing
          </button>
          <div className="mt-1 pt-1" style={{ borderTop: '1px solid #323779' }}>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full text-left px-3 py-2 text-sm transition-colors"
              style={{ color: '#ff6b6b' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Header({ title }: { title?: string }) {
  return (
    <header
      className="h-14 flex items-center justify-between px-6 shrink-0"
      style={{ background: '#030712', borderBottom: '1px solid #1a1b2e' }}
    >
      <div>
        {title && (
          <h1
            className="text-base font-semibold"
            style={{ color: '#e3f4f8', fontFamily: 'var(--font-unbounded)' }}
          >
            {title}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Bell */}
        <button
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
          style={{ color: '#8589b2' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = '#e3f4f8';
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(87,94,254,0.1)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = '#8589b2';
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>

        <UserMenu />
      </div>
    </header>
  );
}
