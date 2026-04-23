import fs from 'fs-extra';
import path from 'path';
import OpenAI from 'openai';

// Initialize OpenAI client
// Note: Requires OPENAI_API_KEY environment variable
const openai = new OpenAI();

export interface RetrofitPlan {
  pattern: 'crud' | 'dashboard' | 'generic';
  modifications: Array<{
    file: string;
    action: 'inject_auth' | 'inject_stripe' | 'inject_db';
    description: string;
  }>;
}

export async function analyzeRepository(targetDir: string): Promise<RetrofitPlan> {
  const packageJsonPath = path.join(targetDir, 'package.json');
  const appDirPath = path.join(targetDir, 'apps/web/app'); // Assuming turbo repo structure or standard next.js
  
  let packageJson = '';
  try {
    packageJson = await fs.readFile(packageJsonPath, 'utf-8');
  } catch (e) {
    console.warn('Could not read package.json');
  }

  // Simplified directory tree for prompt
  let tree = '';
  try {
    if (await fs.pathExists(appDirPath)) {
      const files = await fs.readdir(appDirPath, { recursive: true });
      tree = files.slice(0, 50).join('\n'); // Limit to 50 files for prompt
    }
  } catch (e) {
    console.warn('Could not read app directory');
  }

  const prompt = `
You are an expert Next.js developer analyzing a codebase to retrofit it with SaaS infrastructure (auth, payments, DB).
Analyze the following project structure and package.json to generate a Retrofit Plan.

Project package.json:
${packageJson.slice(0, 1000)}

App Directory Structure:
${tree}

Output ONLY valid JSON matching this TypeScript interface:
{
  "pattern": "crud" | "dashboard" | "generic",
  "modifications": [
    {
      "file": "path/to/file",
      "action": "inject_auth" | "inject_stripe" | "inject_db",
      "description": "What needs to be done"
    }
  ]
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content returned from AI');
    
    return JSON.parse(content) as RetrofitPlan;
  } catch (error) {
    console.error('Failed to analyze repository with AI', error);
    // Fallback plan
    return {
      pattern: 'generic',
      modifications: []
    };
  }
}
