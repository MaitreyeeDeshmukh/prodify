'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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

function Section({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}

type GitHubStatus = {
  connected: boolean;
  login?: string;
  avatar?: string;
};

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const [profileSaved, setProfileSaved] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'accounts' | 'danger'>('profile');
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const initials = session?.user?.name?.slice(0, 2).toUpperCase() ?? 'U';

  const { register: regP, handleSubmit: hsP, formState: { errors: errP, isSubmitting: submP } } = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: session?.user?.name ?? '' },
  });

  const { register: regPw, handleSubmit: hsPw, reset: resetPw, formState: { errors: errPw, isSubmitting: submPw } } = useForm<PasswordData>({
    resolver: zodResolver(passwordSchema),
  });

  const fetchGithubStatus = useCallback(async () => {
    const res = await fetch('/api/github/status');
    if (res.ok) {
      const data = await res.json() as GitHubStatus;
      setGithubStatus(data);
    }
  }, []);

  useEffect(() => { void fetchGithubStatus(); }, [fetchGithubStatus]);

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
    if (res.ok) {
      setGithubStatus({ connected: false });
    }
    setDisconnecting(false);
  }

  const TABS = [
    { key: 'profile', label: 'Profile' },
    { key: 'password', label: 'Password' },
    { key: 'accounts', label: 'Connected Accounts' },
    { key: 'danger', label: 'Danger Zone' },
  ] as const;

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account settings and preferences</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {activeTab === 'profile' && (
        <Section>
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Update your public display information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={session?.user?.image ?? undefined} />
                  <AvatarFallback className="text-lg bg-violet-100 text-violet-700 font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm text-gray-900">{session?.user?.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{session?.user?.email}</p>
                  <p className="text-xs text-gray-400 mt-1">Avatar is pulled from your OAuth provider</p>
                </div>
              </div>

              <form onSubmit={hsP(onProfileSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="name">Display name</Label>
                  <Input id="name" {...regP('name')} placeholder="Your name" />
                  {errP.name && <p className="text-xs text-red-500 mt-1">{errP.name.message}</p>}
                </div>
                <div>
                  <Label htmlFor="email-ro">Email</Label>
                  <Input id="email-ro" value={session?.user?.email ?? ''} disabled className="bg-gray-50 text-gray-400" />
                  <p className="text-xs text-gray-400 mt-1">Email cannot be changed directly. Contact support.</p>
                </div>
                <Button type="submit" disabled={submP} className="bg-violet-600 hover:bg-violet-700">
                  {profileSaved ? '✓ Saved!' : submP ? 'Saving...' : 'Save changes'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </Section>
      )}

      {/* Password tab */}
      {activeTab === 'password' && (
        <Section>
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your account password. Leave blank to keep current.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={hsPw(onPasswordSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="current-pw">Current password</Label>
                  <Input id="current-pw" type="password" {...regPw('currentPassword')} />
                  {errPw.currentPassword && <p className="text-xs text-red-500 mt-1">{errPw.currentPassword.message}</p>}
                </div>
                <div>
                  <Label htmlFor="new-pw">New password</Label>
                  <Input id="new-pw" type="password" {...regPw('newPassword')} />
                  {errPw.newPassword && <p className="text-xs text-red-500 mt-1">{errPw.newPassword.message}</p>}
                </div>
                <div>
                  <Label htmlFor="confirm-pw">Confirm new password</Label>
                  <Input id="confirm-pw" type="password" {...regPw('confirmPassword')} />
                  {errPw.confirmPassword && <p className="text-xs text-red-500 mt-1">{errPw.confirmPassword.message}</p>}
                </div>
                {passwordMsg && <p className="text-sm text-emerald-600">{passwordMsg}</p>}
                {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
                <Button type="submit" disabled={submPw} className="bg-violet-600 hover:bg-violet-700">
                  {submPw ? 'Updating...' : 'Update password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </Section>
      )}

      {/* Connected Accounts tab */}
      {activeTab === 'accounts' && (
        <Section>
          <Card>
            <CardHeader>
              <CardTitle>Connected Accounts</CardTitle>
              <CardDescription>Manage third-party integrations used by Prodify</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* GitHub */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">GitHub</p>
                    {githubStatus?.connected && githubStatus.login ? (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {githubStatus.avatar && (
                          <img src={githubStatus.avatar} alt="" className="w-4 h-4 rounded-full" />
                        )}
                        <p className="text-xs text-gray-500">@{githubStatus.login}</p>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                        <span className="text-xs text-emerald-600 font-medium">Connected</span>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mt-0.5">Not connected</p>
                    )}
                  </div>
                </div>
                <div>
                  {githubStatus?.connected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={disconnecting}
                      onClick={() => void disconnectGitHub()}
                      className="text-xs border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                    >
                      {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => void signIn('github', { callbackUrl: '/settings' })}
                      className="text-xs bg-gray-900 hover:bg-gray-800 text-white"
                    >
                      Connect GitHub
                    </Button>
                  )}
                </div>
              </div>

              <p className="text-xs text-gray-400 px-1">
                GitHub is used to import repos, clone them for analysis, push injection branches, and open pull requests. Disconnecting will not affect existing projects.
              </p>
            </CardContent>
          </Card>
        </Section>
      )}

      {/* Danger zone tab */}
      {activeTab === 'danger' && (
        <Section>
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-700">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions. Proceed with caution.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">Sign out everywhere</p>
                  <p className="text-xs text-gray-500 mt-0.5">Revoke all active sessions across all devices</p>
                </div>
                <Button
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                >
                  Sign out
                </Button>
              </div>
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">Delete account</p>
                  <p className="text-xs text-gray-500 mt-0.5">Permanently delete your account and all data. Cannot be undone.</p>
                </div>
                <Button
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-100"
                  onClick={() => alert('Account deletion coming soon. Contact support@prodify.app')}
                >
                  Delete account
                </Button>
              </div>
            </CardContent>
          </Card>
        </Section>
      )}
    </div>
  );
}
