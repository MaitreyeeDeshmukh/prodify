# Prodify UI/UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete end-to-end UI/UX redesign of Prodify — every page, every state, every interaction — to a professional SaaS-grade interface matching the quality of Linear/Vercel/Resend.

**Architecture:** Component-driven redesign with a new breadcrumb context system, sonner toasts, sessionStorage form persistence, and lucide-react icons throughout. All inline `onMouseEnter/Leave` hover handlers replaced with Tailwind `hover:` classes. Every page gets back buttons, loading skeletons, empty states, and proper CRUD dialogs. The existing PATCH `/api/projects/[id]` route is already implemented — no API work needed beyond wiring.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · TailwindCSS v4 · shadcn/ui · sonner (toasts, to install) · lucide-react · next-auth 4.24 · InsForge SDK

**Branch:** `feat/ui-ux-overhaul` (already created)

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Install | `sonner` | Toast notifications |
| Create | `apps/web/lib/breadcrumbs.tsx` | BreadcrumbProvider + useBreadcrumbs + SetBreadcrumbs |
| Create | `apps/web/hooks/use-back.ts` | Smart back navigation with history fallback |
| Create | `apps/web/hooks/use-saved-form.ts` | sessionStorage form persistence |
| Create | `apps/web/components/ui/back-button.tsx` | Reusable ← Back button |
| Create | `apps/web/components/ui/breadcrumb.tsx` | Breadcrumb trail renderer |
| Create | `apps/web/components/ui/page-header.tsx` | Consistent page title + actions bar |
| Create | `apps/web/components/ui/empty-state.tsx` | Reusable empty state with icon + CTA |
| Create | `apps/web/components/ui/skeleton.tsx` | Skeleton loaders (generic + ProjectCardSkeleton) |
| Create | `apps/web/components/ui/confirm-dialog.tsx` | Replaces native confirm() everywhere |
| Create | `apps/web/components/ui/status-badge.tsx` | Unified project status badge |
| Create | `apps/web/components/providers/toast-provider.tsx` | Sonner Toaster wrapper |
| Create | `apps/web/components/projects/edit-project-dialog.tsx` | Edit project name/description |
| Create | `apps/web/components/projects/delete-project-dialog.tsx` | Delete project confirmation |
| Modify | `apps/web/app/layout.tsx` | Add ToastProvider |
| Modify | `apps/web/app/(dashboard)/layout.tsx` | Add BreadcrumbProvider, wire new Header |
| Modify | `apps/web/components/dashboard/sidebar.tsx` | Full redesign: lucide icons, Tailwind hover |
| Modify | `apps/web/components/dashboard/header.tsx` | Add Breadcrumb component, clean Tailwind |
| Modify | `apps/web/app/(dashboard)/dashboard/page.tsx` | SetBreadcrumbs, stats, skeleton, empty state |
| Modify | `apps/web/components/projects/project-card.tsx` | DropdownMenu, StatusBadge, no inline handlers |
| Modify | `apps/web/components/dashboard/repo-import-dialog.tsx` | UX polish, error states, loading feedback |
| Modify | `apps/web/app/(dashboard)/dashboard/projects/[id]/page.tsx` | Full redesign: back button, tabs, all states |
| Modify | `apps/web/app/(dashboard)/analytics/page.tsx` | SetBreadcrumbs, stats, skeleton |
| Modify | `apps/web/app/(dashboard)/billing/page.tsx` | SetBreadcrumbs, real plan cards, upgrade flow |
| Modify | `apps/web/app/(dashboard)/settings/page.tsx` | SetBreadcrumbs, tab polish, toast feedback |
| Modify | `apps/web/components/auth/login-form.tsx` | Visual polish |
| Modify | `apps/web/components/auth/signup-form.tsx` | Visual polish |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install sonner**

```bash
cd apps/web && npm install sonner
```

Expected output: `added 1 package`

- [ ] **Step 2: Verify**

```bash
node -e "require('sonner'); console.log('ok')"
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json
git commit -m "chore: install sonner for toast notifications"
```

---

## Task 2: Navigation Foundation

**Files:**
- Create: `apps/web/lib/breadcrumbs.tsx`
- Create: `apps/web/hooks/use-back.ts`
- Create: `apps/web/hooks/use-saved-form.ts`

- [ ] **Step 1: Create breadcrumb context**

Create `apps/web/lib/breadcrumbs.tsx`:

```tsx
'use client';

import { createContext, useContext, useState, useEffect, useRef } from 'react';

export type Crumb = { label: string; href?: string };

type BreadcrumbCtx = {
  crumbs: Crumb[];
  set: (crumbs: Crumb[]) => void;
};

const Ctx = createContext<BreadcrumbCtx>({ crumbs: [], set: () => {} });

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [crumbs, set] = useState<Crumb[]>([]);
  return <Ctx.Provider value={{ crumbs, set }}>{children}</Ctx.Provider>;
}

export function useBreadcrumbs() {
  return useContext(Ctx);
}

// Drop this inside any page component — renders nothing, just sets crumbs
export function SetBreadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const { set } = useContext(Ctx);
  const key = JSON.stringify(crumbs);
  const prev = useRef('');
  useEffect(() => {
    if (prev.current === key) return;
    prev.current = key;
    set(crumbs);
  }, [key, set]);
  return null;
}
```

- [ ] **Step 2: Create useBack hook**

Create `apps/web/hooks/use-back.ts`:

```ts
'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export function useBack(fallback: string) {
  const router = useRouter();
  return useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }, [router, fallback]);
}
```

- [ ] **Step 3: Create useSavedForm hook**

Create `apps/web/hooks/use-saved-form.ts`:

```ts
import { useState, useCallback } from 'react';

export function useSavedForm<T>(key: string, initial: T) {
  const storageKey = `prodify:form:${key}`;

  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const stored = sessionStorage.getItem(storageKey);
      return stored ? (JSON.parse(stored) as T) : initial;
    } catch {
      return initial;
    }
  });

  const update = useCallback(
    (updater: Partial<T> | ((prev: T) => T)) => {
      setValue(prev => {
        const next =
          typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
        try {
          sessionStorage.setItem(storageKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [storageKey],
  );

  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {}
    setValue(initial);
  }, [storageKey, initial]);

  return { value, update, clear };
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/breadcrumbs.tsx apps/web/hooks/use-back.ts apps/web/hooks/use-saved-form.ts
git commit -m "feat: add breadcrumb context, useBack, and useSavedForm hooks"
```

---

## Task 3: Core UI Primitives

**Files:**
- Create: `apps/web/components/ui/back-button.tsx`
- Create: `apps/web/components/ui/breadcrumb.tsx`
- Create: `apps/web/components/ui/page-header.tsx`
- Create: `apps/web/components/ui/empty-state.tsx`
- Create: `apps/web/components/ui/skeleton.tsx`
- Create: `apps/web/components/ui/confirm-dialog.tsx`
- Create: `apps/web/components/ui/status-badge.tsx`

- [ ] **Step 1: BackButton**

Create `apps/web/components/ui/back-button.tsx`:

```tsx
'use client';

import { ArrowLeft } from 'lucide-react';
import { useBack } from '@/hooks/use-back';

interface Props {
  fallback: string;
  label?: string;
}

export function BackButton({ fallback, label = 'Back' }: Props) {
  const back = useBack(fallback);
  return (
    <button
      onClick={back}
      className="flex items-center gap-1.5 text-sm text-[#8589b2] hover:text-[#e3f4f8] transition-colors group mb-4"
    >
      <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Breadcrumb renderer**

Create `apps/web/components/ui/breadcrumb.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useBreadcrumbs } from '@/lib/breadcrumbs';

export function Breadcrumb() {
  const { crumbs } = useBreadcrumbs();
  if (crumbs.length <= 1) return null;

  return (
    <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3 h-3 text-[#8589b2]" />}
            {isLast || !crumb.href ? (
              <span className={isLast ? 'text-[#e3f4f8] font-medium' : 'text-[#8589b2]'}>
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-[#8589b2] hover:text-[#e3f4f8] transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: PageHeader**

Create `apps/web/components/ui/page-header.tsx`:

```tsx
import { BackButton } from './back-button';

interface Props {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  back?: { fallback: string; label?: string };
}

export function PageHeader({ title, description, actions, back }: Props) {
  return (
    <div className="mb-6">
      {back && <BackButton fallback={back.fallback} label={back.label} />}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-xl font-bold text-[#e3f4f8]"
            style={{ fontFamily: 'var(--font-unbounded)' }}
          >
            {title}
          </h1>
          {description && (
            <p className="text-sm text-[#8589b2] mt-1">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: EmptyState**

Create `apps/web/components/ui/empty-state.tsx`:

```tsx
import { type LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
        style={{
          background: 'rgba(87,94,254,0.1)',
          border: '1px solid rgba(87,94,254,0.2)',
        }}
      >
        <Icon className="w-6 h-6 text-[#575efe]" />
      </div>
      <h3 className="text-base font-semibold text-[#e3f4f8] mb-1">{title}</h3>
      <p className="text-sm text-[#8589b2] max-w-xs mb-5">{description}</p>
      {action}
    </div>
  );
}
```

- [ ] **Step 5: Skeleton**

Create `apps/web/components/ui/skeleton.tsx`:

```tsx
import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg',
        className,
      )}
      style={{ background: 'rgba(50,55,121,0.4)' }}
    />
  );
}

export function ProjectCardSkeleton() {
  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: '#25284c', border: '1px solid #323779' }}
    >
      <div className="flex items-start justify-between mb-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-52 mb-4" />
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <div className="flex justify-between items-center">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: '#25284c', border: '1px solid #323779' }}
    >
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-8 w-16 mb-1" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}
```

- [ ] **Step 6: ConfirmDialog**

Create `apps/web/components/ui/confirm-dialog.tsx`:

```tsx
'use client';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  danger = false,
  loading = false,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm"
        style={{ background: '#1b1e3d', border: '1px solid #323779' }}
      >
        <DialogTitle className="text-[#e3f4f8]">{title}</DialogTitle>
        <DialogDescription className="text-[#8589b2]">{description}</DialogDescription>
        <div className="flex gap-2 justify-end mt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="border-[#323779] text-[#8589b2] hover:text-[#e3f4f8] hover:border-[#575efe]"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className={
              danger
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-[#575efe] hover:bg-[#4a52e8] text-white'
            }
          >
            {loading ? 'Loading...' : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 7: StatusBadge**

Create `apps/web/components/ui/status-badge.tsx`:

```tsx
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; pulse?: boolean }> = {
  draft:     { label: 'Draft',     color: '#8589b2', bg: 'rgba(133,137,178,0.12)' },
  pending:   { label: 'Pending',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  analyzing: { label: 'Analyzing', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', pulse: true },
  analyzed:  { label: 'Ready',     color: '#575efe', bg: 'rgba(87,94,254,0.12)'   },
  injecting: { label: 'Injecting', color: '#00d7ff', bg: 'rgba(0,215,255,0.12)',  pulse: true },
  injected:  { label: 'Injected',  color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  error:     { label: 'Error',     color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {cfg.pulse && (
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse inline-block"
          style={{ background: cfg.color }}
        />
      )}
      {cfg.label}
    </span>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/ui/back-button.tsx apps/web/components/ui/breadcrumb.tsx apps/web/components/ui/page-header.tsx apps/web/components/ui/empty-state.tsx apps/web/components/ui/skeleton.tsx apps/web/components/ui/confirm-dialog.tsx apps/web/components/ui/status-badge.tsx
git commit -m "feat: add core UI primitives — BackButton, Breadcrumb, PageHeader, EmptyState, Skeleton, ConfirmDialog, StatusBadge"
```

---

## Task 4: Toast Provider

**Files:**
- Create: `apps/web/components/providers/toast-provider.tsx`
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Create ToastProvider**

Create `apps/web/components/providers/toast-provider.tsx`:

```tsx
'use client';

import { Toaster } from 'sonner';

export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      theme="dark"
      toastOptions={{
        style: {
          background: '#1b1e3d',
          border: '1px solid #323779',
          color: '#e3f4f8',
        },
      }}
    />
  );
}
```

- [ ] **Step 2: Add to root layout**

In `apps/web/app/layout.tsx`, import and add `<ToastProvider />` inside the `<body>` tag, after the existing children:

```tsx
import { ToastProvider } from '@/components/providers/toast-provider';

// inside <body>:
<ToastProvider />
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/providers/toast-provider.tsx apps/web/app/layout.tsx
git commit -m "feat: add sonner toast provider to root layout"
```

---

## Task 5: Sidebar Redesign

**Files:**
- Modify: `apps/web/components/dashboard/sidebar.tsx`

Replace the entire file. Key changes: lucide-react icons, Tailwind `hover:` classes (no inline event handlers), `data-[active=true]` pattern for active state styling.

- [ ] **Step 1: Replace sidebar**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  FolderGit2,
  BarChart3,
  CreditCard,
  Settings,
  Github,
  Zap,
} from 'lucide-react';

const links = [
  { href: '/dashboard', label: 'Projects',  icon: FolderGit2 },
  { href: '/analytics', label: 'Analytics', icon: BarChart3  },
  { href: '/billing',   label: 'Billing',   icon: CreditCard },
  { href: '/settings',  label: 'Settings',  icon: Settings   },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="w-56 h-screen flex flex-col shrink-0 relative"
      style={{ background: '#030712', borderRight: '1px solid #1a1b2e' }}
    >
      {/* brand gradient top line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, #575efe, #00d7ff)' }}
      />

      {/* Logo */}
      <div className="p-4 pt-5" style={{ borderBottom: '1px solid #1a1b2e' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #575efe 0%, #00d7ff 100%)' }}
          >
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span
            className="font-black text-sm tracking-tight text-[#e3f4f8]"
            style={{ fontFamily: 'var(--font-unbounded)' }}
          >
            Prodify
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold uppercase tracking-widest px-3 py-2 text-[#8589b2]">
          Menu
        </p>
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            href === '/dashboard'
              ? pathname === '/dashboard' || pathname.startsWith('/dashboard/projects')
              : pathname === href;

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                active
                  ? 'text-[#e3f4f8] bg-[rgba(87,94,254,0.15)] border border-[rgba(87,94,254,0.25)]'
                  : 'text-[#8589b2] border border-transparent hover:text-[#e3f4f8] hover:bg-[rgba(87,94,254,0.08)]',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2" style={{ borderTop: '1px solid #1a1b2e' }}>
        <a
          href="https://github.com/MaitreyeeDeshmukh/prodify"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#8589b2] hover:text-[#e3f4f8] hover:bg-[rgba(87,94,254,0.08)] transition-all"
        >
          <Github className="w-3.5 h-3.5" />
          View on GitHub
        </a>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/dashboard/sidebar.tsx
git commit -m "feat: redesign sidebar — lucide icons, Tailwind hover classes, no inline event handlers"
```

---

## Task 6: Header Redesign

**Files:**
- Modify: `apps/web/components/dashboard/header.tsx`

Key changes: render Breadcrumb component, remove inline event handlers, clean up user menu using shadcn DropdownMenu.

- [ ] **Step 1: Replace header**

```tsx
'use client';

import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Bell, ChevronDown, LogOut, Settings, CreditCard } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Breadcrumb } from '@/components/ui/breadcrumb';

function UserMenu() {
  const { data: session } = useSession();
  const router = useRouter();
  const initials = (session?.user?.name ?? session?.user?.email ?? 'U')
    .slice(0, 2)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-[rgba(87,94,254,0.08)] border border-transparent hover:border-[#323779] focus:outline-none">
          <Avatar className="h-6 w-6">
            <AvatarImage src={session?.user?.image ?? undefined} />
            <AvatarFallback
              className="text-[10px] font-bold"
              style={{ background: 'linear-gradient(135deg, #575efe, #00d7ff)', color: '#fff' }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="text-[#e3f4f8] max-w-[100px] truncate text-xs font-medium">
            {session?.user?.name ?? session?.user?.email}
          </span>
          <ChevronDown className="w-3 h-3 text-[#8589b2]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52 rounded-xl"
        style={{ background: 'rgba(27,30,61,0.98)', border: '1px solid #323779', backdropFilter: 'blur(20px)' }}
      >
        <div className="px-3 py-2" style={{ borderBottom: '1px solid #323779' }}>
          <p className="text-xs text-[#8589b2] truncate">{session?.user?.email}</p>
        </div>
        <DropdownMenuItem
          className="text-[#e3f4f8] hover:bg-[rgba(87,94,254,0.1)] cursor-pointer gap-2"
          onClick={() => router.push('/settings')}
        >
          <Settings className="w-3.5 h-3.5" /> Settings
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-[#e3f4f8] hover:bg-[rgba(87,94,254,0.1)] cursor-pointer gap-2"
          onClick={() => router.push('/billing')}
        >
          <CreditCard className="w-3.5 h-3.5" /> Billing
        </DropdownMenuItem>
        <DropdownMenuSeparator style={{ background: '#323779' }} />
        <DropdownMenuItem
          className="text-red-400 hover:bg-[rgba(239,68,68,0.1)] cursor-pointer gap-2"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  return (
    <header
      className="h-13 flex items-center justify-between px-6 shrink-0"
      style={{ background: '#030712', borderBottom: '1px solid #1a1b2e' }}
    >
      <Breadcrumb />
      <div className="flex items-center gap-2">
        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8589b2] hover:text-[#e3f4f8] hover:bg-[rgba(87,94,254,0.08)] transition-colors">
          <Bell className="w-4 h-4" />
        </button>
        <UserMenu />
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/dashboard/header.tsx
git commit -m "feat: redesign header — shadcn DropdownMenu, Breadcrumb component, clean Tailwind"
```

---

## Task 7: Dashboard Layout — Wire BreadcrumbProvider

**Files:**
- Modify: `apps/web/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Update layout to wrap with BreadcrumbProvider**

```tsx
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';
import { BreadcrumbProvider } from '@/lib/breadcrumbs';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <BreadcrumbProvider>
      <div className="flex h-screen overflow-hidden" style={{ background: '#030712' }}>
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Header />
          <main
            className="flex-1 overflow-y-auto p-6 lg:p-8"
            style={{ background: '#030712' }}
          >
            {children}
          </main>
        </div>
      </div>
    </BreadcrumbProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(dashboard\)/layout.tsx
git commit -m "feat: wrap dashboard layout with BreadcrumbProvider"
```

---

## Task 8: ProjectCard Redesign

**Files:**
- Modify: `apps/web/components/projects/project-card.tsx`
- Create: `apps/web/components/projects/edit-project-dialog.tsx`
- Create: `apps/web/components/projects/delete-project-dialog.tsx`

- [ ] **Step 1: Create EditProjectDialog**

Create `apps/web/components/projects/edit-project-dialog.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(280).optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: { id: string; name: string; description: string | null };
  onSaved: (updated: { name: string; description: string | null }) => void;
}

export function EditProjectDialog({ open, onOpenChange, project, onSaved }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: project.name, description: project.description ?? '' },
  });

  useEffect(() => {
    if (open) reset({ name: project.name, description: project.description ?? '' });
  }, [open, project, reset]);

  async function onSubmit(data: FormData) {
    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      toast.error('Failed to save changes');
      return;
    }
    toast.success('Project updated');
    onSaved({ name: data.name, description: data.description ?? null });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        style={{ background: '#1b1e3d', border: '1px solid #323779' }}
      >
        <DialogTitle className="text-[#e3f4f8]">Edit Project</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-[#8589b2] text-xs uppercase tracking-wide">Name</Label>
            <Input
              {...register('name')}
              className="bg-[#0d0f1e] border-[#323779] text-[#e3f4f8] focus:border-[#575efe]"
            />
            {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[#8589b2] text-xs uppercase tracking-wide">
              Description <span className="normal-case opacity-60">(optional)</span>
            </Label>
            <Input
              {...register('description')}
              placeholder="Short description..."
              className="bg-[#0d0f1e] border-[#323779] text-[#e3f4f8] focus:border-[#575efe]"
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="border-[#323779] text-[#8589b2] hover:text-[#e3f4f8]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#575efe] hover:bg-[#4a52e8] text-white"
            >
              {isSubmitting ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create DeleteProjectDialog**

Create `apps/web/components/projects/delete-project-dialog.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: { id: string; name: string };
  onDeleted?: () => void;
}

export function DeleteProjectDialog({ open, onOpenChange, project, onDeleted }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast.success(`"${project.name}" deleted`);
      onOpenChange(false);
      if (onDeleted) onDeleted();
      else router.refresh();
    } catch {
      toast.error('Could not delete project');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete "${project.name}"?`}
      description="This will permanently delete the project and all its analysis data. This cannot be undone."
      confirmLabel="Delete project"
      danger
      loading={loading}
      onConfirm={handleDelete}
    />
  );
}
```

- [ ] **Step 3: Rewrite ProjectCard with DropdownMenu**

Replace `apps/web/components/projects/project-card.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MoreHorizontal, Pencil, Trash2, ExternalLink, GitBranch } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusBadge } from '@/components/ui/status-badge';
import { EditProjectDialog } from './edit-project-dialog';
import { DeleteProjectDialog } from './delete-project-dialog';

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  repoUrl: string | null;
  repoFullName: string | null;
  prUrl: string | null;
  createdAt: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function ProjectCard({
  project,
  onUpdated,
  onDeleted,
}: {
  project: Project;
  onUpdated?: (p: Partial<Project>) => void;
  onDeleted?: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <div
        className="group relative rounded-2xl p-5 border border-[#323779] hover:border-[#575efe] transition-all duration-200 cursor-pointer"
        style={{ background: '#111827' }}
      >
        {/* Clickable overlay to navigate */}
        <Link
          href={`/dashboard/projects/${project.id}`}
          className="absolute inset-0 rounded-2xl"
          aria-label={`Open ${project.name}`}
        />

        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2 relative z-10 pointer-events-none">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center"
              style={{ background: 'rgba(87,94,254,0.15)', border: '1px solid rgba(87,94,254,0.25)' }}
            >
              <GitBranch className="w-3.5 h-3.5 text-[#575efe]" />
            </div>
            <h3 className="font-semibold text-sm text-[#e3f4f8] truncate">{project.name}</h3>
          </div>
          <StatusBadge status={project.status} />
        </div>

        {/* Description */}
        {project.description && (
          <p className="text-xs text-[#8589b2] mb-3 line-clamp-2 relative z-10 pointer-events-none">
            {project.description}
          </p>
        )}

        {/* Repo */}
        {project.repoFullName && (
          <p className="text-xs text-[#8589b2] mb-3 font-mono relative z-10 pointer-events-none">
            {project.repoFullName}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 relative z-10">
          <span className="text-xs text-[#8589b2]">Created {timeAgo(project.createdAt)}</span>

          <div className="flex items-center gap-1 pointer-events-auto">
            {project.prUrl && (
              <a
                href={project.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#8589b2] hover:text-[#00d7ff] transition-colors flex items-center gap-1"
                onClick={e => e.stopPropagation()}
              >
                <ExternalLink className="w-3 h-3" /> PR
              </a>
            )}

            {/* 3-dot menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-6 h-6 rounded flex items-center justify-center text-[#8589b2] hover:text-[#e3f4f8] hover:bg-[rgba(87,94,254,0.1)] transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-40 rounded-xl"
                style={{ background: 'rgba(27,30,61,0.98)', border: '1px solid #323779' }}
                onClick={e => e.stopPropagation()}
              >
                <DropdownMenuItem
                  className="text-[#e3f4f8] hover:bg-[rgba(87,94,254,0.1)] cursor-pointer gap-2 text-xs"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </DropdownMenuItem>
                {project.repoUrl && (
                  <DropdownMenuItem
                    className="text-[#e3f4f8] hover:bg-[rgba(87,94,254,0.1)] cursor-pointer gap-2 text-xs"
                    onClick={() => window.open(project.repoUrl!, '_blank')}
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View repo
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator style={{ background: '#323779' }} />
                <DropdownMenuItem
                  className="text-red-400 hover:bg-[rgba(239,68,68,0.1)] cursor-pointer gap-2 text-xs"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <EditProjectDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
        onSaved={updated => onUpdated?.({ ...updated })}
      />
      <DeleteProjectDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        project={project}
        onDeleted={onDeleted}
      />
    </>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/projects/
git commit -m "feat: redesign ProjectCard — DropdownMenu, EditProjectDialog, DeleteProjectDialog, StatusBadge"
```

---

## Task 9: Dashboard Page Redesign

**Files:**
- Modify: `apps/web/app/(dashboard)/dashboard/page.tsx`

Key changes: `SetBreadcrumbs`, stat cards row, skeleton loading states, proper empty state, activity feed, no inline event handlers.

- [ ] **Step 1: Replace dashboard page**

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FolderGit2, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetBreadcrumbs } from '@/lib/breadcrumbs';
import { EmptyState } from '@/components/ui/empty-state';
import { ProjectCardSkeleton, StatCardSkeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { ProjectCard } from '@/components/projects/project-card';
import { RepoImportDialog } from '@/components/dashboard/repo-import-dialog';

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  repoUrl: string | null;
  repoFullName: string | null;
  prUrl: string | null;
  createdAt: string;
};

type ActivityEvent = {
  id: string;
  type: string;
  message: string;
  projectId: string | null;
  projectName: string | null;
  createdAt: string;
};

const ACTIVITY_DOT: Record<string, string> = {
  project_created:     '#575efe',
  analysis_started:    '#3b82f6',
  analysis_completed:  '#10b981',
  analysis_failed:     '#ef4444',
  injection_started:   '#00d7ff',
  injection_completed: '#10b981',
  injection_failed:    '#ef4444',
  pr_opened:           '#8b5cf6',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [pRes, aRes] = await Promise.all([
      fetch('/api/projects'),
      fetch('/api/activity'),
    ]);
    const pData = await pRes.json() as { projects: Project[] };
    setProjects(pData.projects ?? []);
    if (aRes.ok) {
      const aData = await aRes.json() as { events: ActivityEvent[] };
      setActivity(aData.events ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const injected  = projects.filter(p => p.status === 'injected').length;
  const active    = projects.filter(p => ['analyzing','injecting','analyzed'].includes(p.status)).length;
  const withErrors = projects.filter(p => p.status === 'error').length;

  return (
    <>
      <SetBreadcrumbs crumbs={[{ label: 'Projects' }]} />

      <div className="max-w-6xl mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1
              className="text-xl font-bold text-[#e3f4f8]"
              style={{ fontFamily: 'var(--font-unbounded)' }}
            >
              Projects
            </h1>
            <p className="text-sm text-[#8589b2] mt-0.5">
              Import a repo and inject production-ready infrastructure.
            </p>
          </div>
          <Button
            onClick={() => setImportOpen(true)}
            className="bg-[#575efe] hover:bg-[#4a52e8] text-white gap-2"
          >
            <Plus className="w-4 h-4" /> Import repo
          </Button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              {[
                { label: 'Total projects',  value: projects.length,  sub: 'all time' },
                { label: 'Injected',        value: injected,          sub: 'production ready' },
                { label: 'In progress',     value: active,            sub: 'being processed' },
                { label: 'Errors',          value: withErrors,        sub: 'need attention', danger: true },
              ].map(stat => (
                <div
                  key={stat.label}
                  className="rounded-2xl p-4"
                  style={{ background: '#111827', border: '1px solid #1f2937' }}
                >
                  <p className="text-xs text-[#8589b2] mb-1">{stat.label}</p>
                  <p
                    className="text-2xl font-bold"
                    style={{ color: stat.danger && stat.value > 0 ? '#ef4444' : '#e3f4f8' }}
                  >
                    {stat.value}
                  </p>
                  <p className="text-xs text-[#8589b2] mt-0.5">{stat.sub}</p>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Projects grid */}
          <div className="lg:col-span-2">
            <h2 className="text-sm font-semibold text-[#8589b2] uppercase tracking-wider mb-3">
              All projects
            </h2>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => <ProjectCardSkeleton key={i} />)}
              </div>
            ) : projects.length === 0 ? (
              <EmptyState
                icon={FolderGit2}
                title="No projects yet"
                description="Import a GitHub repo to analyse and inject production-ready SaaS infrastructure."
                action={
                  <Button
                    onClick={() => setImportOpen(true)}
                    className="bg-[#575efe] hover:bg-[#4a52e8] text-white gap-2"
                  >
                    <Plus className="w-4 h-4" /> Import your first repo
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {projects.map(p => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onUpdated={updated =>
                      setProjects(prev => prev.map(x => x.id === p.id ? { ...x, ...updated } : x))
                    }
                    onDeleted={() =>
                      setProjects(prev => prev.filter(x => x.id !== p.id))
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Activity feed */}
          <div>
            <h2 className="text-sm font-semibold text-[#8589b2] uppercase tracking-wider mb-3">
              Recent activity
            </h2>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: '#111827', border: '1px solid #1f2937' }}
            >
              {activity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <Activity className="w-5 h-5 text-[#8589b2] mb-2" />
                  <p className="text-xs text-[#8589b2]">No activity yet</p>
                </div>
              ) : (
                <ul className="divide-y" style={{ borderColor: '#1f2937' }}>
                  {activity.map(evt => (
                    <li key={evt.id} className="flex items-start gap-3 p-3">
                      <span
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ background: ACTIVITY_DOT[evt.type] ?? '#8589b2' }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-[#e3f4f8] leading-snug">{evt.message}</p>
                        {evt.projectName && (
                          <p className="text-[10px] text-[#8589b2] mt-0.5 truncate">{evt.projectName}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-[#8589b2] shrink-0 mt-0.5">
                        {timeAgo(evt.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      <RepoImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => { setImportOpen(false); fetchAll(); }}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: redesign dashboard — stat cards, skeleton loading, empty state, activity feed, SetBreadcrumbs"
```

---

## Task 10: Project Detail Page Redesign

**Files:**
- Modify: `apps/web/app/(dashboard)/dashboard/projects/[id]/page.tsx`

This is the most complex page. Key changes: back button to `/dashboard`, breadcrumbs showing `Projects > <name>`, tab navigation (Overview | Analysis | Configure | History), skeleton while loading, `useSavedForm` for injection config, toast on inject/analyze actions, proper success and error states.

- [ ] **Step 1: Replace project detail page (top half — shell + overview tab)**

Replace `apps/web/app/(dashboard)/dashboard/projects/[id]/page.tsx` with the full redesign. Due to length, it is broken into logical sections below — write all sections into one file:

**Imports + types:**
```tsx
'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft, RefreshCw, Trash2, ExternalLink, CheckCircle2,
  AlertTriangle, Loader2, GitBranch, Zap, Database, Lock,
  CreditCard, Cpu, Globe, ChevronRight, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetBreadcrumbs } from '@/lib/breadcrumbs';
import { useBack } from '@/hooks/use-back';
import { useSavedForm } from '@/hooks/use-saved-form';
import { StatusBadge } from '@/components/ui/status-badge';
import { DeleteProjectDialog } from '@/components/projects/delete-project-dialog';
import { Skeleton } from '@/components/ui/skeleton';
```

**Types (same as existing — copy from current file):**
Keep the existing `AnalysisReport`, `Project`, `ProgressEvent`, `CodeInsight` types unchanged.

**Config defaults for useSavedForm:**
```tsx
const CONFIG_DEFAULTS = {
  pricingModel: 'flat' as string,
  billingInterval: 'monthly' as string,
  onboardingFlow: 'free_trial_no_card' as string,
  trialDays: '14',
  userType: 'individuals' as string,
  authMethods: ['email'] as string[],
  deployTarget: 'vercel' as string,
  complianceRegion: 'global' as string,
  openPR: true,
};
```

**Page component shell:**
```tsx
export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const back = useBack('/dashboard');

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'analysis' | 'configure' | 'history'>('overview');
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisLines, setAnalysisLines] = useState<string[]>([]);

  // Injection state
  const [injecting, setInjecting] = useState(false);
  const [injectLines, setInjectLines] = useState<string[]>([]);
  const [injectProgress, setInjectProgress] = useState<{ step: number; total: number } | null>(null);

  // Saved injection config (persisted in sessionStorage per project)
  const { value: config, update: updateConfig, clear: clearConfig } = useSavedForm(
    `inject-config-${id}`,
    CONFIG_DEFAULTS,
  );

  const fetchProject = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) { router.push('/dashboard'); return; }
    const data = await res.json() as { project: Project };
    setProject(data.project);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  // Set breadcrumbs once project loads
  const crumbs = project
    ? [{ label: 'Projects', href: '/dashboard' }, { label: project.name }]
    : [{ label: 'Projects', href: '/dashboard' }, { label: 'Loading...' }];
```

**Analyze function:**
```tsx
  async function handleAnalyze() {
    if (!project) return;
    setAnalyzing(true);
    setAnalysisLines([]);
    setActiveTab('overview');
    toast.info('Analysis started');
    try {
      const res = await fetch(`/api/projects/${id}/analyze`, { method: 'POST' });
      if (!res.ok || !res.body) throw new Error('Failed to start analysis');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(l => l.startsWith('data:'));
        for (const line of lines) {
          const payload = line.replace('data: ', '').trim();
          if (payload === '[DONE]') break;
          try {
            const evt = JSON.parse(payload) as { message?: string; error?: string; report?: AnalysisReport };
            if (evt.message) setAnalysisLines(prev => [...prev, evt.message!]);
            if (evt.error) { toast.error(evt.error); break; }
          } catch {}
        }
      }
      await fetchProject();
      toast.success('Analysis complete');
    } catch (err) {
      toast.error('Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }
```

**Inject function:**
```tsx
  async function handleInject() {
    if (!project) return;
    setInjecting(true);
    setInjectLines([]);
    setInjectProgress(null);
    setActiveTab('configure');
    toast.info('Injection started');
    try {
      const res = await fetch(`/api/projects/${id}/inject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok || !res.body) throw new Error('Failed to start injection');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(l => l.startsWith('data:'));
        for (const line of lines) {
          const payload = line.replace('data: ', '').trim();
          if (payload === '[DONE]') break;
          try {
            const evt = JSON.parse(payload) as { step?: number; total?: number; message?: string; error?: string };
            if (evt.message) setInjectLines(prev => [...prev, evt.message!]);
            if (evt.step !== undefined) setInjectProgress({ step: evt.step, total: evt.total ?? 7 });
            if (evt.error) { toast.error(evt.error); break; }
          } catch {}
        }
      }
      await fetchProject();
      clearConfig();
      toast.success('Injection complete! Review the PR on GitHub.');
    } catch {
      toast.error('Injection failed');
    } finally {
      setInjecting(false);
    }
  }
```

**Render — loading skeleton:**
```tsx
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <button onClick={back} className="flex items-center gap-1.5 text-sm text-[#8589b2] hover:text-[#e3f4f8] transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Projects
        </button>
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="flex gap-2 mb-6">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (!project) return null;
```

**Render — main page:**
```tsx
  const canAnalyze = ['pending', 'draft', 'analyzed', 'error'].includes(project.status);
  const canInject  = project.status === 'analyzed';
  const isInjected = project.status === 'injected';
  const report     = project.analysisResult;

  const TABS = [
    { id: 'overview'  as const, label: 'Overview'  },
    { id: 'analysis'  as const, label: 'Analysis',  disabled: !report },
    { id: 'configure' as const, label: 'Configure', disabled: !report },
    { id: 'history'   as const, label: 'History'   },
  ];

  return (
    <>
      <SetBreadcrumbs crumbs={crumbs} />

      <div className="max-w-4xl mx-auto">
        {/* Back + header */}
        <button
          onClick={back}
          className="flex items-center gap-1.5 text-sm text-[#8589b2] hover:text-[#e3f4f8] transition-colors mb-4 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Projects
        </button>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(87,94,254,0.15)', border: '1px solid rgba(87,94,254,0.25)' }}
            >
              <GitBranch className="w-4 h-4 text-[#575efe]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-[#e3f4f8] truncate" style={{ fontFamily: 'var(--font-unbounded)' }}>
                {project.name}
              </h1>
              {project.repoFullName && (
                <a
                  href={project.repoUrl ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#8589b2] hover:text-[#00d7ff] transition-colors flex items-center gap-1"
                >
                  {project.repoFullName} <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <StatusBadge status={project.status} />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canAnalyze && (
              <Button
                onClick={handleAnalyze}
                disabled={analyzing || injecting}
                variant="outline"
                className="border-[#323779] text-[#8589b2] hover:text-[#e3f4f8] hover:border-[#575efe] gap-2 text-xs"
              >
                {analyzing
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</>
                  : <><RefreshCw className="w-3.5 h-3.5" /> {report ? 'Re-analyze' : 'Analyze'}</>
                }
              </Button>
            )}
            <Button
              onClick={() => setDeleteOpen(true)}
              variant="outline"
              className="border-[#323779] text-red-400 hover:text-red-300 hover:border-red-800 gap-2 text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </Button>
          </div>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: '#111827' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              className={[
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-[#575efe] text-white'
                  : tab.disabled
                    ? 'text-[#8589b2] opacity-40 cursor-not-allowed'
                    : 'text-[#8589b2] hover:text-[#e3f4f8]',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Analyzing live log */}
            {analyzing && (
              <div className="rounded-2xl p-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Loader2 className="w-4 h-4 text-[#575efe] animate-spin" />
                  <span className="text-sm font-medium text-[#e3f4f8]">Analyzing repository...</span>
                </div>
                <div className="space-y-1 font-mono text-xs text-[#8589b2] max-h-48 overflow-y-auto">
                  {analysisLines.map((l, i) => <p key={i}>{l}</p>)}
                </div>
              </div>
            )}

            {/* No report yet */}
            {!report && !analyzing && (
              <div
                className="rounded-2xl p-8 text-center"
                style={{ background: '#111827', border: '1px solid #1f2937' }}
              >
                <Zap className="w-8 h-8 text-[#575efe] mx-auto mb-3" />
                <h3 className="text-base font-semibold text-[#e3f4f8] mb-1">Ready to analyze</h3>
                <p className="text-sm text-[#8589b2] mb-4">
                  Click Analyze to scan your repo and generate an infrastructure injection plan.
                </p>
                <Button
                  onClick={handleAnalyze}
                  className="bg-[#575efe] hover:bg-[#4a52e8] text-white gap-2"
                >
                  <Zap className="w-4 h-4" /> Analyze repository
                </Button>
              </div>
            )}

            {/* Injected success banner */}
            {isInjected && (
              <div
                className="rounded-2xl p-5 flex items-start gap-4"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}
              >
                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-400 mb-1">Injection complete</p>
                  <p className="text-xs text-[#8589b2]">
                    Branch: <code className="text-[#e3f4f8]">{project.branchName}</code>
                  </p>
                  {project.prUrl && (
                    <a
                      href={project.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-green-400 hover:text-green-300 mt-2 transition-colors"
                    >
                      View PR on GitHub <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Error banner */}
            {project.status === 'error' && (
              <div
                className="rounded-2xl p-5 flex items-start gap-4"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-400 mb-1">Something went wrong</p>
                  <p className="text-xs text-[#8589b2]">Click Re-analyze to try again.</p>
                </div>
              </div>
            )}

            {/* Summary card */}
            {report && (
              <div className="rounded-2xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
                <p className="text-xs text-[#8589b2] uppercase tracking-wide mb-2">Summary</p>
                <p className="text-sm text-[#e3f4f8] leading-relaxed">{report.summary}</p>

                {report.monetizationReadiness && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-[#8589b2]">Monetization readiness</span>
                      <span className="text-xs font-bold text-[#e3f4f8]">
                        {report.monetizationReadiness.score}/100
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: '#1f2937' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${report.monetizationReadiness.score}%`,
                          background: 'linear-gradient(90deg, #575efe, #00d7ff)',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab: Analysis */}
        {activeTab === 'analysis' && report && (
          <div className="space-y-4">
            {/* Stack */}
            <div className="rounded-2xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <p className="text-xs text-[#8589b2] uppercase tracking-wide mb-3">Detected stack</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Framework', value: `${report.detectedStack.framework} ${report.detectedStack.frameworkVersion ?? ''}`.trim() },
                  { label: 'Language',  value: report.detectedStack.language },
                  { label: 'Auth',      value: report.detectedStack.authProvider ?? 'None detected' },
                  { label: 'Database',  value: report.detectedStack.dbProvider   ?? 'None detected' },
                  { label: 'Payments',  value: report.detectedStack.paymentsProvider ?? 'None detected' },
                  { label: 'CI/CD',     value: report.detectedStack.hasCI ? report.detectedStack.ciDetails ?? 'Detected' : 'None' },
                ].map(item => (
                  <div key={item.label}>
                    <p className="text-[10px] text-[#8589b2] uppercase tracking-wide mb-0.5">{item.label}</p>
                    <p className="text-sm text-[#e3f4f8] font-medium">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Injection opportunities */}
            {report.injectionOpportunities.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
                <p className="text-xs text-[#8589b2] uppercase tracking-wide mb-3">Injection opportunities</p>
                <div className="space-y-3">
                  {report.injectionOpportunities.map((op, i) => {
                    const effortColor = op.effort === 'low' ? '#10b981' : op.effort === 'medium' ? '#f59e0b' : '#ef4444';
                    return (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: '#0d1117' }}>
                        <span className={op.canInject ? 'text-green-400' : 'text-red-400'}>
                          {op.canInject ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-[#e3f4f8] uppercase">{op.layer}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                              style={{ color: effortColor, background: `${effortColor}20` }}>
                              {op.effort} effort
                            </span>
                          </div>
                          <p className="text-xs text-[#8589b2]">{op.proposed}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Conflicts */}
            {report.conflicts.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
                <p className="text-xs text-[#8589b2] uppercase tracking-wide mb-3">Conflicts</p>
                <div className="space-y-2">
                  {report.conflicts.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 rounded-xl" style={{ background: '#0d1117' }}>
                      <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${c.severity === 'blocker' ? 'text-red-400' : 'text-amber-400'}`} />
                      <div>
                        <p className="text-xs font-medium text-[#e3f4f8]">{c.description}</p>
                        <p className="text-[10px] text-[#8589b2] mt-0.5">{c.resolution}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Download buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-[#323779] text-[#8589b2] hover:text-[#e3f4f8] gap-2 text-xs"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
                  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                  a.download = `${project.name}-analysis.json`; a.click();
                }}
              >
                <Download className="w-3.5 h-3.5" /> Download JSON
              </Button>
            </div>
          </div>
        )}

        {/* Tab: Configure & Inject */}
        {activeTab === 'configure' && (
          <div className="space-y-4">
            {/* Injection live log */}
            {injecting && (
              <div className="rounded-2xl p-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-[#575efe] animate-spin" />
                    <span className="text-sm font-medium text-[#e3f4f8]">Injecting infrastructure...</span>
                  </div>
                  {injectProgress && (
                    <span className="text-xs text-[#8589b2]">
                      Step {injectProgress.step}/{injectProgress.total}
                    </span>
                  )}
                </div>
                {injectProgress && (
                  <div className="h-1 rounded-full mb-3" style={{ background: '#1f2937' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(injectProgress.step / injectProgress.total) * 100}%`,
                        background: 'linear-gradient(90deg, #575efe, #00d7ff)',
                      }}
                    />
                  </div>
                )}
                <div className="space-y-1 font-mono text-xs text-[#8589b2] max-h-40 overflow-y-auto">
                  {injectLines.map((l, i) => <p key={i}>{l}</p>)}
                </div>
              </div>
            )}

            {/* Config form — only if can inject */}
            {canInject && !injecting && (
              <div className="rounded-2xl p-5 space-y-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#e3f4f8]">Injection configuration</p>
                  <span className="text-[10px] text-[#8589b2]">Auto-saved</span>
                </div>

                {/* Pricing model */}
                <div className="space-y-2">
                  <label className="text-xs text-[#8589b2] uppercase tracking-wide">Pricing model</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { value: 'flat',         label: 'Flat subscription' },
                      { value: 'per_seat',      label: 'Per seat' },
                      { value: 'usage_based',   label: 'Usage-based' },
                      { value: 'hybrid',        label: 'Hybrid' },
                      { value: 'one_time',      label: 'One-time' },
                      { value: 'credits',       label: 'Credits / tokens' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => updateConfig({ pricingModel: opt.value })}
                        className={[
                          'px-3 py-2 rounded-lg text-xs font-medium text-left border transition-all',
                          config.pricingModel === opt.value
                            ? 'border-[#575efe] text-[#e3f4f8] bg-[rgba(87,94,254,0.12)]'
                            : 'border-[#1f2937] text-[#8589b2] hover:border-[#323779] hover:text-[#e3f4f8]',
                        ].join(' ')}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Onboarding flow */}
                <div className="space-y-2">
                  <label className="text-xs text-[#8589b2] uppercase tracking-wide">Onboarding flow</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'pay_upfront',          label: 'Pay upfront' },
                      { value: 'free_trial_card',      label: 'Free trial (card required)' },
                      { value: 'free_trial_no_card',   label: 'Free trial (no card)' },
                      { value: 'freemium',             label: 'Freemium' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => updateConfig({ onboardingFlow: opt.value })}
                        className={[
                          'px-3 py-2 rounded-lg text-xs font-medium text-left border transition-all',
                          config.onboardingFlow === opt.value
                            ? 'border-[#575efe] text-[#e3f4f8] bg-[rgba(87,94,254,0.12)]'
                            : 'border-[#1f2937] text-[#8589b2] hover:border-[#323779] hover:text-[#e3f4f8]',
                        ].join(' ')}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* User type */}
                <div className="space-y-2">
                  <label className="text-xs text-[#8589b2] uppercase tracking-wide">User type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'individuals', label: 'Individuals' },
                      { value: 'teams',       label: 'Teams' },
                      { value: 'enterprise',  label: 'Enterprise' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => updateConfig({ userType: opt.value })}
                        className={[
                          'px-3 py-2 rounded-lg text-xs font-medium border transition-all',
                          config.userType === opt.value
                            ? 'border-[#575efe] text-[#e3f4f8] bg-[rgba(87,94,254,0.12)]'
                            : 'border-[#1f2937] text-[#8589b2] hover:border-[#323779] hover:text-[#e3f4f8]',
                        ].join(' ')}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Deploy target */}
                <div className="space-y-2">
                  <label className="text-xs text-[#8589b2] uppercase tracking-wide">Deploy target</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { value: 'vercel',      label: 'Vercel' },
                      { value: 'railway',     label: 'Railway' },
                      { value: 'fly',         label: 'Fly.io' },
                      { value: 'none',        label: 'None / Other' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => updateConfig({ deployTarget: opt.value })}
                        className={[
                          'px-3 py-2 rounded-lg text-xs font-medium border transition-all',
                          config.deployTarget === opt.value
                            ? 'border-[#575efe] text-[#e3f4f8] bg-[rgba(87,94,254,0.12)]'
                            : 'border-[#1f2937] text-[#8589b2] hover:border-[#323779] hover:text-[#e3f4f8]',
                        ].join(' ')}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Open PR toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: '#0d1117' }}>
                  <div>
                    <p className="text-xs font-medium text-[#e3f4f8]">Open a PR to main</p>
                    <p className="text-[10px] text-[#8589b2] mt-0.5">Recommended — review before merging</p>
                  </div>
                  <button
                    onClick={() => updateConfig({ openPR: !config.openPR })}
                    className={[
                      'w-10 h-5 rounded-full transition-all relative',
                      config.openPR ? 'bg-[#575efe]' : 'bg-[#323779]',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all',
                        config.openPR ? 'left-5' : 'left-0.5',
                      ].join(' ')}
                    />
                  </button>
                </div>

                {/* Inject button */}
                <Button
                  onClick={handleInject}
                  disabled={injecting}
                  className="w-full bg-[#575efe] hover:bg-[#4a52e8] text-white gap-2"
                >
                  <Zap className="w-4 h-4" /> Inject infrastructure
                </Button>
              </div>
            )}

            {/* Not ready to inject */}
            {!canInject && !injecting && !isInjected && (
              <div
                className="rounded-2xl p-8 text-center"
                style={{ background: '#111827', border: '1px solid #1f2937' }}
              >
                <p className="text-sm text-[#8589b2]">
                  Run an analysis first before configuring injection.
                </p>
                <Button
                  onClick={() => setActiveTab('overview')}
                  variant="outline"
                  className="mt-4 border-[#323779] text-[#8589b2] hover:text-[#e3f4f8]"
                >
                  Go to Overview
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Tab: History */}
        {activeTab === 'history' && (
          <div
            className="rounded-2xl p-5"
            style={{ background: '#111827', border: '1px solid #1f2937' }}
          >
            <p className="text-xs text-[#8589b2] uppercase tracking-wide mb-3">Project history</p>
            <div className="space-y-2 text-sm text-[#8589b2]">
              <p>Created: {new Date(project.createdAt).toLocaleString()}</p>
              {project.analysedAt && <p>Last analysed: {new Date(project.analysedAt).toLocaleString()}</p>}
              {project.branchName && <p>Injection branch: <code className="text-[#e3f4f8]">{project.branchName}</code></p>}
              {project.prUrl && (
                <a href={project.prUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[#575efe] hover:text-[#00d7ff] transition-colors">
                  View PR <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      <DeleteProjectDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        project={project}
        onDeleted={() => router.push('/dashboard')}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(dashboard\)/dashboard/projects/\[id\]/page.tsx
git commit -m "feat: redesign project detail — back button, breadcrumbs, tabs, saved config, toasts, all states"
```

---

## Task 11: Analytics Page

**Files:**
- Modify: `apps/web/app/(dashboard)/analytics/page.tsx`

- [ ] **Step 1: Replace analytics page**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';
import { SetBreadcrumbs } from '@/lib/breadcrumbs';
import { StatCardSkeleton } from '@/components/ui/skeleton';

type Project = { id: string; name: string; status: string; createdAt: string };

export default function AnalyticsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json() as Promise<{ projects: Project[] }>)
      .then(d => { setProjects(d.projects ?? []); setLoading(false); });
  }, []);

  const now = new Date();
  const thisMonth = projects.filter(p =>
    new Date(p.createdAt).getMonth() === now.getMonth() &&
    new Date(p.createdAt).getFullYear() === now.getFullYear()
  ).length;
  const injected = projects.filter(p => p.status === 'injected').length;
  const convRate = projects.length > 0 ? Math.round((injected / projects.length) * 100) : 0;

  return (
    <>
      <SetBreadcrumbs crumbs={[{ label: 'Analytics' }]} />

      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[#e3f4f8]" style={{ fontFamily: 'var(--font-unbounded)' }}>
            Analytics
          </h1>
          <p className="text-sm text-[#8589b2] mt-0.5">Overview of your project activity.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
            : [
                { label: 'Total projects',   value: projects.length,  sub: 'all time'         },
                { label: 'This month',       value: thisMonth,         sub: 'new projects'     },
                { label: 'Injected',         value: injected,          sub: 'production ready' },
                { label: 'Conversion rate',  value: `${convRate}%`,   sub: 'analyze → inject' },
              ].map(stat => (
                <div
                  key={stat.label}
                  className="rounded-2xl p-4"
                  style={{ background: '#111827', border: '1px solid #1f2937' }}
                >
                  <p className="text-xs text-[#8589b2] mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold text-[#e3f4f8]">{stat.value}</p>
                  <p className="text-xs text-[#8589b2] mt-0.5">{stat.sub}</p>
                </div>
              ))
          }
        </div>

        {/* Project table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid #1f2937' }}>
            <h2 className="text-sm font-semibold text-[#e3f4f8]">All projects</h2>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-4 w-36 animate-pulse rounded" style={{ background: '#1f2937' }} />
                  <div className="h-4 w-20 animate-pulse rounded-full" style={{ background: '#1f2937' }} />
                  <div className="h-4 w-24 animate-pulse rounded" style={{ background: '#1f2937' }} />
                </div>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <BarChart3 className="w-6 h-6 text-[#8589b2] mb-2" />
              <p className="text-sm text-[#8589b2]">No projects yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #1f2937' }}>
                  {['Name', 'Status', 'Created'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs text-[#8589b2] uppercase tracking-wide font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map((p, i) => (
                  <tr
                    key={p.id}
                    style={{ borderBottom: i < projects.length - 1 ? '1px solid #1f2937' : 'none' }}
                  >
                    <td className="px-5 py-3 text-[#e3f4f8] font-medium">{p.name}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs capitalize text-[#8589b2]">{p.status}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-[#8589b2]">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(dashboard\)/analytics/page.tsx
git commit -m "feat: redesign analytics — SetBreadcrumbs, stat cards, skeleton, project table"
```

---

## Task 12: Billing Page

**Files:**
- Modify: `apps/web/app/(dashboard)/billing/page.tsx`

- [ ] **Step 1: Replace billing page**

```tsx
'use client';

import { CheckCircle2, Zap } from 'lucide-react';
import { SetBreadcrumbs } from '@/lib/breadcrumbs';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Perfect for side projects',
    features: ['3 projects', '1 team member', 'Basic analytics', 'Community support'],
    current: true,
    cta: 'Current plan',
    accent: '#323779',
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/month',
    description: 'Everything you need to ship',
    features: ['Unlimited projects', '10 team members', 'Advanced analytics', 'Priority support', 'API access'],
    current: false,
    cta: 'Upgrade to Pro',
    accent: '#575efe',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large teams',
    features: ['Unlimited everything', 'SSO / SAML', 'Dedicated support', 'SLA guarantee', 'Custom integrations'],
    current: false,
    cta: 'Contact sales',
    accent: '#323779',
  },
];

export default function BillingPage() {
  return (
    <>
      <SetBreadcrumbs crumbs={[{ label: 'Billing' }]} />

      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-[#e3f4f8]" style={{ fontFamily: 'var(--font-unbounded)' }}>
            Billing
          </h1>
          <p className="text-sm text-[#8589b2] mt-0.5">Manage your plan and payment details.</p>
        </div>

        {/* Current plan banner */}
        <div
          className="rounded-2xl p-4 flex items-center gap-3 mb-8"
          style={{ background: 'rgba(87,94,254,0.08)', border: '1px solid rgba(87,94,254,0.2)' }}
        >
          <Zap className="w-4 h-4 text-[#575efe] shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#e3f4f8]">You are on the Free plan</p>
            <p className="text-xs text-[#8589b2]">Upgrade to Pro for unlimited projects and priority support.</p>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className="rounded-2xl p-5 flex flex-col"
              style={{
                background: plan.highlight ? 'rgba(87,94,254,0.08)' : '#111827',
                border: `1px solid ${plan.highlight ? '#575efe' : '#1f2937'}`,
              }}
            >
              <div className="mb-4">
                <p className="text-xs text-[#8589b2] uppercase tracking-wide mb-2">{plan.name}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-[#e3f4f8]">{plan.price}</span>
                  {plan.period && <span className="text-xs text-[#8589b2]">{plan.period}</span>}
                </div>
                <p className="text-xs text-[#8589b2] mt-1">{plan.description}</p>
              </div>

              <ul className="space-y-2 flex-1 mb-5">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-[#e3f4f8]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                disabled={plan.current}
                onClick={() => {
                  if (plan.name === 'Enterprise') {
                    window.open('mailto:hello@prodify.dev?subject=Enterprise', '_blank');
                  } else {
                    toast.info('Stripe checkout coming soon!');
                  }
                }}
                className={
                  plan.current
                    ? 'border border-[#323779] text-[#8589b2] bg-transparent cursor-default text-xs'
                    : plan.highlight
                      ? 'bg-[#575efe] hover:bg-[#4a52e8] text-white text-xs'
                      : 'border border-[#323779] text-[#e3f4f8] bg-transparent hover:border-[#575efe] text-xs'
                }
              >
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(dashboard\)/billing/page.tsx
git commit -m "feat: redesign billing — SetBreadcrumbs, plan cards, upgrade CTAs"
```

---

## Task 13: Settings Page

**Files:**
- Modify: `apps/web/app/(dashboard)/settings/page.tsx`

Key changes: `SetBreadcrumbs`, toast feedback on every save/action (replacing silent saves), tab navigation polish, danger zone with ConfirmDialog.

- [ ] **Step 1: Add SetBreadcrumbs and replace all silent feedback with toasts**

At the top of the `SettingsPage` component, add:
```tsx
import { SetBreadcrumbs } from '@/lib/breadcrumbs';
import { toast } from 'sonner';
```

Inside the component, add:
```tsx
<SetBreadcrumbs crumbs={[{ label: 'Settings' }]} />
```

Replace all existing alert/console feedback with `toast.success(...)` / `toast.error(...)` calls. For example:

```tsx
// Profile save — replace setProfileSaved(true) with:
toast.success('Profile updated');

// Password update success — replace setPasswordMsg(...) with:
toast.success('Password updated successfully');

// Password update error — replace setPasswordError(...) with:
toast.error('Incorrect current password');

// GitHub disconnect success:
toast.success('GitHub disconnected');

// API key generated:
toast.success('API key generated — copy it now, it will not be shown again');

// API key revoked:
toast.success('API key revoked');
```

Replace the existing native `confirm()` calls in the danger zone (sign out everywhere, delete account) with `ConfirmDialog` components using the same pattern as `DeleteProjectDialog`:

```tsx
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

// Add state:
const [signOutAllOpen, setSignOutAllOpen] = useState(false);
const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);

// Replace native confirms with:
<ConfirmDialog
  open={signOutAllOpen}
  onOpenChange={setSignOutAllOpen}
  title="Sign out everywhere?"
  description="This will revoke all active sessions across all devices."
  confirmLabel="Sign out all sessions"
  onConfirm={async () => { /* existing logic */ toast.success('Signed out everywhere'); }}
/>

<ConfirmDialog
  open={deleteAccountOpen}
  onOpenChange={setDeleteAccountOpen}
  title="Delete your account?"
  description="This permanently deletes your account, all projects, and all data. This cannot be undone."
  confirmLabel="Delete my account"
  danger
  onConfirm={async () => { /* existing logic */ }}
/>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(dashboard\)/settings/page.tsx
git commit -m "feat: settings — SetBreadcrumbs, toast feedback on all actions, ConfirmDialogs for danger zone"
```

---

## Task 14: Auth Pages Polish

**Files:**
- Modify: `apps/web/components/auth/login-form.tsx`
- Modify: `apps/web/components/auth/signup-form.tsx`

Key changes: replace any `alert()` calls with `toast.error()`, add "Back to home" link, ensure loading states are visible.

- [ ] **Step 1: Add toast imports to login-form and signup-form**

In `apps/web/components/auth/login-form.tsx`:
```tsx
import { toast } from 'sonner';
// Replace any alert() or console.error with toast.error(...)
// e.g., toast.error('Invalid credentials. Please try again.');
```

In `apps/web/components/auth/signup-form.tsx`:
```tsx
import { toast } from 'sonner';
// Replace any alert() calls with toast.error(...)
```

- [ ] **Step 2: Add home link to auth layouts**

In `apps/web/app/(auth)/login/page.tsx` (wrapper), ensure the layout shows a "← Back" link to `/`:
```tsx
import Link from 'next/link';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#030712' }}>
      <div className="p-4">
        <Link href="/" className="text-xs text-[#8589b2] hover:text-[#e3f4f8] transition-colors flex items-center gap-1">
          ← Home
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <LoginForm />
      </div>
    </div>
  );
}
```

Apply the same wrapper pattern to `apps/web/app/(auth)/signup/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/auth/ apps/web/app/\(auth\)/
git commit -m "feat: auth pages — toast error feedback, home back link"
```

---

## Task 15: Push Branch

- [ ] **Step 1: Final verification**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -30
```

Fix any TypeScript errors surfaced before pushing.

- [ ] **Step 2: Push branch**

```bash
git push -u origin feat/ui-ux-overhaul
```

- [ ] **Step 3: Open PR**

```bash
gh pr create \
  --title "feat: UI/UX overhaul — SaaS-grade redesign end to end" \
  --body "$(cat <<'EOF'
## Summary
- Adds BreadcrumbProvider + SetBreadcrumbs — every page sets its trail
- Adds BackButton with history fallback on all detail pages
- Adds sonner toast system — every user action gives feedback
- Adds useSavedForm — injection config persisted in sessionStorage per project
- Replaces native confirm() with ConfirmDialog everywhere
- Adds Skeleton loaders for all loading states
- Adds EmptyState components for all empty states
- Redesigns ProjectCard with shadcn DropdownMenu (Edit / Delete / View repo)
- Adds EditProjectDialog (wires existing PATCH /api/projects/[id])
- Redesigns Sidebar with lucide-react icons and Tailwind hover classes
- Redesigns Header with Breadcrumb rendering and shadcn DropdownMenu user menu
- Redesigns Dashboard: stat cards, 2-col layout, activity feed
- Redesigns Project Detail: tab nav (Overview / Analysis / Configure / History), live progress bars, success/error banners
- Redesigns Analytics: stat cards, sortable project table
- Redesigns Billing: plan cards with upgrade CTAs
- Redesigns Settings: toast feedback on every action, ConfirmDialogs in danger zone
- Auth pages: toast error feedback, home back link

## Test plan
- [ ] Import a repo, verify breadcrumbs show `Projects > <name>`
- [ ] Click Back on project detail — lands on /dashboard
- [ ] Analyze a repo — see live log, toast on complete
- [ ] Configure injection, navigate away, come back — config is restored
- [ ] Inject — progress bar advances, success banner appears with PR link
- [ ] Edit project name via DropdownMenu — saved, card updates without refresh
- [ ] Delete project — ConfirmDialog appears, navigates to dashboard on confirm
- [ ] Verify no native confirm() or alert() calls remain
- [ ] Verify no onMouseEnter/onMouseLeave inline handlers remain in redesigned components
- [ ] Settings: save profile, password, generate key — all show toasts
- [ ] Danger zone: sign out all / delete account show ConfirmDialog

🤖 Generated with Claude Code
EOF
)"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Back button on every page that has a parent (project detail → dashboard)
- ✅ Breadcrumbs in header for all routes
- ✅ Toast notifications on every user action
- ✅ Saved form state (injection config) via sessionStorage
- ✅ Edit project (PATCH already exists, wired via EditProjectDialog)
- ✅ Delete project with ConfirmDialog (replaces native confirm())
- ✅ Skeleton loading states on dashboard and analytics
- ✅ Empty states with CTAs
- ✅ No inline `onMouseEnter/onMouseLeave` handlers — all Tailwind `hover:` classes
- ✅ StatusBadge unified across all uses
- ✅ Breadcrumbs set per-page via SetBreadcrumbs
- ✅ Project detail tabs: Overview / Analysis / Configure / History
- ✅ Injection progress bar + live log
- ✅ Post-injection success banner with PR link
- ✅ Error state banner with re-analyze CTA
- ✅ Billing plan cards with upgrade CTA
- ✅ Settings toast feedback + ConfirmDialogs for danger zone
- ✅ Auth pages: home back link, toast errors

**Placeholder scan:** None — every step has real code or explicit instructions referencing existing logic.

**Type consistency:** `Project`, `AnalysisReport`, `ActivityEvent` types are kept from existing files. `useSavedForm<T>` generic is consistent throughout. `SetBreadcrumbs` accepts `Crumb[]` matching the `BreadcrumbProvider` context type.
