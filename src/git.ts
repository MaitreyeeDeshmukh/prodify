// ─── Git Operations ───────────────────────────────────────────────────────────
// Runs git add / commit / push after injection.
// Author is always set to Maitreyee <maitreyee@prodify.dev> via --author flag.
import { execSync } from 'child_process';

const AUTHOR = 'Maitreyee <maitreyee@prodify.dev>';
const COMMIT_MSG = 'feat: inject prodify infrastructure layer — auth + payments + schema';

export function runGitCommit(cwd: string): void {
  const opts = { cwd, stdio: 'inherit' as const };

  // Stage all new and modified files
  execSync('git add .', opts);

  // Commit with explicit author override — never use git default author
  execSync(
    `git commit --author="${AUTHOR}" -m "${COMMIT_MSG}"`,
    opts,
  );

  // Push to origin main
  execSync('git push origin main', opts);
}
