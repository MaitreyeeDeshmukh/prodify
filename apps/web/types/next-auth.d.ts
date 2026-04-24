import { DefaultSession, DefaultJWT } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
    githubAccessToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id?: string;
    accessToken?: string;
    githubAccessToken?: string;
    githubLogin?: string;
  }
}
