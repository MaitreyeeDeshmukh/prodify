// ─── Logger Tests ─────────────────────────────────────────────────────────────
jest.mock('chalk', () => ({
  cyan: (s: string) => s,
  green: (s: string) => s,
  yellow: (s: string) => s,
  red: (s: string) => s,
  gray: (s: string) => s,
  blue: (s: string) => s,
  bold: { magenta: (s: string) => s },
}));

import { setVerbose, info, success, warn, error, verbose, dryRun, header } from '../src/logger';

describe('logger', () => {
  let consoleSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    setVerbose(false);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('info() calls console.log once', () => {
    info('test message');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });

  it('success() calls console.log once', () => {
    success('it worked');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });

  it('warn() calls console.log once', () => {
    warn('careful');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });

  it('error() calls console.error once', () => {
    error('something broke');
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it('verbose() does NOT log when verbose mode is off', () => {
    setVerbose(false);
    verbose('detailed info');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('verbose() logs when verbose mode is on', () => {
    setVerbose(true);
    verbose('detailed info');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });

  it('dryRun() calls console.log once', () => {
    dryRun('would create file.ts');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });

  it('header() calls console.log once', () => {
    header('Prodify');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });
});
