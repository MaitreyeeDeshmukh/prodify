'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const MODULES = [
  {
    id: 'auth',
    label: 'Authentication',
    desc: 'Email + password, GitHub OAuth, session management',
    icon: '🔐',
  },
  {
    id: 'database',
    label: 'Database',
    desc: 'Prisma ORM + PostgreSQL schema auto-wired',
    icon: '🗄️',
  },
  {
    id: 'payments',
    label: 'Payments',
    desc: 'Stripe Checkout, webhooks, customer portal',
    icon: '💳',
  },
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
    setModules(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (modules.length === 0) {
      setError('Select at least one module.');
      return;
    }
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
      setName('');
      setDescription('');
      setRepoUrl('');
      setModules(['auth', 'database']);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ New Project</Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          <div>
            <Label htmlFor="proj-name">Project name</Label>
            <Input
              id="proj-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="my-saas-app"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="proj-desc">Description <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Textarea
              id="proj-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What are you building?"
              className="mt-1 resize-none"
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="proj-repo">GitHub repo URL <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input
              id="proj-repo"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              placeholder="https://github.com/you/my-saas-app"
              type="url"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="mb-3 block">Modules to inject</Label>
            <div className="space-y-3">
              {MODULES.map(mod => (
                <label
                  key={mod.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <Checkbox
                    checked={modules.includes(mod.id)}
                    onCheckedChange={() => toggleModule(mod.id)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {mod.icon} {mod.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{mod.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 justify-end pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? 'Creating...' : 'Create project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
