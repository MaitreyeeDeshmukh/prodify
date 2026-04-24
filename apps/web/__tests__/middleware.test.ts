import { config } from '../proxy';

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
