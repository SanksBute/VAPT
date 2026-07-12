import { asInternal, makeScannerContext } from '../test-utils/mock-context';

import { NucleiParser } from './nuclei.parser';

const VALID_TARGET = 'example.com';
const OUTPUT_FILE = '/tmp/out.jsonl';

interface NucleiParserInternal {
  buildNucleiArgs(target: string, config: Record<string, unknown>, outputFile: string): string[];
}

describe('NucleiParser command construction', () => {
  let parser: NucleiParser;
  let internal: NucleiParserInternal;

  beforeEach(() => {
    parser = new NucleiParser();
    internal = asInternal<NucleiParserInternal>(parser);
  });

  it('rejects a target injection payload before scanning', async () => {
    const context = makeScannerContext({ target: `${VALID_TARGET}; touch /tmp/pwned` });
    await expect(parser.scan(context)).rejects.toThrow(/Invalid scan target/);
  });

  it('accepts a valid https URL target and does not reject on target validation', async () => {
    const context = makeScannerContext({ target: 'https://example.com/', timeout: 1 });
    // The nuclei binary is unlikely to be installed in the test environment;
    // scan() swallows exec errors and falls back to an empty raw result, so
    // resolving (rather than throwing "Invalid scan target") proves the
    // target passed validation.
    await expect(parser.scan(context)).resolves.toEqual(expect.any(String));
  });

  it('rejects an invalid tag', () => {
    expect(() =>
      internal.buildNucleiArgs(VALID_TARGET, { tags: ['cve; rm -rf /'] }, OUTPUT_FILE),
    ).toThrow(/Invalid Nuclei tag/);
  });

  it('rejects an invalid severity', () => {
    expect(() =>
      internal.buildNucleiArgs(VALID_TARGET, { severity: ['critical; rm -rf /'] }, OUTPUT_FILE),
    ).toThrow(/Invalid Nuclei severity/);
  });

  it('rejects a template path with directory traversal', () => {
    expect(() =>
      internal.buildNucleiArgs(VALID_TARGET, { templates: ['../../etc/passwd'] }, OUTPUT_FILE),
    ).toThrow(/Invalid Nuclei template path/);
  });

  it('rejects a non-numeric rate limit', () => {
    expect(() =>
      internal.buildNucleiArgs(VALID_TARGET, { rateLimit: '150; rm -rf /' }, OUTPUT_FILE),
    ).toThrow(/Invalid rate limit/);
  });

  it('builds a well-formed argv array for valid configuration', () => {
    const args = internal.buildNucleiArgs(
      VALID_TARGET,
      { tags: ['cve', 'rce'], severity: ['critical', 'high'] },
      OUTPUT_FILE,
    );
    expect(args).toEqual(expect.arrayContaining(['-target', VALID_TARGET, '-tags', 'cve,rce']));
  });
});

describe('NucleiParser.parse', () => {
  const parser = new NucleiParser();

  it('normalizes a JSONL result line into a finding', async () => {
    const line = JSON.stringify({
      'template-id': 'exposed-panel',
      info: { name: 'Exposed Admin Panel', severity: 'high', description: 'Panel exposed' },
      host: 'https://example.com',
      matched: 'https://example.com/admin',
    });

    const context = makeScannerContext({ target: 'https://example.com' });
    const findings = await parser.parse(line, context);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toBe('Exposed Admin Panel');
    expect(findings[0]?.severity).toBe('HIGH');
    expect(findings[0]?.url).toBe('https://example.com/admin');
  });

  it('skips malformed JSON lines instead of throwing', async () => {
    const context = makeScannerContext();
    const findings = await parser.parse('not json\n{also not json', context);
    expect(findings).toEqual([]);
  });
});
