'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Repo = {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  cloneUrl: string;
  language: string | null;
  stars: number;
  pushedAt: string;
  private: boolean;
  defaultBranch: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported?: () => void;
};

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Go: '#00ADD8',
  Rust: '#dea584',
  Ruby: '#701516',
  CSS: '#563d7c',
};

export function RepoImportDialog({ open, onOpenChange, onImported }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<'loading' | 'connect' | 'pick' | 'manual' | 'creating'>('loading');
  const [repos, setRepos] = useState<Repo[]>([]);
  const [search, setSearch] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [manualName, setManualName] = useState('');
  const [error, setError] = useState('');
  const [githubLogin, setGithubLogin] = useState('');

  useEffect(() => {
    if (!open) return;
    setStep('loading');
    setSearch('');
    setError('');

    fetch('/api/github/repos')
      .then(r => r.json())
      .then((data: { connected: boolean; login?: string; repos?: Repo[] }) => {
        if (!data.connected) {
          setStep('connect');
        } else {
          setRepos(data.repos ?? []);
          setGithubLogin(data.login ?? '');
          setStep('pick');
        }
      })
      .catch(() => setStep('connect'));
  }, [open]);

  async function createProject(payload: {
    name: string;
    repoUrl: string;
    repoFullName: string;
    cloneUrl: string;
    defaultBranch: string;
  }) {
    setStep('creating');
    setError('');

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json() as { project?: { id: string }; error?: string };

    if (!res.ok || !data.project) {
      setError(data.error ?? 'Failed to create project');
      setStep('pick');
      return;
    }

    onOpenChange(false);
    onImported?.();
    router.push(`/dashboard/projects/${data.project.id}`);
  }

  function handleRepoSelect(repo: Repo) {
    void createProject({
      name: repo.name,
      repoUrl: repo.url,
      repoFullName: repo.fullName,
      cloneUrl: repo.cloneUrl,
      defaultBranch: repo.defaultBranch,
    });
  }

  async function handleManualSubmit() {
    if (!manualUrl.trim()) { setError('Paste a GitHub repo URL'); return; }
    const match = manualUrl.trim().match(/github\.com\/([^/]+\/[^/]+)/);
    if (!match) { setError('Must be a valid GitHub URL (github.com/owner/repo)'); return; }
    const fullName = match[1].replace(/\.git$/, '');
    const name = manualName.trim() || fullName.split('/')[1] || fullName;
    await createProject({
      name,
      repoUrl: `https://github.com/${fullName}`,
      repoFullName: fullName,
      cloneUrl: `https://github.com/${fullName}.git`,
      defaultBranch: 'main',
    });
  }

  const filtered = repos.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import a repository</DialogTitle>
          <DialogDescription>
            {step === 'connect'
              ? 'Connect your GitHub account to import repos'
              : step === 'manual'
              ? 'Paste any public GitHub repository URL'
              : 'Select a repository to analyze and inject'}
          </DialogDescription>
        </DialogHeader>

        {/* LOADING */}
        {step === 'loading' && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* CONNECT GITHUB */}
        {step === 'connect' && (
          <div className="flex flex-col items-center gap-4 py-10">
            <div className="w-16 h-16 rounded-2xl bg-gray-900 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-900 mb-1">Connect GitHub to import repos</p>
              <p className="text-sm text-gray-500">Prodify needs repo access to analyze and inject infrastructure</p>
            </div>
            <Button
              className="bg-gray-900 hover:bg-gray-800 text-white"
              onClick={() => void signIn('github', { callbackUrl: '/dashboard' })}
            >
              Connect GitHub
            </Button>
            <button
              onClick={() => setStep('manual')}
              className="text-sm text-violet-600 hover:underline"
            >
              Or paste a public repo URL instead
            </button>
          </div>
        )}

        {/* REPO PICKER */}
        {step === 'pick' && (
          <>
            <div className="flex gap-2">
              <Input
                placeholder="Search repos..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep('manual')}
                className="shrink-0 text-xs"
              >
                Paste URL
              </Button>
            </div>
            {githubLogin && (
              <p className="text-xs text-gray-400">Showing repos from <span className="font-medium text-gray-600">@{githubLogin}</span></p>
            )}
            <div className="overflow-y-auto flex-1 space-y-1 pr-1">
              {filtered.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No repos match your search</p>
              )}
              {filtered.map(repo => (
                <button
                  key={repo.id}
                  onClick={() => handleRepoSelect(repo)}
                  className="w-full text-left p-3 rounded-xl border border-transparent hover:border-violet-200 hover:bg-violet-50 transition-all group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-sm text-gray-900 truncate">{repo.name}</span>
                      {repo.private && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded shrink-0">Private</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-xs text-gray-400">
                      {repo.language && (
                        <span className="flex items-center gap-1">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: LANGUAGE_COLORS[repo.language] ?? '#888' }}
                          />
                          {repo.language}
                        </span>
                      )}
                      {repo.stars > 0 && <span>★ {repo.stars}</span>}
                    </div>
                  </div>
                  {repo.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{repo.description}</p>
                  )}
                </button>
              ))}
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </>
        )}

        {/* MANUAL URL */}
        {step === 'manual' && (
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">GitHub repo URL</label>
              <Input
                placeholder="https://github.com/owner/repo"
                value={manualUrl}
                onChange={e => setManualUrl(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Project name (optional)</label>
              <Input
                placeholder="Leave blank to use repo name"
                value={manualName}
                onChange={e => setManualName(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(repos.length > 0 ? 'pick' : 'connect')}>
                Back
              </Button>
              <Button
                className="bg-violet-600 hover:bg-violet-700 text-white flex-1"
                onClick={() => void handleManualSubmit()}
              >
                Import repo
              </Button>
            </div>
          </div>
        )}

        {/* CREATING */}
        {step === 'creating' && (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Creating project...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
