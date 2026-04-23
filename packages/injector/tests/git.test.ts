// ─── Git Operations Tests ─────────────────────────────────────────────────────
jest.mock('child_process');
jest.mock('inquirer', () => ({
  prompt: jest.fn().mockResolvedValue({ autoDeploy: false }),
}));

import { execSync } from 'child_process';
import { runGitCommit } from '../src/git';

const execSyncMock = execSync as jest.MockedFunction<typeof execSync>;

describe('runGitCommit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    execSyncMock.mockReturnValue(Buffer.from(''));
  });

  it('runs git checkout, add, commit, and push in order', async () => {
    await runGitCommit('/fake/project');

    const calls = execSyncMock.mock.calls.map(c => c[0] as string);
    expect(calls[0]).toContain('git checkout -b');
    expect(calls[1]).toContain('git add .');
    expect(calls[2]).toContain('git commit');
    expect(calls[3]).toContain('git push');
  });

  it('includes the standard commit message', async () => {
    await runGitCommit('/fake/project');

    const commitCall = execSyncMock.mock.calls[2][0] as string;
    expect(commitCall).toContain('feat: inject prodify infrastructure layer');
  });

  it('rejects when execSync throws (e.g. git not installed)', async () => {
    execSyncMock.mockImplementationOnce(() => { throw new Error('git: command not found'); });

    await expect(runGitCommit('/fake/project')).rejects.toThrow('git: command not found');
  });

  it('passes cwd option to every execSync call', async () => {
    await runGitCommit('/my/project');

    execSyncMock.mock.calls.forEach(call => {
      expect(call[1]).toMatchObject({ cwd: '/my/project' });
    });
  });
});
