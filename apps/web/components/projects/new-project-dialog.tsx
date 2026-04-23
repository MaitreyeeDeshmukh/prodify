'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const MODULES = [
  { id: 'auth', label: 'Authentication', desc: 'Email + password, GitHub OAuth, session management', icon: '🔐' },
  { id: 'database', label: 'Database', desc: 'Prisma ORM + PostgreSQL schema auto-wired', icon: '🗄️' },
  { id: 'payments', label: 'Payments', desc: 'Stripe Checkout, webhooks, customer portal', icon: '💳' },
] as const;

type Module = (typeof MODULES)[number]['id'];

export function NewProjectDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [modules, setModules] = useState<Module[]>(['auth', 'database']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggleModule(id: Module) {
    setModules(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (modules.length === 0) { setError('Select at least one module.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, modules, repoUrl }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setError(typeof json.error === 'string' ? json.error : 'Something went wrong');
        return;
      }
      setOpen(false);
      setName(''); setDescription(''); setRepoUrl(''); setModules(['auth', 'database']);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = { background: '#1b1e3d', border: '1px solid #323779', color: '#e3f4f8' };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-5 py-2.5 rounded-full font-semibold text-sm transition-all duration-200 btn-glow"
        style={{ background: '#575efe', color: '#ffffff' }}
      >
        + New Project
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg" style={{ background: '#25284c', border: '1px solid #323779' }}>
          <DialogHeader>
            <DialogTitle style={{ color: '#e3f4f8', fontFamily: 'var(--font-unbounded)' }}>New project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 mt-2">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#8589b2' }}>Project name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="my-saas-app"
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#575efe')}
                onBlur={e => (e.target.style.borderColor = '#323779')}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#8589b2' }}>
                Description <span style={{ color: '#575efe' }}>(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What are you building?"
                rows={2}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all resize-none"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#575efe')}
                onBlur={e => (e.target.style.borderColor = '#323779')}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#8589b2' }}>
                GitHub repo URL <span style={{ color: '#575efe' }}>(optional)</span>
              </label>
              <input
                value={repoUrl}
                onChange={e => setRepoUrl(e.target.value)}
                placeholder="https://github.com/you/my-saas-app"
                type="url"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#575efe')}
                onBlur={e => (e.target.style.borderColor = '#323779')}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-3" style={{ color: '#8589b2' }}>Modules to inject</label>
              <div className="space-y-2">
                {MODULES.map(mod => {
                  const checked = modules.includes(mod.id);
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => toggleModule(mod.id)}
                      className="w-full flex items-start gap-3 p-3 rounded-2xl text-left transition-all duration-200"
                      style={{
                        background: checked ? 'rgba(87,94,254,0.1)' : '#1b1e3d',
                        border: checked ? '1px solid rgba(87,94,254,0.5)' : '1px solid #323779',
                      }}
                    >
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-all"
                        style={{
                          background: checked ? '#575efe' : 'transparent',
                          border: checked ? '1px solid #575efe' : '1px solid #323779',
                        }}
                      >
                        {checked && <span className="text-white text-xs">✓</span>}
                      </div>
                      <div>
                        <div className="text-sm font-medium" style={{ color: '#e3f4f8' }}>{mod.icon} {mod.label}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#8589b2' }}>{mod.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            {error && <p className="text-sm" style={{ color: '#ff6b6b' }}>{error}</p>}
            <div className="flex gap-3 justify-end pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-5 py-2.5 rounded-full text-sm font-medium transition-all"
                style={{ border: '1px solid #323779', color: '#8589b2', background: 'transparent' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#575efe'; (e.currentTarget as HTMLButtonElement).style.color = '#e3f4f8'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#323779'; (e.currentTarget as HTMLButtonElement).style.color = '#8589b2'; }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 btn-glow disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: '#575efe', color: '#ffffff' }}
              >
                {loading ? 'Creating...' : 'Create project'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
