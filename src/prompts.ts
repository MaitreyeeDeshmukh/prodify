// ─── Interactive Prompts ──────────────────────────────────────────────────────
// Runs the 3-question Inquirer flow and returns a typed ProdifyAnswers object.
import inquirer from 'inquirer';
import type { DetectedStack, ProdifyAnswers, StackType } from './types';

export async function runPrompts(detected: DetectedStack): Promise<ProdifyAnswers> {
  // Build questions array depending on whether a stack was detected
  const stackIsKnown = detected.type !== 'unknown';

  const questions: inquirer.QuestionCollection = [
    {
      type: 'list',
      name: 'pricingModel',
      message: 'What are you charging for?',
      choices: [
        { name: '(1) Per seat', value: 'per-seat' },
        { name: '(2) Flat subscription', value: 'flat' },
        { name: '(3) Usage-based', value: 'usage' },
      ],
    },
    {
      type: 'list',
      name: 'userType',
      message: 'Who are your users?',
      choices: [
        { name: '(1) Individuals', value: 'individuals' },
        { name: '(2) Teams', value: 'teams' },
        { name: '(3) Enterprise', value: 'enterprise' },
      ],
    },
    // ── Stack confirmation (shown when stack was detected) ────────────────────
    ...(stackIsKnown
      ? [
          {
            type: 'confirm',
            name: 'confirmStack',
            message: `What stack are you on? (auto-detected: ${detected.type}${detected.version ? ` ${detected.version}` : ''} — confirm?)`,
            default: true,
          } as inquirer.ConfirmQuestion,
        ]
      : [
          // ── Manual stack selection (shown when stack is unknown) ─────────────
          {
            type: 'list',
            name: 'manualStack',
            message: 'What stack are you on? (could not auto-detect)',
            choices: [
              { name: 'Next.js', value: 'nextjs' },
              { name: 'Express', value: 'express' },
              { name: 'FastAPI', value: 'fastapi' },
              { name: 'Rails', value: 'rails' },
            ],
          } as inquirer.ListQuestion,
        ]),
  ];

  const answers = await inquirer.prompt(questions);

  // Resolve final stack: confirmed detected OR manually chosen
  const stack: StackType =
    stackIsKnown && answers['confirmStack'] !== false
      ? detected.type
      : (answers['manualStack'] as StackType) ?? detected.type;

  return {
    pricingModel: answers['pricingModel'] as ProdifyAnswers['pricingModel'],
    userType: answers['userType'] as ProdifyAnswers['userType'],
    stack,
  };
}
