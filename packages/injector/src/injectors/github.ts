import type { FileEntry } from '../types';

function ciWorkflow(): string {
  return `name: CI Validation

on:
  push:
    branches: [ "main", "prodify/*" ]
  pull_request:
    branches: [ "main" ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Use Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20.x'
        
    - name: Install dependencies
      run: npm ci || npm install
      
    - name: Typecheck
      run: npx tsc --noEmit
      
    - name: Run tests (if any)
      run: npm run test --if-present
`;
}

export function buildGithubFiles(): FileEntry[] {
  return [
    { relativePath: '.github/workflows/ci.yml', content: ciWorkflow() },
  ];
}
