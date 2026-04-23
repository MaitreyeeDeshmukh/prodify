import { execSync } from 'child_process';
import { info, success, error as logError } from '../logger';
import path from 'path';

export async function runInSandbox(targetDir: string) {
  info('Starting Docker Sandbox validation...');
  const dockerfilePath = path.join(__dirname, '../../../sandbox/Dockerfile.prodify');
  
  try {
    info('Building sandbox image...');
    execSync(`docker build -t prodify-sandbox -f ${dockerfilePath} ${path.dirname(dockerfilePath)}`, { stdio: 'inherit' });

    info('Running build validation inside sandbox...');
    // Mount the user's codebase as read-write to allow the sandbox to install modules and run build
    // In a real isolated scenario, we might copy it instead, but this proves the concept.
    execSync(`docker run --rm -v "${targetDir}:/app" prodify-sandbox`, { stdio: 'inherit' });
    
    success('Sandbox validation passed. Code builds successfully.');
    return true;
  } catch (error) {
    logError('Sandbox validation failed! The injected codemods caused a build error.');
    if (error instanceof Error) {
      logError(error.message);
    }
    return false;
  }
}
