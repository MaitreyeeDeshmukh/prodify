import fs from 'fs-extra';
import path from 'path';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

// Initialize Bedrock client
// Note: Requires AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION
const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const MODEL_ID = process.env.AWS_BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0';

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
  const appDirPath = path.join(targetDir, 'apps/web/app'); 
  
  let packageJson = '';
  try {
    packageJson = await fs.readFile(packageJsonPath, 'utf-8');
  } catch (e) {
    console.warn('Could not read package.json');
  }

  let tree = '';
  try {
    if (await fs.pathExists(appDirPath)) {
      const files = await fs.readdir(appDirPath, { recursive: true });
      tree = files.slice(0, 50).join('\n'); 
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

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: prompt
      }
    ]
  };

  try {
    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await bedrock.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.body));
    
    // Anthropic response format on Bedrock
    const content = result.content[0].text;
    if (!content) throw new Error('No content returned from AI');
    
    // Strip any markdown code blocks if the model included them
    const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(jsonStr) as RetrofitPlan;
  } catch (error) {
    console.error('Failed to analyze repository with AWS Bedrock', error);
    return {
      pattern: 'generic',
      modifications: []
    };
  }
}
