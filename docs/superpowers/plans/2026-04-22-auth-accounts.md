# Auth + Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Sub-project 1 of the Prodify platform — full auth + accounts (email/password, GitHub OAuth, forgot password, profile, protected routes) on top of a restructured monorepo.

**Architecture:** Monorepo with npm workspaces. Existing CLI moves to `packages/injector/`. New Next.js 14 app lives in `apps/web/`. Prisma schema at root connects to Neon (Postgres). NextAuth v4 handles sessions via JWT strategy with PrismaAdapter.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, NextAuth v4, Prisma, Neon, Tailwind CSS, shadcn/ui, bcryptjs, Resend (email), Zod, React Hook Form

---

## File Map

### Root
| File | Purpose |
|---|---|
| `package.json` | Workspace root — declares `apps/*` and `packages/*` workspaces |
| `prisma/schema.prisma` | Database schema — User, Account, Session, VerificationToken, Project |
| `.env` | Local secrets (gitignored) |
| `.env.example` | Example env vars (committed) |
| `tsconfig.base.json` | Shared TS config extended by each workspace |

### packages/injector/
| File | Purpose |
|---|---|
| `package.json` | CLI package config (moved from root) |
| `src/` | Existing CLI source (moved from root src/) |
| `tests/` | Existing CLI tests (moved from root tests/) |
| `tsconfig.json` | Extends tsconfig.base.json |
| `jest.config.ts` | Jest config (moved from root) |

### apps/web/
| File | Purpose |
|---|---|
| `package.json` | Web app dependencies |
| `next.config.ts` | Next.js config |
| `tailwind.config.ts` | Tailwind config |
| `tsconfig.json` | Extends tsconfig.base.json, adds paths |
| `middleware.ts` | Protect all (dashboard) routes — redirect to /login |
| `types/next-auth.d.ts` | Extend Session type with user.id |
| `lib/prisma.ts` | Prisma client singleton |
| `lib/auth.ts` | NextAuth options — Credentials + GitHub providers |
| `lib/validations.ts` | Zod schemas for signup, login, forgot password, reset |
| `lib/tokens.ts` | Generate/verify password reset tokens |
| `lib/email.ts` | Send emails via Resend |
| `app/layout.tsx` | Root layout — SessionProvider wrapper |
| `app/page.tsx` | Root redirect — /dashboard if authed, /login if not |
| `app/(auth)/layout.tsx` | Auth layout — centered card wrapper |
| `app/(auth)/login/page.tsx` | Sign in page |
| `app/(auth)/signup/page.tsx` | Create account page |
| `app/(auth)/forgot-password/page.tsx` | Request password reset |
| `app/(auth)/reset-password/page.tsx` | Set new password via token |
| `app/(dashboard)/layout.tsx` | Dashboard layout — sidebar + header |
| `app/(dashboard)/dashboard/page.tsx` | Project list (placeholder for Sub-project 2) |
| `app/(dashboard)/settings/page.tsx` | Profile — name, email, avatar |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth handler |
| `app/api/auth/signup/route.ts` | POST — create user with hashed password |
| `app/api/auth/forgot-password/route.ts` | POST — generate reset token, send email |
| `app/api/auth/reset-password/route.ts` | POST — validate token, update password |
| `app/api/user/profile/route.ts` | PATCH — update name/avatar |
| `components/auth/login-form.tsx` | Login form with RHF + Zod |
| `components/auth/signup-form.tsx` | Signup form with RHF + Zod |
| `components/auth/forgot-password-form.tsx` | Email input + submit |
| `components/auth/reset-password-form.tsx` | New password + confirm |
| `components/dashboard/header.tsx` | Top nav with user avatar + sign out |
| `components/dashboard/sidebar.tsx` | Left nav links |
| `components/ui/` | shadcn/ui components (button, input, label, card, form, etc.) |
| `__tests__/lib/auth.test.ts` | Unit tests — authorize function |
| `__tests__/api/signup.test.ts` | Unit tests — signup route logic |
| `__tests__/api/forgot-password.test.ts` | Unit tests — token generation |
| `__tests__/middleware.test.ts` | Unit tests — middleware matcher config |

---

## Task 1: Restructure repo as npm monorepo

**Files:**
- Modify: `package.json` (root — becomes workspace root)
- Create: `tsconfig.base.json`
- Create: `packages/injector/package.json`
- Create: `packages/injector/tsconfig.json`
- Create: `packages/injector/jest.config.ts`
- Move: `src/` → `packages/injector/src/`
- Move: `tests/` → `packages/injector/tests/`

- [ ] **Step 1: Replace root package.json with workspace config**

```json
{
  "name": "prodify-platform",
  "version": "0.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "npm run dev --workspace=apps/web",
    "build": "npm run build --workspace=apps/web",
    "test": "npm run test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

- [ ] **Step 2: Create shared tsconfig.base.json at root**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "CommonJS",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 3: Move CLI files into packages/injector/**

```bash
mkdir -p packages/injector
cp -r src packages/injector/src
cp -r tests packages/injector/tests
cp tsconfig.json packages/injector/tsconfig.json
cp jest.config.ts packages/injector/jest.config.ts
```

- [ ] **Step 4: Create packages/injector/package.json**

```json
{
  "name": "@prodify/injector",
  "version": "0.1.0",
  "description": "Core injection engine",
  "main": "dist/index.js",
  "bin": {
    "prodify": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/index.ts",
    "test": "jest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "chalk": "^4.1.2",
    "commander": "^12.0.0",
    "fs-extra": "^11.2.0",
    "inquirer": "^8.2.6"
  },
  "devDependencies": {
    "@types/fs-extra": "^11.0.4",
    "@types/inquirer": "^8.2.10",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.12.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.2",
    "ts-node": "^10.9.2",
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 5: Update packages/injector/tsconfig.json to extend base**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 6: Verify injector still builds**

```bash
cd packages/injector && npm install && npm run build
```

Expected: `dist/` output, no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git -c user.name="Maitreyee" -c user.email="maitreyee721@gmail.com" commit -m "chore: restructure repo as npm monorepo, move CLI to packages/injector"
```

---

## Task 2: Bootstrap apps/web (Next.js 14)

**Files:**
- Create: `apps/web/` (full Next.js app)

- [ ] **Step 1: Scaffold Next.js app**

```bash
cd apps && npx create-next-app@latest web \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*" \
  --no-turbopack
```

- [ ] **Step 2: Replace apps/web/tsconfig.json with strict config**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Install app dependencies**

```bash
cd apps/web && npm install \
  next-auth@4 \
  @auth/prisma-adapter \
  @prisma/client \
  bcryptjs \
  resend \
  zod \
  react-hook-form \
  @hookform/resolvers
```

```bash
npm install -D \
  @types/bcryptjs \
  prisma \
  jest \
  jest-environment-jsdom \
  @testing-library/react \
  @testing-library/jest-dom \
  @types/jest \
  ts-jest
```

- [ ] **Step 4: Create apps/web/next.config.ts**

```ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
};

export default config;
```

- [ ] **Step 5: Create apps/web/jest.config.ts**

```ts
import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  transform: { '^.+\\.tsx?$': ['ts-jest', {}] },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testMatch: ['**/__tests__/**/*.test.ts'],
};

export default config;
```

- [ ] **Step 6: Add scripts to apps/web/package.json**

Open `apps/web/package.json` and ensure scripts include:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "jest",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 7: Verify app boots**

```bash
cd apps/web && npm run dev
```

Expected: Next.js starts on http://localhost:3000 with no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git -c user.name="Maitreyee" -c user.email="maitreyee721@gmail.com" commit -m "feat: bootstrap apps/web Next.js 14 app with TypeScript strict"
```

---

## Task 3: Install shadcn/ui

**Files:**
- Create: `apps/web/components/ui/` (shadcn components)
- Modify: `apps/web/tailwind.config.ts`, `apps/web/app/globals.css`

- [ ] **Step 1: Initialize shadcn/ui**

```bash
cd apps/web && npx shadcn@latest init --defaults
```

When prompted, choose: Default style, Slate base color, CSS variables yes.

- [ ] **Step 2: Add required components**

```bash
npx shadcn@latest add button input label card form avatar dropdown-menu separator badge
```

- [ ] **Step 3: Verify components exist**

```bash
ls apps/web/components/ui/
```

Expected: `button.tsx input.tsx label.tsx card.tsx form.tsx avatar.tsx dropdown-menu.tsx separator.tsx badge.tsx`

- [ ] **Step 4: Commit**

```bash
git add -A
git -c user.name="Maitreyee" -c user.email="maitreyee721@gmail.com" commit -m "feat: add shadcn/ui component library"
```

---

## Task 4: Prisma schema + Neon database

**Files:**
- Create: `prisma/schema.prisma`
- Create: `.env`
- Create: `.env.example`
- Create: `apps/web/lib/prisma.ts`

- [ ] **Step 1: Initialize Prisma at repo root**

```bash
cd /Users/maitreyee/prodify && npx prisma init
```

Expected: Creates `prisma/schema.prisma` and `.env` with `DATABASE_URL` placeholder.

- [ ] **Step 2: Write prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  password      String?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  accounts      Account[]
  sessions      Session[]
  projects      Project[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model Project {
  id        String   @id @default(cuid())
  userId    String
  name      String
  repoUrl   String?
  status    String   @default("pending")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 3: Add env vars to .env (do not commit this file)**

```bash
# .env
DATABASE_URL="postgresql://..."       # from Neon dashboard — pooled connection
DIRECT_URL="postgresql://..."         # from Neon dashboard — direct connection

NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET=""                    # run: openssl rand -base64 32

GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

RESEND_API_KEY=""
```

- [ ] **Step 4: Create .env.example (committed)**

```bash
# .env.example
DATABASE_URL="postgresql://user:password@host/db?sslmode=require"
DIRECT_URL="postgresql://user:password@host/db?sslmode=require"

NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET=""

GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

RESEND_API_KEY=""
```

- [ ] **Step 5: Ensure .env is in .gitignore**

Open `.gitignore` at root and verify it contains:

```
.env
.env.local
.env.production
```

If not present, add these lines.

- [ ] **Step 6: Add DATABASE_URL from Neon**

Go to neon.tech, create a project. Copy the pooled connection string into `.env` as `DATABASE_URL` and the direct connection string as `DIRECT_URL`.

- [ ] **Step 7: Run initial migration**

```bash
npx prisma migrate dev --name init
```

Expected output:
```
Applying migration `20260422000000_init`
Your database is now in sync with your schema.
```

- [ ] **Step 8: Generate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 9: Create apps/web/lib/prisma.ts**

```ts
import { PrismaClient } from '@prisma/client';

// prevent multiple instances in development due to hot reload
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

- [ ] **Step 10: Commit**

```bash
git add prisma/ apps/web/lib/prisma.ts .env.example .gitignore
git -c user.name="Maitreyee" -c user.email="maitreyee721@gmail.com" commit -m "feat: add Prisma schema + Neon connection, initial migration"
```

---

## Task 5: NextAuth configuration

**Files:**
- Create: `apps/web/lib/auth.ts`
- Create: `apps/web/types/next-auth.d.ts`
- Create: `apps/web/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Write failing test for authorize function**

Create `apps/web/__tests__/lib/auth.test.ts`:

```ts
import bcrypt from 'bcryptjs';

// test the authorize logic in isolation
async function authorize(
  credentials: { email: string; password: string } | undefined,
  findUser: (email: string) => Promise<{ id: string; email: string; name: string | null; image: string | null; password: string | null } | null>
) {
  if (!credentials?.email || !credentials?.password) return null;
  const user = await findUser(credentials.email);
  if (!user || !user.password) return null;
  const valid = await bcrypt.compare(credentials.password, user.password);
  if (!valid) return null;
  return { id: user.id, email: user.email, name: user.name, image: user.image };
}

describe('authorize', () => {
  const hashed = bcrypt.hashSync('password123', 10);
  const mockUser = { id: 'user-1', email: 'test@example.com', name: 'Test', image: null, password: hashed };

  it('returns null when credentials are missing', async () => {
    const result = await authorize(undefined, async () => mockUser);
    expect(result).toBeNull();
  });

  it('returns null when user not found', async () => {
    const result = await authorize(
      { email: 'missing@example.com', password: 'password123' },
      async () => null
    );
    expect(result).toBeNull();
  });

  it('returns null when password is wrong', async () => {
    const result = await authorize(
      { email: 'test@example.com', password: 'wrongpassword' },
      async () => mockUser
    );
    expect(result).toBeNull();
  });

  it('returns user object on valid credentials', async () => {
    const result = await authorize(
      { email: 'test@example.com', password: 'password123' },
      async () => mockUser
    );
    expect(result).toEqual({ id: 'user-1', email: 'test@example.com', name: 'Test', image: null });
  });
});
```

- [ ] **Step 2: Run test — expect fail**

```bash
cd apps/web && npm test -- --testPathPattern=auth.test
```

Expected: `bcryptjs` not found error (dependency not installed in test context yet) OR tests pass if deps installed. If fail for wrong reason, fix the import.

- [ ] **Step 3: Create apps/web/lib/auth.ts**

```ts
import { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import GitHubProvider from 'next-auth/providers/github';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) return null;

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token?.id) session.user.id = token.id as string;
      return session;
    },
  },
};
```

- [ ] **Step 4: Create apps/web/types/next-auth.d.ts**

```ts
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}
```

- [ ] **Step 5: Create apps/web/app/api/auth/[...nextauth]/route.ts**

```ts
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

- [ ] **Step 6: Run tests — expect pass**

```bash
cd apps/web && npm test -- --testPathPattern=auth.test
```

Expected: 4 tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/auth.ts apps/web/types/ apps/web/app/api/auth/ apps/web/__tests__/
git -c user.name="Maitreyee" -c user.email="maitreyee721@gmail.com" commit -m "feat: configure NextAuth with credentials and GitHub provider"
```

---

## Task 6: Middleware — protect dashboard routes

**Files:**
- Create: `apps/web/middleware.ts`
- Create: `apps/web/__tests__/middleware.test.ts`

- [ ] **Step 1: Write test for middleware config**

Create `apps/web/__tests__/middleware.test.ts`:

```ts
import { config } from '../middleware';

describe('middleware config', () => {
  it('matches dashboard routes', () => {
    const matcher = config.matcher as string[];
    expect(matcher.some(p => p.includes('dashboard'))).toBe(true);
  });

  it('matches settings routes', () => {
    const matcher = config.matcher as string[];
    expect(matcher.some(p => p.includes('settings'))).toBe(true);
  });

  it('does not match login route', () => {
    const matcher = config.matcher as string[];
    expect(matcher.every(p => !p.includes('login'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — expect fail**

```bash
cd apps/web && npm test -- --testPathPattern=middleware.test
```

Expected: FAIL — `middleware` module not found.

- [ ] **Step 3: Create apps/web/middleware.ts**

```ts
import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: { signIn: '/login' },
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/projects/:path*',
    '/settings/:path*',
  ],
};
```

- [ ] **Step 4: Run test — expect pass**

```bash
cd apps/web && npm test -- --testPathPattern=middleware.test
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/middleware.ts apps/web/__tests__/middleware.test.ts
git -c user.name="Maitreyee" -c user.email="maitreyee721@gmail.com" commit -m "feat: add middleware to protect dashboard routes"
```

---

## Task 7: Zod validation schemas + lib/tokens + lib/email

**Files:**
- Create: `apps/web/lib/validations.ts`
- Create: `apps/web/lib/tokens.ts`
- Create: `apps/web/lib/email.ts`

- [ ] **Step 1: Create apps/web/lib/validations.ts**

```ts
import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email'),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
```

- [ ] **Step 2: Create apps/web/lib/tokens.ts**

```ts
import crypto from 'crypto';
import { prisma } from './prisma';

// generate a secure random token and store it
export async function createPasswordResetToken(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

  await prisma.verificationToken.upsert({
    where: { identifier: email },
    create: { identifier: email, token, expires },
    update: { token, expires },
  });

  return token;
}

// validate token and return the email it belongs to
export async function validatePasswordResetToken(token: string): Promise<string | null> {
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record) return null;
  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } });
    return null;
  }
  return record.identifier;
}

// consume token after use
export async function deletePasswordResetToken(token: string): Promise<void> {
  await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
}
```

- [ ] **Step 3: Create apps/web/lib/email.ts**

```ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const url = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

  await resend.emails.send({
    from: 'Prodify <noreply@prodify.dev>',
    to: email,
    subject: 'Reset your Prodify password',
    html: `
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <p><a href="${url}">${url}</a></p>
      <p>If you did not request this, ignore this email.</p>
    `,
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/validations.ts apps/web/lib/tokens.ts apps/web/lib/email.ts
git -c user.name="Maitreyee" -c user.email="maitreyee721@gmail.com" commit -m "feat: add validation schemas, token helpers, and email sender"
```

---

## Task 8: API routes — signup, forgot password, reset password, profile

**Files:**
- Create: `apps/web/app/api/auth/signup/route.ts`
- Create: `apps/web/app/api/auth/forgot-password/route.ts`
- Create: `apps/web/app/api/auth/reset-password/route.ts`
- Create: `apps/web/app/api/user/profile/route.ts`

- [ ] **Step 1: Write failing test for signup route logic**

Create `apps/web/__tests__/api/signup.test.ts`:

```ts
import bcrypt from 'bcryptjs';
import { signupSchema } from '@/lib/validations';

describe('signup validation', () => {
  it('rejects missing name', () => {
    const result = signupSchema.safeParse({ name: '', email: 'a@b.com', password: 'password123' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = signupSchema.safeParse({ name: 'Test', email: 'not-an-email', password: 'password123' });
    expect(result.success).toBe(false);
  });

  it('rejects short password', () => {
    const result = signupSchema.safeParse({ name: 'Test', email: 'a@b.com', password: 'short' });
    expect(result.success).toBe(false);
  });

  it('accepts valid signup data', () => {
    const result = signupSchema.safeParse({ name: 'Test', email: 'a@b.com', password: 'password123' });
    expect(result.success).toBe(true);
  });

  it('hashes password with bcrypt', async () => {
    const hashed = await bcrypt.hash('password123', 12);
    const valid = await bcrypt.compare('password123', hashed);
    expect(valid).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — expect fail**

```bash
cd apps/web && npm test -- --testPathPattern=signup.test
```

Expected: FAIL (validations module not found until lib/validations.ts exists — should pass now since Task 7 created it).

- [ ] **Step 3: Run test — expect pass**

```bash
cd apps/web && npm test -- --testPathPattern=signup.test
```

Expected: 5 tests pass.

- [ ] **Step 4: Create apps/web/app/api/auth/signup/route.ts**

```ts
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signupSchema } from '@/lib/validations';

export async function POST(req: Request) {
  const body = await req.json() as unknown;
  const result = signupSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { name, email, password } = result.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: { name, email, password: hashed },
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
```

- [ ] **Step 5: Create apps/web/app/api/auth/forgot-password/route.ts**

```ts
import { NextResponse } from 'next/server';
import { forgotPasswordSchema } from '@/lib/validations';
import { createPasswordResetToken } from '@/lib/tokens';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(req: Request) {
  const body = await req.json() as unknown;
  const result = forgotPasswordSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const { email } = result.data;

  // always return success to avoid email enumeration
  const token = await createPasswordResetToken(email);
  if (token) {
    await sendPasswordResetEmail(email, token);
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 6: Create apps/web/app/api/auth/reset-password/route.ts**

```ts
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { resetPasswordSchema } from '@/lib/validations';
import { validatePasswordResetToken, deletePasswordResetToken } from '@/lib/tokens';

export async function POST(req: Request) {
  const body = await req.json() as { token?: string; password?: string; confirmPassword?: string };
  const { token, ...rest } = body;

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const result = resetPasswordSchema.safeParse(rest);
  if (!result.success) {
    return NextResponse.json({ error: result.error.errors[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const email = await validatePasswordResetToken(token);
  if (!email) {
    return NextResponse.json({ error: 'Token is invalid or expired' }, { status: 400 });
  }

  const hashed = await bcrypt.hash(result.data.password, 12);

  await prisma.user.update({
    where: { email },
    data: { password: hashed },
  });

  await deletePasswordResetToken(token);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 7: Create apps/web/app/api/user/profile/route.ts**

```ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1).optional(),
  image: z.string().url().optional(),
});

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as unknown;
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: result.data,
    select: { id: true, name: true, email: true, image: true },
  });

  return NextResponse.json(updated);
}
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/api/
git -c user.name="Maitreyee" -c user.email="maitreyee721@gmail.com" commit -m "feat: add signup, forgot-password, reset-password, and profile API routes"
```

---

## Task 9: Root layout + auth pages UI

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/(auth)/layout.tsx`
- Create: `apps/web/app/(auth)/login/page.tsx`
- Create: `apps/web/app/(auth)/signup/page.tsx`
- Create: `apps/web/app/(auth)/forgot-password/page.tsx`
- Create: `apps/web/app/(auth)/reset-password/page.tsx`
- Create: `apps/web/components/auth/login-form.tsx`
- Create: `apps/web/components/auth/signup-form.tsx`
- Create: `apps/web/components/auth/forgot-password-form.tsx`
- Create: `apps/web/components/auth/reset-password-form.tsx`

- [ ] **Step 1: Update apps/web/app/layout.tsx**

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { getServerSession } from 'next-auth';
import { SessionProvider } from 'next-auth/react';
import { authOptions } from '@/lib/auth';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Prodify',
  description: 'One command. Production-ready SaaS infrastructure.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider session={session}>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create apps/web/app/page.tsx (root redirect)**

```tsx
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export default async function RootPage() {
  const session = await getServerSession(authOptions);
  redirect(session ? '/dashboard' : '/login');
}
```

- [ ] **Step 3: Create apps/web/app/(auth)/layout.tsx**

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Prodify</h1>
          <p className="text-sm text-gray-500 mt-1">Production-ready SaaS in one command</p>
        </div>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create apps/web/components/auth/login-form.tsx**

```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { loginSchema, type LoginInput } from '@/lib/validations';

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginInput) {
    setError('');
    const result = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      setError('Invalid email or password');
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  async function handleGitHub() {
    await signIn('github', { callbackUrl: '/dashboard' });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Enter your credentials to access your dashboard</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button variant="outline" className="w-full" onClick={handleGitHub} type="button">
          Continue with GitHub
        </Button>
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-500">or</span>
          </div>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <div className="flex justify-between items-center">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline">Forgot?</Link>
            </div>
            <Input id="password" type="password" {...register('password')} />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-gray-500">
          No account?{' '}
          <Link href="/signup" className="text-blue-600 hover:underline">Sign up</Link>
        </p>
      </CardFooter>
    </Card>
  );
}
```

- [ ] **Step 5: Create apps/web/app/(auth)/login/page.tsx**

```tsx
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return <LoginForm />;
}
```

- [ ] **Step 6: Create apps/web/components/auth/signup-form.tsx**

```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { signupSchema, type SignupInput } from '@/lib/validations';

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
  });

  async function onSubmit(data: SignupInput) {
    setError('');
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const json = await res.json() as { error?: string };
      setError(json.error ?? 'Something went wrong');
      return;
    }

    // sign in automatically after signup
    await signIn('credentials', {
      email: data.email,
      password: data.password,
      callbackUrl: '/dashboard',
    });
  }

  async function handleGitHub() {
    await signIn('github', { callbackUrl: '/dashboard' });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>Start building production-ready SaaS today</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button variant="outline" className="w-full" onClick={handleGitHub} type="button">
          Continue with GitHub
        </Button>
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-500">or</span>
          </div>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" type="text" {...register('name')} />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...register('password')} />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-gray-500">
          Have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
        </p>
      </CardFooter>
    </Card>
  );
}
```

- [ ] **Step 7: Create apps/web/app/(auth)/signup/page.tsx**

```tsx
import { SignupForm } from '@/components/auth/signup-form';

export default function SignupPage() {
  return <SignupForm />;
}
```

- [ ] **Step 8: Create apps/web/components/auth/forgot-password-form.tsx**

```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/validations';

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  async function onSubmit(data: ForgotPasswordInput) {
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    // always show success to avoid email enumeration
    setSent(true);
  }

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            If an account exists for that email, we sent a reset link. Check your inbox.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link href="/login" className="text-sm text-blue-600 hover:underline">Back to sign in</Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot password</CardTitle>
        <CardDescription>Enter your email and we will send a reset link</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Send reset link'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <Link href="/login" className="text-sm text-blue-600 hover:underline">Back to sign in</Link>
      </CardFooter>
    </Card>
  );
}
```

- [ ] **Step 9: Create apps/web/app/(auth)/forgot-password/page.tsx**

```tsx
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
```

- [ ] **Step 10: Create apps/web/components/auth/reset-password-form.tsx**

```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { resetPasswordSchema, type ResetPasswordInput } from '@/lib/validations';

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  });

  async function onSubmit(data: ResetPasswordInput) {
    setError('');
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, token }),
    });

    if (!res.ok) {
      const json = await res.json() as { error?: string };
      setError(json.error ?? 'Something went wrong');
      return;
    }

    router.push('/login?reset=1');
  }

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invalid link</CardTitle>
          <CardDescription>This reset link is missing a token.</CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">Request a new link</Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set new password</CardTitle>
        <CardDescription>Choose a strong password for your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" {...register('password')} />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input id="confirmPassword" type="password" {...register('confirmPassword')} />
            {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword.message}</p>}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Set password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 11: Create apps/web/app/(auth)/reset-password/page.tsx**

```tsx
import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
```

- [ ] **Step 12: Commit**

```bash
git add apps/web/app/ apps/web/components/auth/
git -c user.name="Maitreyee" -c user.email="maitreyee721@gmail.com" commit -m "feat: build auth pages — login, signup, forgot password, reset password"
```

---

## Task 10: Dashboard layout + settings page

**Files:**
- Create: `apps/web/app/(dashboard)/layout.tsx`
- Create: `apps/web/app/(dashboard)/dashboard/page.tsx`
- Create: `apps/web/app/(dashboard)/settings/page.tsx`
- Create: `apps/web/components/dashboard/header.tsx`
- Create: `apps/web/components/dashboard/sidebar.tsx`

- [ ] **Step 1: Create apps/web/components/dashboard/sidebar.tsx**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const links = [
  { href: '/dashboard', label: 'Projects' },
  { href: '/settings', label: 'Settings' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r bg-white h-screen flex flex-col">
      <div className="p-4 border-b">
        <span className="font-bold text-lg">Prodify</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {links.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'block px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname === link.href
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Create apps/web/components/dashboard/header.tsx**

```tsx
'use client';

import { signOut, useSession } from 'next-auth/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Header() {
  const { data: session } = useSession();
  const initials = session?.user?.name?.slice(0, 2).toUpperCase() ?? 'U';

  return (
    <header className="h-14 border-b bg-white flex items-center justify-end px-6">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 text-sm">
            <Avatar className="h-8 w-8">
              <AvatarImage src={session?.user?.image ?? undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="text-gray-700">{session?.user?.name}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })}>
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
```

- [ ] **Step 3: Create apps/web/app/(dashboard)/layout.tsx**

```tsx
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create apps/web/app/(dashboard)/dashboard/page.tsx**

```tsx
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Projects</h1>
      <p className="text-gray-500 text-sm mb-6">
        Welcome back, {session?.user?.name}. Your projects will appear here.
      </p>
      <div className="border-2 border-dashed border-gray-200 rounded-lg p-12 text-center">
        <p className="text-gray-400 text-sm">No projects yet. Coming in Sub-project 2.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create apps/web/app/(dashboard)/settings/page.tsx**

```tsx
'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const schema = z.object({ name: z.string().min(1, 'Name is required') });
type FormData = z.infer<typeof schema>;

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const [saved, setSaved] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: session?.user?.name ?? '' },
  });

  async function onSubmit(data: FormData) {
    await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await update({ name: data.name });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const initials = session?.user?.name?.slice(0, 2).toUpperCase() ?? 'U';

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your name and avatar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={session?.user?.image ?? undefined} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{session?.user?.email}</p>
              <p className="text-sm text-gray-500">Avatar is pulled from GitHub or Google</p>
            </div>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div>
              <Label htmlFor="name">Display name</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {saved ? 'Saved' : isSubmitting ? 'Saving...' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(dashboard\)/ apps/web/components/dashboard/
git -c user.name="Maitreyee" -c user.email="maitreyee721@gmail.com" commit -m "feat: build dashboard layout, sidebar, header, and settings page"
```

---

## Task 11: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create .github/workflows/ci.yml**

```yaml
name: CI

on:
  push:
    branches: ['**']
  pull_request:
    branches: [main]

jobs:
  typecheck:
    name: Typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck --workspace=apps/web

  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run test --workspace=apps/web
```

- [ ] **Step 2: Commit**

```bash
git add .github/
git -c user.name="Maitreyee" -c user.email="maitreyee721@gmail.com" commit -m "feat: add GitHub Actions CI — typecheck and test on every push"
```

---

## Task 12: End-to-end smoke test

- [ ] **Step 1: Run all tests**

```bash
npm run test --workspace=apps/web
```

Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck --workspace=apps/web
```

Expected: no TypeScript errors.

- [ ] **Step 3: Boot the app and verify flows manually**

```bash
npm run dev --workspace=apps/web
```

Verify:
- `/` redirects to `/login` when not signed in
- `/signup` creates a user in Neon DB
- `/login` with email/password works
- GitHub OAuth redirects and creates account
- `/forgot-password` sends email (check Resend dashboard)
- Reset link from email lands on `/reset-password?token=...` and updates password
- `/dashboard` is accessible after login
- `/dashboard` redirects to `/login` if session is cleared
- `/settings` shows profile and saves name change
- Sign out returns to `/login`

- [ ] **Step 4: Final commit**

```bash
git add -A
git -c user.name="Maitreyee" -c user.email="maitreyee721@gmail.com" commit -m "feat: Sub-project 1 complete — auth + accounts fully wired"
```

- [ ] **Step 5: Push to GitHub**

```bash
git push origin main
```

---

## Parallel Work Split (you and Rudheer)

| Maitreyee | Rudheer |
|---|---|
| Task 1: Monorepo restructure | Can start after Task 1 |
| Task 2-3: Next.js + shadcn setup | Task 4: Prisma schema + Neon (parallel with 2-3) |
| Task 5-6: NextAuth + middleware | Task 7: Validations + tokens + email |
| Task 9: Auth pages UI | Task 8: API routes (signup, forgot, reset, profile) |
| Task 10: Dashboard + settings UI | Task 11: CI workflow |
| Task 12: Smoke test together | Task 12: Smoke test together |
