// ─── DB Injector Tests ────────────────────────────────────────────────────────
import { buildDbFiles } from '../../src/injectors/db';

describe('buildDbFiles', () => {
  it('returns a single schema file', () => {
    const files = buildDbFiles('individuals');
    expect(files).toHaveLength(1);
    expect(files[0].relativePath).toBe('prodify-layer/db/schema.prisma');
  });

  it('individuals schema has User and Subscription but no Organization', () => {
    const files = buildDbFiles('individuals');
    const schema = files[0].content;

    expect(schema).toContain('model User');
    expect(schema).toContain('model Subscription');
    expect(schema).toContain('model WebhookEvent');
    expect(schema).not.toContain('model Organization');
  });

  it('teams schema includes Organization and Membership models', () => {
    const files = buildDbFiles('teams');
    const schema = files[0].content;

    expect(schema).toContain('model Organization');
    expect(schema).toContain('model Membership');
    expect(schema).toContain('model User');
  });

  it('enterprise schema includes Organization, Membership, and samlConfig', () => {
    const files = buildDbFiles('enterprise');
    const schema = files[0].content;

    expect(schema).toContain('model Organization');
    expect(schema).toContain('samlConfig');
  });
});
