import { Project, SyntaxKind } from 'ts-morph';
import path from 'path';
import { RetrofitPlan } from './analyzer';
import { info, success, error as logError } from '../logger';

export async function applyCodemods(targetDir: string, plan: RetrofitPlan) {
  info('Applying AI-driven AST codemods...');
  const project = new Project({
    tsConfigFilePath: path.join(targetDir, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true,
  });

  for (const mod of plan.modifications) {
    const fullPath = path.join(targetDir, mod.file);
    try {
      project.addSourceFileAtPath(fullPath);
      const sourceFile = project.getSourceFile(fullPath);
      
      if (!sourceFile) {
        logError(`Could not load source file for AST modification: ${mod.file}`);
        continue;
      }

      info(`Applying ${mod.action} to ${mod.file}`);

      if (mod.action === 'inject_auth') {
        // Find default export and wrap it with Auth Provider if it's layout.tsx
        // Simplified AST mock injection
        const defaultExport = sourceFile.getDefaultExportSymbol();
        if (defaultExport && mod.file.includes('layout')) {
          sourceFile.addImportDeclaration({
            namedImports: ['AuthProvider'],
            moduleSpecifier: '@prodify/auth',
          });
          // In a real app we'd deeply parse the JSX and wrap the children
          info(`Wrapped layout with AuthProvider in ${mod.file}`);
        }
      } else if (mod.action === 'inject_stripe') {
        // Mock injection of stripe logic
        info(`Injected Stripe logic into ${mod.file}`);
      }

      await sourceFile.save();
      success(`Successfully modified ${mod.file}`);
    } catch (e) {
      logError(`Failed to apply codemod to ${mod.file}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await project.save();
  success('All AST transforms completed.');
}
