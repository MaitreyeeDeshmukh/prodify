import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GitHubProvider from 'next-auth/providers/github';
import { insforge } from './insforge';

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: { scope: 'read:user user:email repo' },
      },
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const { data, error } = await insforge.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        });

        if (error || !data?.user) return null;

        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.profile?.name ?? null,
          image: data.user.profile?.avatar_url ?? null,
          accessToken: data.accessToken,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.accessToken = (user as { accessToken?: string }).accessToken;
      }
      // Capture GitHub OAuth access token for repo API calls
      if (account?.provider === 'github' && account.access_token) {
        token.githubAccessToken = account.access_token;
        token.githubLogin = (account as { login?: string }).login;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) session.user.id = token.id as string;
      if (token?.githubAccessToken) {
        (session as { githubAccessToken?: string }).githubAccessToken = token.githubAccessToken as string;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      if (account?.provider === 'github') {
        // Upsert user into InsForge users table
        await insforge.database
          .from('users')
          .upsert(
            {
              id: user.id,
              email: user.email!,
              name: user.name ?? null,
              image: user.image ?? null,
            },
            { onConflict: 'email' }
          );

        // Store GitHub connection
        const githubProfile = profile as { login?: string; avatar_url?: string } | undefined;
        if (account.access_token && githubProfile?.login) {
          await insforge.database
            .from('github_connections')
            .upsert(
              {
                userId: user.id,
                github_login: githubProfile.login,
                github_avatar: githubProfile.avatar_url ?? null,
                access_token: account.access_token,
              },
              { onConflict: 'userId' }
            );
        }
      }
      return true;
    },
  },
};
