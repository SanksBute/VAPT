import type { ScannerTypeValue } from '@sentinelx/shared';
import type { IScanner } from '../interfaces/scanner.interface';

export class ScannerRegistry {
  private static instance: ScannerRegistry;
  private readonly scanners = new Map<ScannerTypeValue, IScanner>();

  static getInstance(): ScannerRegistry {
    if (!ScannerRegistry.instance) {
      ScannerRegistry.instance = new ScannerRegistry();
    }
    return ScannerRegistry.instance;
  }

  register(scanner: IScanner): void {
    this.scanners.set(scanner.metadata.type, scanner);
  }

  get(type: ScannerTypeValue): IScanner {
    const scanner = this.scanners.get(type);
    if (!scanner) {
      throw new Error(`Scanner '${type}' is not registered`);
    }
    return scanner;
  }

  has(type: ScannerTypeValue): boolean {
    return this.scanners.has(type);
  }

  getAll(): IScanner[] {
    return [...this.scanners.values()];
  }

  getAvailable(): Promise<IScanner[]> {
    return Promise.all(
      [...this.scanners.values()].map(async (scanner) => {
        const isAvailable = await scanner.isAvailable().catch(() => false);
        return isAvailable ? scanner : null;
      }),
    ).then((results) => results.filter((s): s is IScanner => s !== null));
  }

  unregister(type: ScannerTypeValue): void {
    this.scanners.delete(type);
  }

  clear(): void {
    this.scanners.clear();
  }
}
