// ─── DB Injector Tests ────────────────────────────────────────────────────────
import { buildDbFiles } from '../../src/injectors/db';

describe('buildDbFiles', () => {
  it('returns two files: insforge client and sql schema', () => {
    const files = buildDbFiles('individuals');
    expect(files).toHaveLength(2);
    expect(files.map(f => f.relativePath)).toContain('prodify-layer/db/insforge.ts');
    expect(files.map(f => f.relativePath)).toContain('prodify-layer/db/schema.sql');
  });

  it('individuals schema has users and subscriptions but no organizations', () => {
    const files = buildDbFiles('individuals');
    const schema = files.find(f => f.relativePath === 'prodify-layer/db/schema.sql')!.content;

    expect(schema).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS subscriptions');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS webhook_events');
    expect(schema).not.toContain('CREATE TABLE IF NOT EXISTS organizations');
  });

  it('teams schema includes organizations and memberships tables', () => {
    const files = buildDbFiles('teams');
    const schema = files.find(f => f.relativePath === 'prodify-layer/db/schema.sql')!.content;

    expect(schema).toContain('CREATE TABLE IF NOT EXISTS organizations');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS memberships');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS users');
  });

  it('enterprise schema includes organizations with saml_config and memberships', () => {
    const files = buildDbFiles('enterprise');
    const schema = files.find(f => f.relativePath === 'prodify-layer/db/schema.sql')!.content;

    expect(schema).toContain('CREATE TABLE IF NOT EXISTS organizations');
    expect(schema).toContain('saml_config');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS memberships');
  });

  it('insforge client references @insforge/sdk', () => {
    const files = buildDbFiles('individuals');
    const client = files.find(f => f.relativePath === 'prodify-layer/db/insforge.ts')!.content;

    expect(client).toContain('@insforge/sdk');
    expect(client).toContain('createClient');
    expect(client).toContain('INSFORGE_URL');
  });
});
