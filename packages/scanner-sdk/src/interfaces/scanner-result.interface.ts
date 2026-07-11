export interface ScannerResultInterface {
  scanner: string;
  target: string;
  findings: unknown[];
  rawOutput: string;
  metadata: Record<string, unknown>;
}
