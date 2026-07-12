import { asInternal, makeScannerContext } from '../test-utils/mock-context';

import { SemgrepParser } from './semgrep.parser';

const VALID_TARGET = '/repo';
const OUTPUT_FILE = '/tmp/out.json';

interface SemgrepParserInternal {
  buildSemgrepArgs(target: string, config: Record<string, unknown>, outputFile: string): string[];
}

describe('SemgrepParser command construction', () => {
  let parser: SemgrepParser;
  let internal: SemgrepParserInternal;

  beforeEach(() => {
    parser = new SemgrepParser();
    internal = asInternal<SemgrepParserInternal>(parser);
  });

  it('rejects a target injection payload before scanning', async () => {
    const context = makeScannerContext({ target: `${VALID_TARGET}; touch /tmp/pwned` });
    await expect(parser.scan(context)).rejects.toThrow(/Invalid Semgrep target/);
  });

  it('rejects an invalid ruleset', () => {
    expect(() =>
      internal.buildSemgrepArgs(
        VALID_TARGET,
        { rulesets: ['p/security-audit; rm -rf /'] },
        OUTPUT_FILE,
      ),
    ).toThrow(/Invalid Semgrep ruleset/);
  });

  it('rejects an exclude pattern with shell metacharacters', () => {
    expect(() =>
      internal.buildSemgrepArgs(VALID_TARGET, { exclude: ['node_modules; rm -rf /'] }, OUTPUT_FILE),
    ).toThrow(/Invalid Semgrep exclude pattern/);
  });

  it('builds a well-formed argv array for a valid ruleset', () => {
    const args = internal.buildSemgrepArgs(
      VALID_TARGET,
      { rulesets: ['p/security-audit'] },
      OUTPUT_FILE,
    );
    expect(args).toEqual(expect.arrayContaining(['--config', 'p/security-audit', VALID_TARGET]));
  });
});

describe('SemgrepParser.parse', () => {
  const parser = new SemgrepParser();

  it('normalizes a result into a finding', async () => {
    const report = JSON.stringify({
      results: [
        {
          check_id: 'javascript.lang.security.detect-eval',
          path: 'src/utils/parse.ts',
          start: { line: 12 },
          extra: { message: 'Use of eval() detected', severity: 'ERROR' },
        },
      ],
    });

    const context = makeScannerContext({ target: VALID_TARGET });
    const findings = await parser.parse(report, context);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toBe('Use of eval() detected');
    expect(findings[0]?.severity).toBe('HIGH');
    expect(findings[0]?.url).toBe('src/utils/parse.ts:12');
  });

  it('returns no findings for malformed JSON', async () => {
    const context = makeScannerContext();
    expect(await parser.parse('not json', context)).toEqual([]);
  });
});
