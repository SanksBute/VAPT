import type { ScannerContext } from '../interfaces/scanner.interface';

export function makeScannerContext(overrides: Partial<ScannerContext> = {}): ScannerContext {
  return {
    jobId: 'job-1',
    scanId: 'scan-1',
    organizationId: 'org-1',
    target: 'example.com',
    targetType: 'hostname',
    configuration: {},
    workDir: '/tmp/sentinelx-test',
    outputDir: '/tmp/sentinelx-test',
    timeout: 60,
    onProgress: jest.fn(() => Promise.resolve()),
    onEvent: jest.fn(() => Promise.resolve()),
    ...overrides,
  };
}

/**
 * Narrows an instance to an interface exposing its private members, for
 * whitebox unit tests of argument builders that should stay private in
 * production code. Avoids `any` so `no-unsafe-*` lint rules stay meaningful
 * everywhere else.
 */
export function asInternal<T>(instance: object): T {
  return instance as unknown as T;
}
