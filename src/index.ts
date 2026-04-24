#!/usr/bin/env node
// ─── Prodify CLI Entry Point ──────────────────────────────────────────────────
// One command. Production-ready SaaS infrastructure injected into your codebase.
// Usage: prodify inject [--dry-run] [--verbose] [--no-git] [--open-env]
import { Command } from 'commander';
import { detectStack } from './detector';
import { runPrompts } from './prompts';
import { runInjection } from './injector';
import { runGitCommit } from './git';
import { buildAutoRecommendation } from './auto-config';
import { printActivationWizard } from './activation';
import { setVerbose, header, info, success, error as logError, warn } from './logger';
import inquirer from 'inquirer';
import type { ProdifyConfig, ProdifyAnswers } from './types';

const program = new Command();

program
  .name('prodify')
  .description('One command. Production-ready SaaS infrastructure injected into your existing codebase.')
  .version('0.2.0');

program
  .command('inject')
  .description('Scan your project and inject SaaS infrastructure (auth, payments, DB schema, UI)')
  .option('--dry-run', 'Show what would be injected without writing any files', false)
  .option('--verbose', 'Enable detailed logging', false)
  .option('--no-git', 'Skip the git commit/push step')
  .option('--open-env', 'Open the .env.example file in VS Code after injection (skips the prompt)', false)
  .action(async (options: { dryRun: boolean; verbose: boolean; git: boolean; openEnv: boolean }) => {
    setVerbose(options.verbose);

    header('🚀 Prodify — SaaS Infrastructure Injector');

    const cwd = process.cwd();

    if (options.dryRun) {
      warn('Running in dry-run mode — no files will be written.');
    }

    // ── 1. Detect stack ──────────────────────────────────────────────────────
    info('Scanning project stack...');
    const detected = await detectStack(cwd);
    info(`Detected: ${detected.type} (confidence: ${detected.confidence})`);

    // ── 2. Auto or Manual setup ──────────────────────────────────────────────
    let answers: ProdifyAnswers;

    // runPrompts() always asks the mode question first.
    // If user picks "auto", we build a recommendation, show it, and confirm.
    const initialAnswers = await runPrompts(detected);

    if (initialAnswers.setupMode === 'auto') {
      info('\nAnalysing your project...');
      const recommendation = await buildAutoRecommendation(cwd, initialAnswers.appName, detected.type);

      // Show recommendation summary
      console.log('\n  ┌─ Prodify recommendation ──────────────────────────────────────────┐');
      console.log(`  │  Pricing model   → ${recommendation.answers.pricingModel.padEnd(42)}│`);
      console.log(`  │  Billing         → ${recommendation.answers.billingInterval.padEnd(42)}│`);
      console.log(`  │  Onboarding      → ${recommendation.answers.onboardingFlow.padEnd(42)}│`);
      console.log(`  │  Auth methods    → ${recommendation.answers.authMethods.join(', ').padEnd(42)}│`);
      console.log(`  │  Database        → ${recommendation.answers.dbProvider.padEnd(42)}│`);
      console.log(`  │  Deploy target   → ${recommendation.answers.deployTarget.padEnd(42)}│`);
      console.log(`  │  Compliance      → ${recommendation.answers.complianceRegion.padEnd(42)}│`);
      console.log(`  │  UI components   → ${(recommendation.answers.injectUi ? `Yes — ${recommendation.answers.uiLibrary}` : 'No').padEnd(42)}│`);
      console.log('  └───────────────────────────────────────────────────────────────────┘\n');

      const { choice } = await inquirer.prompt([
        {
          type: 'list',
          name: 'choice',
          message: 'Accept this config and inject?',
          choices: [
            { name: '✅ Accept — inject now with these settings', value: 'accept' },
            { name: '🎛  Review — walk through each option (pre-filled with recommendations)', value: 'review' },
          ],
        },
      ]) as { choice: 'accept' | 'review' };

      if (choice === 'accept') {
        answers = recommendation.answers;
      } else {
        // Manual flow pre-filled from recommendations
        answers = await runPrompts(detected, recommendation.answers);
      }
    } else {
      answers = initialAnswers;
    }

    info(`Config: ${answers.pricingModel} pricing · ${answers.dbProvider} DB · ${answers.userType} users · ${answers.stack} stack`);

    // ── 3. Inject files ──────────────────────────────────────────────────────
    const config: ProdifyConfig = {
      answers,
      targetDir: cwd,
      dryRun: options.dryRun,
      verbose: options.verbose,
    };

    const result = await runInjection(config);

    // ── 4. Report results ────────────────────────────────────────────────────
    success(`\nInjected ${result.filesCreated.length} files into prodify-layer/`);

    if (result.errors.length > 0) {
      logError(`${result.errors.length} file(s) failed to write:`);
      result.errors.forEach(e => logError(`  ${e}`));
    }

    // ── 5. Activation wizard ─────────────────────────────────────────────────
    if (!options.dryRun) {
      await printActivationWizard(answers, result, options.openEnv);
    }

    // ── 6. Git commit + push ─────────────────────────────────────────────────
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
  });

program.addHelpText('after', `
Examples:
  prodify inject                # interactive injection (auto or manual)
  prodify inject --dry-run      # preview without writing files
  prodify inject --verbose      # detailed logging
  prodify inject --no-git       # skip git commit/push
  prodify inject --open-env     # auto-open .env.example in VS Code after injection
`);

program.parse(process.argv);
