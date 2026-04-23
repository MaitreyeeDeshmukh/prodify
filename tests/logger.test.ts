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

  it('info() logs the ℹ icon and message', () => {
    info('test message');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('ℹ', 'test message');
  });

  it('success() logs the ✓ icon and message', () => {
    success('it worked');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('✓', 'it worked');
  });

  it('warn() logs the ⚠ icon and message', () => {
    warn('careful');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('⚠', 'careful');
  });

  it('error() calls console.error with ✗ icon and message', () => {
    error('something broke');
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('✗', 'something broke');
  });

  it('verbose() does NOT log when verbose mode is off', () => {
    setVerbose(false);
    verbose('detailed info');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('verbose() logs [verbose] prefix and message when on', () => {
    setVerbose(true);
    verbose('detailed info');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('[verbose]', 'detailed info');
  });

  it('dryRun() logs [dry-run] prefix and message', () => {
    dryRun('would create file.ts');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('[dry-run]', 'would create file.ts');
  });

  it('header() logs message wrapped in newlines', () => {
    header('Prodify');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('\nProdify\n');
  });
});
