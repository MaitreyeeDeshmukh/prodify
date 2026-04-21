#!/usr/bin/env node
// ─── Prodify CLI Entry Point ──────────────────────────────────────────────────
// One command. Production-ready SaaS infrastructure injected into your codebase.
// Usage: prodify inject [--dry-run] [--verbose] [--no-git]
import { Command } from 'commander';
import { detectStack } from './detector';
import { runPrompts } from './prompts';
import { runInjection } from './injector';
import { runGitCommit } from './git';
import { setVerbose, header, info, success, error as logError, warn } from './logger';
import type { ProdifyConfig } from './types';

const program = new Command();

program
  .name('prodify')
  .description('One command. Production-ready SaaS infrastructure injected into your existing codebase.')
  .version('0.1.0');

program
  .command('inject')
  .description('Scan your project and inject SaaS infrastructure (auth, payments, DB schema)')
  .option('--dry-run', 'Show what would be injected without writing any files', false)
  .option('--verbose', 'Enable detailed logging', false)
  .option('--no-git', 'Skip the git commit/push step')
  .action(async (options: { dryRun: boolean; verbose: boolean; git: boolean }) => {
    setVerbose(options.verbose);

    header('🚀 Prodify — SaaS Infrastructure Injector');

    const cwd = process.cwd();

    if (options.dryRun) {
      warn('Running in dry-run mode — no files will be written.');
    }

    // ── 1. Detect stack ────────────────────────────────────────────────────────
    info('Scanning project stack...');
    const detected = await detectStack(cwd);
    info(`Detected: ${detected.type} (confidence: ${detected.confidence})`);

    // ── 2. Ask 3 questions ─────────────────────────────────────────────────────
    const answers = await runPrompts(detected);
    info(`Config: ${answers.pricingModel} pricing · ${answers.userType} users · ${answers.stack} stack`);

    // ── 3. Inject files ────────────────────────────────────────────────────────
    const config: ProdifyConfig = {
      answers,
      targetDir: cwd,
      dryRun: options.dryRun,
      verbose: options.verbose,
    };

    const result = await runInjection(config);

    // ── 4. Report results ──────────────────────────────────────────────────────
    success(`\nInjected ${result.filesCreated.length} files into prodify-layer/`);

    if (result.errors.length > 0) {
      logError(`${result.errors.length} file(s) failed to write:`);
      result.errors.forEach(e => logError(`  ${e}`));
    }

    // ── 5. Git commit + push ───────────────────────────────────────────────────
    if (!options.dryRun && options.git !== false && result.errors.length === 0) {
      info('\nCommitting and pushing to origin...');
      try {
        runGitCommit(cwd);
        success('Git commit + push complete.');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logError(`Git step failed: ${message}`);
        logError('Your files were written successfully — commit manually when ready.');
        process.exit(1);
      }
    }

    header('✅ Prodify injection complete! See prodify-layer/README-prodify.md to activate.');
  });

program.addHelpText('after', `
Examples:
  prodify inject              # interactive injection
  prodify inject --dry-run    # preview without writing files
  prodify inject --verbose    # detailed logging
  prodify inject --no-git     # skip git commit/push
`);

program.parse(process.argv);
