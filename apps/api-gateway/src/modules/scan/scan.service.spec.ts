import { ForbiddenException } from '@nestjs/common';
import type { AuthContext } from '@sentinelx/shared';
import type { PinoLogger } from 'nestjs-pino';

import type { CreateScanDto } from './dto/create-scan.dto';
import { ScanService } from './scan.service';

const ORG_ID = 'org-1';
const OWNED_HOST = 'owned.example.com';

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

interface ScanCreateArgs {
  data: {
    scanType: string;
    priority?: number;
    status: string;
    targets?: { createMany?: { data: Array<{ value: string; type: string }> } };
  };
}

interface WhereArgs {
  where: Record<string, unknown>;
}

interface PrismaMock {
  asset: { findFirst: jest.Mock };
  organization: { findUnique: jest.Mock };
  scanProfile: { findFirst: jest.Mock };
  project: { findFirst: jest.Mock };
  scan: { create: jest.Mock; update: jest.Mock };
  scannerJob: { create: jest.Mock };
}

function makePrisma(): PrismaMock {
  return {
    asset: { findFirst: jest.fn() },
    organization: {
      findUnique: jest.fn().mockResolvedValue({ maxScansPerMonth: -1 }),
    },
    scanProfile: { findFirst: jest.fn() },
    project: { findFirst: jest.fn() },
    scan: {
      create: jest.fn().mockImplementation((args: ScanCreateArgs) =>
        Promise.resolve({
          id: 'scan-1',
          scanType: args.data.scanType,
          priority: args.data.priority,
          status: args.data.status,
          targets: (args.data.targets?.createMany?.data ?? []).map((t, i) => ({
            id: `target-${i}`,
            value: t.value,
            type: t.type,
          })),
        }),
      ),
      update: jest.fn().mockResolvedValue({}),
    },
    scannerJob: {
      create: jest
        .fn()
        .mockImplementation((args: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'job-1', ...args.data }),
        ),
    },
  };
}

interface QueueMock {
  publish: jest.Mock;
  sendToQueue: jest.Mock;
}

interface Harness {
  service: ScanService;
  prisma: PrismaMock;
  queue: QueueMock;
}

function buildService(): Harness {
  const prisma = makePrisma();
  const queue: QueueMock = {
    publish: jest.fn().mockResolvedValue(undefined),
    sendToQueue: jest.fn().mockResolvedValue(undefined),
  };
  const redis = { get: jest.fn(), set: jest.fn() };
  const notifications = {};
  const audit = { log: jest.fn().mockResolvedValue(undefined) };

  const service = new ScanService(
    makeLogger(),
    prisma as never,
    queue as never,
    redis as never,
    notifications as never,
    audit as never,
  );

  return { service, prisma, queue };
}

const USER: AuthContext = {
  userId: 'user-1',
  organizationId: ORG_ID,
  email: 'a@b.c',
  roles: [],
} as unknown as AuthContext;

function dtoFor(targets: string[]): CreateScanDto {
  return {
    name: 'Test scan',
    scanType: 'PORT_SCAN',
    targets,
  } as unknown as CreateScanDto;
}

describe('ScanService.createScan target-scope authorization', () => {
  it('rejects a target with no owning asset in the org and creates no scan or jobs', async () => {
    const { service, prisma, queue } = buildService();
    prisma.asset.findFirst.mockResolvedValue(null); // nothing owned

    await expect(
      service.createScan(dtoFor(['evil.example.com']), USER),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.scan.create).not.toHaveBeenCalled();
    expect(prisma.scannerJob.create).not.toHaveBeenCalled();
    expect(queue.sendToQueue).not.toHaveBeenCalled();
  });

  it('rejects a target owned by a different organization (proves org scoping)', async () => {
    const { service, prisma } = buildService();
    // findFirst is org-scoped (organizationId: ORG_ID); a foreign-owned asset does not match.
    prisma.asset.findFirst.mockResolvedValue(null);

    await expect(
      service.createScan(dtoFor(['other-org-host.example.com']), USER),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // The query must have been scoped to the requesting org.
    const scopeCalls = prisma.asset.findFirst.mock.calls as Array<[WhereArgs]>;
    expect(scopeCalls[0]?.[0]?.where).toMatchObject({
      organizationId: ORG_ID,
      deletedAt: null,
      status: 'ACTIVE',
    });
    expect(prisma.scan.create).not.toHaveBeenCalled();
  });

  it('names the specific out-of-scope target(s) in the rejection message', async () => {
    const { service, prisma } = buildService();
    prisma.asset.findFirst.mockImplementation((args: WhereArgs) =>
      // owns OWNED_HOST only
      Promise.resolve(
        JSON.stringify(args.where).includes(OWNED_HOST) ? { id: 'asset-1' } : null,
      ),
    );

    await expect(
      service.createScan(dtoFor([OWNED_HOST, 'rogue.example.com']), USER),
    ).rejects.toThrow(/rogue\.example\.com/);
  });

  it('rejects CIDR targets with a clear message even if a host inside is owned', async () => {
    const { service, prisma } = buildService();
    prisma.asset.findFirst.mockResolvedValue({ id: 'asset-1' });

    await expect(service.createScan(dtoFor(['10.0.0.0/24']), USER)).rejects.toThrow(/CIDR/);
    expect(prisma.scan.create).not.toHaveBeenCalled();
  });

  it('accepts a target matching an ACTIVE owned asset and dispatches jobs', async () => {
    const { service, prisma, queue } = buildService();
    prisma.asset.findFirst.mockResolvedValue({ id: 'asset-1' }); // owned

    const scan = await service.createScan(dtoFor([OWNED_HOST]), USER);

    expect(scan.id).toBe('scan-1');
    expect(prisma.scan.create).toHaveBeenCalledTimes(1);
    expect(prisma.scannerJob.create).toHaveBeenCalled();
    expect(queue.sendToQueue).toHaveBeenCalled();
  });

  it('matches an IP target via ipAddresses containment', async () => {
    const { service, prisma } = buildService();
    prisma.asset.findFirst.mockResolvedValue({ id: 'asset-1' });

    await service.createScan(dtoFor(['192.168.1.10']), USER);

    const ipCalls = prisma.asset.findFirst.mock.calls as Array<[WhereArgs]>;
    expect(ipCalls[0]?.[0]?.where).toMatchObject({ ipAddresses: { has: '192.168.1.10' } });
  });
});
