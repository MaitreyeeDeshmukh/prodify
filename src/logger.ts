// ─── Logger ───────────────────────────────────────────────────────────────────
// Chalk-based terminal output helpers. Call setVerbose(true) to enable
// verbose output (controlled via --verbose CLI flag).
import chalk from 'chalk';

let verboseMode = false;

export function setVerbose(v: boolean): void {
  verboseMode = v;
}

export function info(msg: string): void {
  console.log(chalk.cyan('ℹ'), msg);
}

export function success(msg: string): void {
  console.log(chalk.green('✓'), msg);
}

export function warn(msg: string): void {
  console.log(chalk.yellow('⚠'), msg);
}

export function error(msg: string): void {
  console.error(chalk.red('✗'), msg);
}

export function verbose(msg: string): void {
  if (verboseMode) {
    console.log(chalk.gray('[verbose]'), msg);
  }
}

export function header(msg: string): void {
  console.log('\n' + chalk.bold.magenta(msg) + '\n');
}

export function dryRun(msg: string): void {
  console.log(chalk.blue('[dry-run]'), chalk.gray(msg));
}
