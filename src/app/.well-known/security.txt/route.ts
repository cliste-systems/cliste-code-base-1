// RFC 9116 — security.txt at /.well-known/security.txt
//
// Served as plain text so vulnerability scanners and external researchers
// can discover where to send reports. Expires field must be ISO 8601 UTC
// and ideally <12 months out — bump on each release that touches this.

const SECURITY_TXT = `Contact: mailto:security@clistesystems.ie
Expires: 2027-04-18T00:00:00.000Z
Preferred-Languages: en
Canonical: https://clistesystems.ie/.well-known/security.txt
Policy: https://clistesystems.ie/SECURITY.md
`;

export const dynamic = "force-static";

export function GET() {
  return new Response(SECURITY_TXT, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
