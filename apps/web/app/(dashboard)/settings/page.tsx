'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut, signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// ─── Schemas ────────────────────────────────────────────────────────────────

const profileSchema = z.object({ name: z.string().min(1, 'Name is required').max(64) });
type ProfileData = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword: z.string().min(6, 'At least 6 characters'),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
type PasswordData = z.infer<typeof passwordSchema>;

// ─── Types ───────────────────────────────────────────────────────────────────

type GitHubStatus = { connected: boolean; login?: string; avatar?: string };

type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt?: string | null;
  token?: string; // only present immediately after creation
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Section({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'accounts' | 'apikeys' | 'danger'>('profile');

  // Profile
  const [profileSaved, setProfileSaved] = useState(false);

  // Password
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // GitHub
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [newKeyToken, setNewKeyToken] = useState<string | null>(null);
  const [newKeyCopied, setNewKeyCopied] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Danger zone
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const initials = session?.user?.name?.slice(0, 2).toUpperCase() ?? 'U';

  // ── Forms ──────────────────────────────────────────────────────────────────

  const {
    register: regP,
    handleSubmit: hsP,
    formState: { errors: errP, isSubmitting: submP },
  } = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: session?.user?.name ?? '' },
  });

  const {
    register: regPw,
    handleSubmit: hsPw,
    reset: resetPw,
    formState: { errors: errPw, isSubmitting: submPw },
  } = useForm<PasswordData>({ resolver: zodResolver(passwordSchema) });

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchGithubStatus = useCallback(async () => {
    const res = await fetch('/api/github/status');
    if (res.ok) setGithubStatus(await res.json() as GitHubStatus);
  }, []);

  const fetchApiKeys = useCallback(async () => {
    setKeysLoading(true);
    const res = await fetch('/api/user/api-keys');
    if (res.ok) {
      const data = await res.json() as { keys: ApiKey[] };
      setApiKeys(data.keys);
    }
    setKeysLoading(false);
  }, []);

  useEffect(() => { void fetchGithubStatus(); }, [fetchGithubStatus]);
  useEffect(() => {
    if (activeTab === 'apikeys') void fetchApiKeys();
  }, [activeTab, fetchApiKeys]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function onProfileSubmit(data: ProfileData) {
    await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await update({ name: data.name });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  }

  async function onPasswordSubmit(data: PasswordData) {
    setPasswordMsg('');
    setPasswordError('');
    const res = await fetch('/api/user/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setPasswordMsg('Password updated successfully.');
      resetPw();
    } else {
      const j = await res.json() as { error?: string };
      setPasswordError(j.error ?? 'Failed to update password.');
    }
  }

  async function disconnectGitHub() {
    setDisconnecting(true);
    const res = await fetch('/api/github/disconnect', { method: 'DELETE' });
    if (res.ok) setGithubStatus({ connected: false });
    setDisconnecting(false);
  }

  async function generateApiKey() {
    setGeneratingKey(true);
    setKeyError('');
    setNewKeyToken(null);
    const res = await fetch('/api/user/api-keys', { method: 'POST' });
    const data = await res.json() as { key?: ApiKey; error?: string };
    if (!res.ok || !data.key) {
      setKeyError(data.error ?? 'Failed to generate key');
    } else {
      setNewKeyToken(data.key.token ?? null);
      setApiKeys(prev => [data.key!, ...prev]);
    }
    setGeneratingKey(false);
  }

  async function revokeKey(id: string) {
    setRevokingId(id);
    const res = await fetch(`/api/user/api-keys/${id}`, { method: 'DELETE' });
    if (res.ok) setApiKeys(prev => prev.filter(k => k.id !== id));
    setRevokingId(null);
  }

  async function copyToken(token: string) {
    await navigator.clipboard.writeText(token);
    setNewKeyCopied(true);
    setTimeout(() => setNewKeyCopied(false), 2000);
  }

  async function deleteAccount() {
    setDeleting(true);
    setDeleteError('');
    const res = await fetch('/api/user/delete', { method: 'DELETE' });
    if (res.ok) {
      await signOut({ callbackUrl: '/login' });
    } else {
      const j = await res.json() as { error?: string };
      setDeleteError(j.error ?? 'Failed to delete account.');
      setDeleting(false);
    }
  }

  // ── Tabs ───────────────────────────────────────────────────────────────────

  const TABS = [
    { key: 'profile',  label: 'Profile' },
    { key: 'password', label: 'Password' },
    { key: 'accounts', label: 'Connected Accounts' },
    { key: 'apikeys',  label: 'API Keys' },
    { key: 'danger',   label: 'Danger Zone' },
  ] as const;

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1
          className="text-2xl font-black"
          style={{ fontFamily: 'var(--font-unbounded)', color: '#e3f4f8' }}
        >
          Settings
        </h1>
        <p className="text-sm mt-1" style={{ color: '#8589b2' }}>Manage your account settings and preferences</p>
      </div>

      {/* Tab nav */}
      <div
        className="flex gap-1 mb-6 overflow-x-auto p-1 rounded-2xl"
        style={{ background: 'rgba(27,30,61,0.5)', border: '1px solid #1a1b2e' }}
      >
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 text-sm font-medium transition-all rounded-xl whitespace-nowrap"
            style={
              activeTab === tab.key
                ? { background: 'rgba(87,94,254,0.2)', color: '#e3f4f8', border: '1px solid rgba(87,94,254,0.3)' }
                : { color: '#8589b2', border: '1px solid transparent' }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <Section>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(27,30,61,0.5)', backdropFilter: 'blur(20px)', border: '1px solid #1a1b2e' }}
          >
            <div className="p-6" style={{ borderBottom: '1px solid #1a1b2e' }}>
              <h3 className="font-semibold" style={{ color: '#e3f4f8' }}>Profile</h3>
              <p className="text-sm mt-0.5" style={{ color: '#8589b2' }}>Update your public display information</p>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={session?.user?.image ?? undefined} />
                  <AvatarFallback
                    className="text-lg font-semibold"
                    style={{ background: 'linear-gradient(135deg, #575efe, #00d7ff)', color: '#ffffff' }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm" style={{ color: '#e3f4f8' }}>{session?.user?.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#8589b2' }}>{session?.user?.email}</p>
                  <p className="text-xs mt-1" style={{ color: '#8589b2' }}>Avatar is pulled from your OAuth provider</p>
                </div>
              </div>

              <form onSubmit={hsP(onProfileSubmit)} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#8589b2' }}>Display name</label>
                  <input
                    id="name"
                    {...regP('name')}
                    placeholder="Your name"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{ background: '#030712', border: '1px solid #323779', color: '#e3f4f8' }}
                    onFocus={e => (e.target.style.borderColor = '#575efe')}
                    onBlur={e => (e.target.style.borderColor = '#323779')}
                  />
                  {errP.name && <p className="text-xs mt-1" style={{ color: '#ff6b6b' }}>{errP.name.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#8589b2' }}>Email</label>
                  <input
                    id="email-ro"
                    value={session?.user?.email ?? ''}
                    disabled
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: 'rgba(3,7,18,0.5)', border: '1px solid #1a1b2e', color: '#8589b2', cursor: 'not-allowed' }}
                  />
                  <p className="text-xs mt-1" style={{ color: '#8589b2' }}>Email cannot be changed directly. Contact support.</p>
                </div>
                <button
                  type="submit"
                  disabled={submP}
                  className="py-2.5 px-5 rounded-full font-semibold text-sm transition-all duration-200 disabled:opacity-50"
                  style={{ background: '#575efe', color: '#ffffff', boxShadow: '0 0 20px rgba(87,94,254,0.4)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 32px rgba(87,94,254,0.6)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(87,94,254,0.4)'; }}
                >
                  {profileSaved ? '✓ Saved!' : submP ? 'Saving...' : 'Save changes'}
                </button>
              </form>
            </div>
          </div>
        </Section>
      )}

      {/* ── Password ────────────────────────────────────────────────────────── */}
      {activeTab === 'password' && (
        <Section>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(27,30,61,0.5)', backdropFilter: 'blur(20px)', border: '1px solid #1a1b2e' }}
          >
            <div className="p-6" style={{ borderBottom: '1px solid #1a1b2e' }}>
              <h3 className="font-semibold" style={{ color: '#e3f4f8' }}>Change Password</h3>
              <p className="text-sm mt-0.5" style={{ color: '#8589b2' }}>Update your account password.</p>
            </div>
            <div className="p-6">
              <form onSubmit={hsPw(onPasswordSubmit)} className="space-y-4">
                {(['currentPassword', 'newPassword', 'confirmPassword'] as const).map((field, idx) => {
                  const labels = ['Current password', 'New password', 'Confirm new password'];
                  const ids = ['current-pw', 'new-pw', 'confirm-pw'];
                  const err = errPw[field];
                  return (
                    <div key={field}>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: '#8589b2' }}>{labels[idx]}</label>
                      <input
                        id={ids[idx]}
                        type="password"
                        {...regPw(field)}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                        style={{ background: '#030712', border: '1px solid #323779', color: '#e3f4f8' }}
                        onFocus={e => (e.target.style.borderColor = '#575efe')}
                        onBlur={e => (e.target.style.borderColor = '#323779')}
                      />
                      {err && <p className="text-xs mt-1" style={{ color: '#ff6b6b' }}>{err.message}</p>}
                    </div>
                  );
                })}
                {passwordMsg && <p className="text-sm" style={{ color: '#10b981' }}>{passwordMsg}</p>}
                {passwordError && <p className="text-sm" style={{ color: '#ff6b6b' }}>{passwordError}</p>}
                <button
                  type="submit"
                  disabled={submPw}
                  className="py-2.5 px-5 rounded-full font-semibold text-sm transition-all duration-200 disabled:opacity-50"
                  style={{ background: '#575efe', color: '#ffffff', boxShadow: '0 0 20px rgba(87,94,254,0.4)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 32px rgba(87,94,254,0.6)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(87,94,254,0.4)'; }}
                >
                  {submPw ? 'Updating...' : 'Update password'}
                </button>
              </form>
            </div>
          </div>
        </Section>
      )}

      {/* ── Connected Accounts ──────────────────────────────────────────────── */}
      {activeTab === 'accounts' && (
        <Section>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(27,30,61,0.5)', backdropFilter: 'blur(20px)', border: '1px solid #1a1b2e' }}
          >
            <div className="p-6" style={{ borderBottom: '1px solid #1a1b2e' }}>
              <h3 className="font-semibold" style={{ color: '#e3f4f8' }}>Connected Accounts</h3>
              <p className="text-sm mt-0.5" style={{ color: '#8589b2' }}>Manage third-party integrations used by Prodify</p>
            </div>
            <div className="p-6 space-y-4">
              <div
                className="flex items-center justify-between p-4 rounded-xl"
                style={{ border: '1px solid #1a1b2e', background: 'rgba(3,7,18,0.3)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: '#0d1117' }}
                  >
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#e3f4f8' }}>GitHub</p>
                    {githubStatus?.connected && githubStatus.login ? (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {githubStatus.avatar && (
                          <img src={githubStatus.avatar} alt="" className="w-4 h-4 rounded-full" />
                        )}
                        <p className="text-xs" style={{ color: '#8589b2' }}>@{githubStatus.login}</p>
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#10b981' }} />
                        <span className="text-xs font-medium" style={{ color: '#10b981' }}>Connected</span>
                      </div>
                    ) : (
                      <p className="text-xs mt-0.5" style={{ color: '#8589b2' }}>Not connected</p>
                    )}
                  </div>
                </div>
                {githubStatus?.connected ? (
                  <button
                    disabled={disconnecting}
                    onClick={() => void disconnectGitHub()}
                    className="text-xs font-medium px-3 py-1.5 rounded-full transition-all disabled:opacity-50"
                    style={{ border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.15)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'; }}
                  >
                    {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </button>
                ) : (
                  <button
                    onClick={() => void signIn('github', { callbackUrl: '/settings' })}
                    className="text-xs font-medium px-3 py-1.5 rounded-full transition-all"
                    style={{ background: '#0d1117', color: '#e3f4f8', border: '1px solid #323779' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#575efe'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#323779'; }}
                  >
                    Connect GitHub
                  </button>
                )}
              </div>
              <p className="text-xs px-1" style={{ color: '#8589b2' }}>
                GitHub is used to import repos, clone them for analysis, push injection branches, and open pull requests. Disconnecting will not affect existing projects.
              </p>
            </div>
          </div>
        </Section>
      )}

      {/* ── API Keys ────────────────────────────────────────────────────────── */}
      {activeTab === 'apikeys' && (
        <Section>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(27,30,61,0.5)', backdropFilter: 'blur(20px)', border: '1px solid #1a1b2e' }}
          >
            <div className="p-6" style={{ borderBottom: '1px solid #1a1b2e' }}>
              <h3 className="font-semibold" style={{ color: '#e3f4f8' }}>API Keys</h3>
              <p className="text-sm mt-0.5" style={{ color: '#8589b2' }}>
                Use these keys to authenticate with the Prodify CLI and API. Keys are shown once — store them securely.
              </p>
            </div>
            <div className="p-6 space-y-4">
              {/* New key reveal banner */}
              {newKeyToken && (
                <div
                  className="rounded-xl p-4"
                  style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}
                >
                  <p className="text-xs font-semibold mb-2" style={{ color: '#10b981' }}>
                    ✓ New key generated — copy it now, it won&apos;t be shown again
                  </p>
                  <div className="flex items-center gap-2">
                    <code
                      className="flex-1 text-xs px-3 py-2 rounded-lg truncate"
                      style={{ background: 'rgba(3,7,18,0.5)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontFamily: 'var(--font-geist-mono)' }}
                    >
                      {newKeyToken}
                    </code>
                    <button
                      onClick={() => void copyToken(newKeyToken)}
                      className="shrink-0 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                      style={{ border: '1px solid rgba(16,185,129,0.4)', color: '#10b981', background: 'rgba(16,185,129,0.1)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.2)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.1)'; }}
                    >
                      {newKeyCopied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              {/* Key list */}
              {keysLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#575efe', borderTopColor: 'transparent' }} />
                </div>
              ) : apiKeys.length === 0 ? (
                <div
                  className="text-center py-8 text-sm rounded-xl"
                  style={{ border: '2px dashed #323779', color: '#8589b2' }}
                >
                  No API keys yet. Generate one below.
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a1b2e' }}>
                  {apiKeys.map((key, idx) => (
                    <div
                      key={key.id}
                      className="flex items-center gap-3 px-4 py-3"
                      style={{ borderBottom: idx < apiKeys.length - 1 ? '1px solid #1a1b2e' : 'none', background: 'rgba(3,7,18,0.3)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: '#e3f4f8' }}>{key.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-xs" style={{ color: '#8589b2', fontFamily: 'var(--font-geist-mono)' }}>{key.prefix}••••••••</code>
                          <span style={{ color: '#323779' }}>·</span>
                          <span className="text-xs" style={{ color: '#8589b2' }}>Created {timeAgo(key.createdAt)}</span>
                          {key.lastUsedAt && (
                            <>
                              <span style={{ color: '#323779' }}>·</span>
                              <span className="text-xs" style={{ color: '#8589b2' }}>Last used {timeAgo(key.lastUsedAt)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => void revokeKey(key.id)}
                        disabled={revokingId === key.id}
                        className="text-xs font-medium transition-colors disabled:opacity-50"
                        style={{ color: '#ef4444' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ff6b6b'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                      >
                        {revokingId === key.id ? 'Revoking...' : 'Revoke'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {keyError && <p className="text-sm" style={{ color: '#ff6b6b' }}>{keyError}</p>}

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs" style={{ color: '#8589b2' }}>Up to 5 keys per account</p>
                <button
                  onClick={() => void generateApiKey()}
                  disabled={generatingKey || apiKeys.length >= 5}
                  className="text-xs font-semibold py-2 px-4 rounded-full transition-all disabled:opacity-50"
                  style={{ background: '#575efe', color: '#ffffff', boxShadow: '0 0 16px rgba(87,94,254,0.3)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 24px rgba(87,94,254,0.5)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 16px rgba(87,94,254,0.3)'; }}
                >
                  {generatingKey ? 'Generating...' : '+ Generate new key'}
                </button>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* ── Danger Zone ─────────────────────────────────────────────────────── */}
      {activeTab === 'danger' && (
        <Section>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(239,68,68,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            <div className="p-6" style={{ borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
              <h3 className="font-semibold" style={{ color: '#ef4444' }}>Danger Zone</h3>
              <p className="text-sm mt-0.5" style={{ color: '#8589b2' }}>Irreversible actions. Proceed with caution.</p>
            </div>
            <div className="p-6 space-y-4">
              {/* Sign out everywhere */}
              <div
                className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: '#e3f4f8' }}>Sign out everywhere</p>
                  <p className="text-xs mt-0.5" style={{ color: '#8589b2' }}>Revoke all active sessions across all devices</p>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="text-xs font-medium px-3 py-1.5 rounded-full transition-all"
                  style={{ border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.15)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'; }}
                >
                  Sign out
                </button>
              </div>

              {/* Delete account */}
              <div
                className="p-4 rounded-xl space-y-3"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: '#e3f4f8' }}>Delete account</p>
                  <p className="text-xs mt-0.5" style={{ color: '#8589b2' }}>
                    Permanently deletes your account, all projects, activity history, GitHub connection, and API keys. This cannot be undone.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs" style={{ color: '#8589b2' }}>
                    Type <span style={{ fontFamily: 'var(--font-geist-mono)', color: '#ef4444', fontWeight: 600 }}>delete my account</span> to confirm
                  </label>
                  <input
                    id="delete-confirm"
                    value={deleteConfirm}
                    onChange={e => setDeleteConfirm(e.target.value)}
                    placeholder="delete my account"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{ background: '#030712', border: '1px solid rgba(239,68,68,0.3)', color: '#e3f4f8' }}
                    onFocus={e => (e.target.style.borderColor = '#ef4444')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(239,68,68,0.3)')}
                  />
                </div>
                {deleteError && <p className="text-sm" style={{ color: '#ff6b6b' }}>{deleteError}</p>}
                <button
                  disabled={deleteConfirm !== 'delete my account' || deleting}
                  onClick={() => void deleteAccount()}
                  className="text-xs font-medium px-4 py-2 rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ border: '1px solid rgba(239,68,68,0.5)', color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}
                  onMouseEnter={e => { if (deleteConfirm === 'delete my account') (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.2)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)'; }}
                >
                  {deleting ? 'Deleting...' : 'Delete my account'}
                </button>
              </div>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
