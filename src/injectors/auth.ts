// ─── Auth Injector ────────────────────────────────────────────────────────────
// Generates NextAuth.js configuration files from a selected array of auth methods.
// Instead of 3 fixed templates, this uses composition: each selected auth method
// adds a provider block to the generated config.
//
//   google     → GoogleProvider
//   github     → GitHubProvider
//   magic-link → EmailProvider with Resend transport
//   email-pass → CredentialsProvider with bcrypt
//   saml       → BoxyHQ SAMLProvider (enterprise only)
import type { FileEntry, AuthMethod, UserType } from '../types';

// ── Provider block generators ─────────────────────────────────────────────────

function googleProvider(): string {
  return `    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),`;
}

function githubProvider(): string {
  return `    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),`;
}

function magicLinkProvider(): string {
  return `    EmailProvider({
      server: {
        host: 'smtp.resend.com',
        port: 465,
        auth: { user: 'resend', pass: process.env.RESEND_API_KEY! },
      },
      from: process.env.FROM_EMAIL!,
    }),`;
}

function emailPassProvider(): string {
  return `    CredentialsProvider({
      name: 'Email & Password',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        // TODO: look up user in InsForge DB, verify bcrypt hash
        // const { data: user } = await insforge.database.from('users')
        //   .select('id, email, password_hash').eq('email', credentials.email).single();
        // if (!user) return null;
        // const valid = await bcrypt.compare(credentials.password, user.password_hash);
        // if (!valid) return null;
        // return { id: user.id, email: user.email };
        throw new Error('Implement: fetch user + bcrypt.compare password_hash');
      },
    }),`;
}

function samlProvider(): string {
  return `    // Enterprise SAML / SSO via BoxyHQ
    // See: https://boxyhq.com/docs/jackson/deploy
    {
      id: 'saml',
      name: 'Enterprise SSO (SAML)',
      type: 'oauth' as const,
      authorization: { url: process.env.SAML_AUTHORIZATION_URL! },
      token:         { url: process.env.SAML_TOKEN_URL! },
      userinfo:      { url: process.env.SAML_USERINFO_URL! },
      clientId:      process.env.SAML_CLIENT_ID!,
      clientSecret:  process.env.SAML_CLIENT_SECRET!,
      profile(profile: any) {
        return { id: profile.id, name: profile.name, email: profile.email };
      },
    },`;
}

// ── Import statements ─────────────────────────────────────────────────────────

function buildImports(authMethods: AuthMethod[]): string {
  const lines = [`import NextAuth from 'next-auth';`];
  if (authMethods.includes('google'))     lines.push(`import GoogleProvider from 'next-auth/providers/google';`);
  if (authMethods.includes('github'))     lines.push(`import GitHubProvider from 'next-auth/providers/github';`);
  if (authMethods.includes('magic-link')) lines.push(`import EmailProvider from 'next-auth/providers/email';`);
  if (authMethods.includes('email-pass')) lines.push(`import CredentialsProvider from 'next-auth/providers/credentials';`);
  lines.push(`import { insforge } from '@/lib/insforge';`);
  return lines.join('\n');
}

// ── Teams / enterprise session callback ───────────────────────────────────────

function buildJwtCallback(userType: UserType): string {
  if (userType === 'teams' || userType === 'enterprise') {
    return `    async jwt({ token, user }: { token: any; user: any }) {
      if (user?.id) {
        const { data: membership } = await insforge.database
          .from('memberships')
          .select('organization_id')
          .eq('user_id', user.id)
          .single();
        if (membership) token.organizationId = membership.organization_id;
      }
      return token;
    },`;
  }
  return '';
}

// ── Config assembler ──────────────────────────────────────────────────────────

function buildNextAuthConfig(authMethods: AuthMethod[], userType: UserType): string {
  const imports = buildImports(authMethods);
  const providerLines: string[] = [];
  if (authMethods.includes('google'))     providerLines.push(googleProvider());
  if (authMethods.includes('github'))     providerLines.push(githubProvider());
  if (authMethods.includes('magic-link')) providerLines.push(magicLinkProvider());
  if (authMethods.includes('email-pass')) providerLines.push(emailPassProvider());
  if (authMethods.includes('saml'))       providerLines.push(samlProvider());

  const jwtCallback = buildJwtCallback(userType);
  const sessionOrgLine = (userType === 'teams' || userType === 'enterprise')
    ? '\n      if (token?.organizationId) session.user.organizationId = token.organizationId;'
    : '';

  return `// prodify-layer/auth/[...nextauth].ts
// Generated by Prodify — NextAuth.js config
// Auth methods: ${authMethods.join(', ')}
// User type: ${userType}
${imports}

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET!,
  providers: [
${providerLines.join('\n')}
  ],
  session: { strategy: '${authMethods.includes('email-pass') ? 'jwt' : 'jwt'}' as const },
  callbacks: {
    async signIn({ user }: { user: any }) {
      // Upsert user into InsForge on every sign-in
      await insforge.database
        .from('users')
        .upsert({ email: user.email, name: user.name, image: user.image }, { onConflict: 'email' });
      return true;
    },
${jwtCallback ? jwtCallback + '\n' : ''}    async session({ session, token }: { session: any; token: any }) {
      if (token?.sub) session.user.id = token.sub;${sessionOrgLine}
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
    error:  '/auth/error',
  },
};

export default NextAuth(authOptions);
`;
}

// ── Route handler template ────────────────────────────────────────────────────

const routeHandler = `// prodify-layer/routes/api/auth/[...nextauth]/route.ts
// Drop this into app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import { authOptions } from '@/prodify-layer/auth/[...nextauth]';

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
`;

// ── Public API ────────────────────────────────────────────────────────────────

export function buildAuthFiles(authMethods: AuthMethod[], userType: UserType): FileEntry[] {
  const configContent = buildNextAuthConfig(authMethods, userType);

  return [
    {
      relativePath: 'prodify-layer/auth/[...nextauth].ts',
      content: configContent,
    },
    {
      relativePath: 'prodify-layer/routes/api/auth/[...nextauth]/route.ts',
      content: routeHandler,
    },
  ];
}
