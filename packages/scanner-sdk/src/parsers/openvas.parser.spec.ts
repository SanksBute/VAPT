import { makeScannerContext } from '../test-utils/mock-context';

import { OpenVasParser } from './openvas.parser';

describe('OpenVasParser.parse', () => {
  const parser = new OpenVasParser();

  it('normalizes a GMP report result into a finding', async () => {
    const xml = `<?xml version="1.0"?>
<report>
  <report>
    <results>
      <result>
        <host>10.0.0.5</host>
        <port>443/tcp</port>
        <threat>High</threat>
        <description>Outdated TLS library</description>
        <nvt oid="1.3.6.1.4.1.25623.1.0.100001">
          <name>Outdated OpenSSL</name>
          <cvss_base>7.5</cvss_base>
          <refs>
            <ref type="cve" id="CVE-2023-0001"/>
          </refs>
        </nvt>
      </result>
    </results>
  </report>
</report>`;

    const context = makeScannerContext({ target: '10.0.0.5' });
    const findings = await parser.parse(xml, context);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toBe('Outdated OpenSSL');
    expect(findings[0]?.severity).toBe('HIGH');
    expect(findings[0]?.cveIds).toEqual(['CVE-2023-0001']);
    expect(findings[0]?.port).toBe(443);
  });

  it('returns no findings for non-report output', async () => {
    const context = makeScannerContext();
    expect(await parser.parse('not a report', context)).toEqual([]);
  });

  it('throws when scan() is invoked directly (GMP integration required)', async () => {
    const context = makeScannerContext();
    await expect(parser.scan(context)).rejects.toThrow(/GVM API integration/);
  });
});
