import { ScanStatus } from '@prisma/client';
import type { PinoLogger } from 'nestjs-pino';

import { ScanExecutorService } from './scan-executor.service';

interface ScanJobDispatchFixture {
  jobId: string;
  scanId: string;
  organizationId: string;
  scanner: string;
  target: string;
  targetType: string;
  configuration: Record<string, unknown>;
}

interface PublishedMessage {
  payload: {
    success: boolean;
    errorMessage?: string;
    findings: unknown[];
    demoMode?: boolean;
  };
}

function makeLogger(): PinoLogger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  } as unknown as PinoLogger;
}

function makePrisma(): {
  scannerJob: { update: jest.Mock; findMany: jest.Mock };
  scan: { updateMany: jest.Mock; update: jest.Mock };
} {
  return {
    scannerJob: {
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    scan: {
      updateMany: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({ organizationId: 'org-1' }),
    },
  };
}

type JobHandler = (msg: { payload: ScanJobDispatchFixture }) => Promise<void>;

interface Harness {
  service: ScanExecutorService;
  published: PublishedMessage[];
  getHandler: () => JobHandler;
}

function buildService(demoMode: boolean): Harness {
  const published: PublishedMessage[] = [];
  const prisma = makePrisma();
  let capturedHandler: JobHandler | undefined;
  const consume = jest.fn((_queueName: string, handler: JobHandler) => {
    capturedHandler = handler;
    return Promise.resolve();
  });
  const queue = {
    consume,
    sendToQueue: jest.fn((_queueName: string, message: PublishedMessage) => {
      published.push(message);
      return Promise.resolve(true);
    }),
  };
  const gateway = { emitScanProgress: jest.fn() };
  const config = { get: jest.fn().mockReturnValue(demoMode) };

  const service = new ScanExecutorService(
    makeLogger(),
    prisma as unknown as ConstructorParameters<typeof ScanExecutorService>[1],
    queue as unknown as ConstructorParameters<typeof ScanExecutorService>[2],
    gateway as unknown as ConstructorParameters<typeof ScanExecutorService>[3],
    config as unknown as ConstructorParameters<typeof ScanExecutorService>[4],
  );

  return {
    service,
    published,
    getHandler: (): JobHandler => {
      if (!capturedHandler) {
        throw new Error('onModuleInit did not register a queue handler');
      }
      return capturedHandler;
    },
  };
}

async function dispatchJob(harness: Harness, job: ScanJobDispatchFixture): Promise<void> {
  await harness.service.onModuleInit();
  await harness.getHandler()({ payload: job });
}

describe('ScanExecutorService — no-simulation-on-failure', () => {
  it('fails a job for an unregistered scanner when DEMO_MODE is false, without simulating', async () => {
    const harness = buildService(false);

    await dispatchJob(harness, {
      jobId: 'job-1',
      scanId: 'scan-1',
      organizationId: 'org-1',
      scanner: 'MASSCAN', // registered nowhere in the executor's scanner map
      target: '10.0.0.1',
      targetType: 'ip',
      configuration: {},
    });

    expect(harness.published).toHaveLength(1);
    expect(harness.published[0]?.payload.success).toBe(false);
    expect(harness.published[0]?.payload.findings).toEqual([]);
    expect(harness.published[0]?.payload.errorMessage).toMatch(/not implemented/);
    expect(harness.published[0]?.payload.demoMode).not.toBe(true);
  });

  it('fails a job when the scanner binary is unavailable and DEMO_MODE is false, without simulating', async () => {
    const harness = buildService(false);

    // SEMGREP is registered, but the semgrep binary is not installed in the
    // test environment, so isAvailable() resolves false — exercising the
    // real (non-mocked) scanner's availability check rather than mocking it.
    await dispatchJob(harness, {
      jobId: 'job-2',
      scanId: 'scan-2',
      organizationId: 'org-1',
      scanner: 'SEMGREP',
      target: '/tmp/sentinelx-test-repo',
      targetType: 'repository',
      configuration: {},
    });

    expect(harness.published).toHaveLength(1);
    expect(harness.published[0]?.payload.success).toBe(false);
    expect(harness.published[0]?.payload.findings).toEqual([]);
    expect(harness.published[0]?.payload.errorMessage).toMatch(/not installed/);
  }, 15000);

  it('still simulates for an unregistered scanner when DEMO_MODE is true, and stamps the result', async () => {
    const harness = buildService(true);

    await dispatchJob(harness, {
      jobId: 'job-3',
      scanId: 'scan-3',
      organizationId: 'org-1',
      scanner: 'MASSCAN',
      target: '10.0.0.1',
      targetType: 'ip',
      configuration: {},
    });

    expect(harness.published).toHaveLength(1);
    expect(harness.published[0]?.payload.success).toBe(true);
    expect(harness.published[0]?.payload.demoMode).toBe(true);
  }, 10000);
});

describe('ScanExecutorService — ScanStatus', () => {
  it('never publishes a successful result for a scan that has no working scanner', async () => {
    const harness = buildService(false);

    await dispatchJob(harness, {
      jobId: 'job-4',
      scanId: 'scan-4',
      organizationId: 'org-1',
      scanner: 'MASSCAN',
      target: '10.0.0.1',
      targetType: 'ip',
      configuration: {},
    });

    const [message] = harness.published;
    expect(message?.payload.success).toBe(false);
    expect(ScanStatus.FAILED).toBe('FAILED');
  });
});
