import { execSync } from 'child_process';
import { info, success, error as logError } from './logger';
import inquirer from 'inquirer';

const AUTHOR = 'Maitreyee <maitreyee@prodify.dev>';
const COMMIT_MSG = 'feat: inject prodify infrastructure layer — auth + payments + schema';

export async function runGitCommit(cwd: string): Promise<void> {
  const opts = { cwd, stdio: 'inherit' as const };
  const timestamp = Date.now();
  const branchName = `prodify/inject-${timestamp}`;

  info(`Creating new branch: ${branchName}`);
  execSync(`git checkout -b ${branchName}`, opts);

  // Stage all new and modified files
  execSync('git add .', opts);

  // Commit with explicit author override — never use git default author
  execSync(
    `git commit --author="${AUTHOR}" -m "${COMMIT_MSG}"`,
    opts,
  );

  // Push to remote
  execSync(`git push -u origin ${branchName}`, opts);
  success(`Pushed branch ${branchName} to remote.`);

  const { autoDeploy } = await inquirer.prompt<{ autoDeploy: boolean }>([
    {
      type: 'confirm',
      name: 'autoDeploy',
      message: 'Deploy to Vercel when merged to main? (This will open a GitHub PR)',
      default: true,
    },
  ]);

  if (autoDeploy) {
    info('Opening Pull Request using GitHub CLI...');
    try {
      execSync(`gh pr create --title "${COMMIT_MSG}" --body "Prodify automated infrastructure injection. Merging this PR will trigger a Vercel deployment." --base main --head ${branchName}`, opts);
      success('Pull Request created successfully.');
    } catch (e) {
      logError('Failed to create PR using gh CLI. Please create it manually.');
    }
  }
}
