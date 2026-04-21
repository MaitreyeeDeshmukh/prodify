// ─── Git Operations Tests ─────────────────────────────────────────────────────
jest.mock('child_process');

import { execSync } from 'child_process';
import { runGitCommit } from '../src/git';

const execSyncMock = execSync as jest.MockedFunction<typeof execSync>;

describe('runGitCommit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    execSyncMock.mockReturnValue(Buffer.from(''));
  });

  it('runs git add, commit, and push in order', () => {
    runGitCommit('/fake/project');

    const calls = execSyncMock.mock.calls.map(c => c[0] as string);
    expect(calls[0]).toContain('git add .');
    expect(calls[1]).toContain('git commit');
    expect(calls[1]).toContain('Maitreyee <maitreyee@prodify.dev>');
    expect(calls[2]).toContain('git push origin main');
  });

  it('includes the standard commit message', () => {
    runGitCommit('/fake/project');

    const commitCall = execSyncMock.mock.calls[1][0] as string;
    expect(commitCall).toContain('feat: inject prodify infrastructure layer');
  });

  it('throws when execSync throws (e.g. git not installed)', () => {
    execSyncMock.mockImplementationOnce(() => { throw new Error('git: command not found'); });

    expect(() => runGitCommit('/fake/project')).toThrow('git: command not found');
  });

  it('passes cwd option to every execSync call', () => {
    runGitCommit('/my/project');

    execSyncMock.mock.calls.forEach(call => {
      expect(call[1]).toMatchObject({ cwd: '/my/project' });
    });
  });
});
