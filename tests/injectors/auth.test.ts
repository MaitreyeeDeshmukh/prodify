// ─── Auth Injector Tests ──────────────────────────────────────────────────────
import { buildAuthFiles } from '../../src/injectors/auth';

describe('buildAuthFiles', () => {
  it('returns NextAuth config file for individuals with Google+GitHub', () => {
    const files = buildAuthFiles('individuals');

    const paths = files.map(f => f.relativePath);
    expect(paths).toContain('prodify-layer/auth/[...nextauth].ts');
    expect(paths).toContain('prodify-layer/routes/api/auth/[...nextauth]/route.ts');

    const config = files.find(f => f.relativePath === 'prodify-layer/auth/[...nextauth].ts')!;
    expect(config.content).toContain('GoogleProvider');
    expect(config.content).toContain('GitHubProvider');
    expect(config.content).not.toContain('SAML');
  });

  it('returns NextAuth config for teams with org scoping', () => {
    const files = buildAuthFiles('teams');

    const config = files.find(f => f.relativePath === 'prodify-layer/auth/[...nextauth].ts')!;
    expect(config.content).toContain('GoogleProvider');
    expect(config.content).toContain('GitHubProvider');
    expect(config.content).toContain('organizationId');
  });

  it('returns SAML-ready placeholder for enterprise', () => {
    const files = buildAuthFiles('enterprise');

    const config = files.find(f => f.relativePath === 'prodify-layer/auth/[...nextauth].ts')!;
    expect(config.content).toContain('SAML');
  });

  it('always returns exactly 2 files', () => {
    expect(buildAuthFiles('individuals')).toHaveLength(2);
    expect(buildAuthFiles('teams')).toHaveLength(2);
    expect(buildAuthFiles('enterprise')).toHaveLength(2);
  });
});
