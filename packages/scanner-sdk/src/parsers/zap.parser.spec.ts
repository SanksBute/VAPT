import type { ScanConfiguration } from '@sentinelx/shared';

import type { ScannerContext } from '../interfaces/scanner.interface';
import { asInternal, makeScannerContext } from '../test-utils/mock-context';

import { ZapParser } from './zap.parser';

const WORK_DIR = '/tmp/work';

interface ZapParserInternal {
  buildAuthArgs(
    context: ScannerContext,
    configuration: Record<string, unknown>,
    workDir: string,
  ): Promise<string[]>;
}

function asScanConfiguration(config: Record<string, unknown>): ScanConfiguration {
  return config as unknown as ScanConfiguration;
}

describe('ZapParser command construction', () => {
  let parser: ZapParser;
  let internal: ZapParserInternal;

  beforeEach(() => {
    parser = new ZapParser();
    internal = asInternal<ZapParserInternal>(parser);
  });

  it('rejects an invalid API definition URL', async () => {
    const context = makeScannerContext({
      target: 'https://example.com',
      configuration: asScanConfiguration({
        apiScan: true,
        apiDefinition: 'not-a-url; touch /tmp/pwned',
      }),
    });
    await expect(parser.scan(context)).rejects.toThrow(/Invalid ZAP API definition URL/);
  });

  it('does not add auth args when no auth config is present', async () => {
    const context = makeScannerContext();
    const args = await internal.buildAuthArgs(context, {}, WORK_DIR);
    expect(args).toEqual([]);
  });

  it('builds a bearer replacer config when a token is present', async () => {
    const context = makeScannerContext({ credentials: { token: 'secret-token' } });
    const args = await internal.buildAuthArgs(context, { auth: { type: 'bearer' } }, WORK_DIR);
    expect(args[0]).toBe('-z');
    expect(args[1]).toContain('Bearer\\ secret-token');
  });

  it('skips form auth args when credentials are incomplete', async () => {
    const context = makeScannerContext();
    const args = await internal.buildAuthArgs(
      context,
      {
        auth: {
          type: 'form',
          loginUrl: 'https://example.com/login',
          usernameField: 'user',
          passwordField: 'pass',
          loggedInIndicator: 'Logout',
        },
      },
      WORK_DIR,
    );
    expect(args).toEqual([]);
  });
});

describe('ZapParser.parse', () => {
  const parser = new ZapParser();

  it('normalizes an XML alert into a finding', async () => {
    const xml = `<?xml version="1.0"?>
<OWASPZAPReport>
  <site>
    <alerts>
      <alertitem>
        <pluginid>40012</pluginid>
        <alert>Cross Site Scripting (Reflected)</alert>
        <riskcode>3</riskcode>
        <cweid>79</cweid>
        <desc>XSS in the q parameter</desc>
        <instances>
          <instance>
            <uri>https://example.com/search?q=1</uri>
            <method>GET</method>
            <param>q</param>
          </instance>
        </instances>
      </alertitem>
    </alerts>
  </site>
</OWASPZAPReport>`;

    const context = makeScannerContext({ target: 'https://example.com' });
    const findings = await parser.parse(xml, context);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toBe('Cross Site Scripting (Reflected)');
    expect(findings[0]?.severity).toBe('HIGH');
    expect(findings[0]?.cweIds).toEqual(['CWE-79']);
  });

  it('returns no findings for empty output', async () => {
    const context = makeScannerContext();
    expect(await parser.parse('', context)).toEqual([]);
  });
});
