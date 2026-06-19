/** Logo PNG (`public/m8x4p2n7.png`) — preserve aspect in email clients. */
export const TRANSACTIONAL_EMAIL_LOGO_WIDTH = 40;
export const TRANSACTIONAL_EMAIL_LOGO_HEIGHT = 48; // 478×576 source

export type TransactionalEmailHtmlInput = {
  subject: string;
  logoUrl: string;
  headline: string;
  /** HTML fragment inserted between headline and body copy (e.g. OTP block). */
  extraHtml?: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaHref: string;
  footerHtml: string;
};

export function buildTransactionalEmailHtml(
  input: TransactionalEmailHtmlInput,
): string {
  const extra = input.extraHtml ?? "";
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${input.subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0b1220;-webkit-text-size-adjust:100%;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px 24px;">
            <tr>
              <td align="center" style="padding-bottom:20px;">
                <img
                  src="${input.logoUrl}"
                  alt="Cliste"
                  width="${TRANSACTIONAL_EMAIL_LOGO_WIDTH}"
                  height="${TRANSACTIONAL_EMAIL_LOGO_HEIGHT}"
                  style="display:block;width:${TRANSACTIONAL_EMAIL_LOGO_WIDTH}px;height:${TRANSACTIONAL_EMAIL_LOGO_HEIGHT}px;max-width:${TRANSACTIONAL_EMAIL_LOGO_WIDTH}px;margin:0 auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;"
                />
              </td>
            </tr>
            <tr>
              <td style="text-align:center;">
                <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:600;">${input.headline}</h1>
                ${extra}
                <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#64748b;">
                  ${input.bodyHtml}
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px;">
                  <tr>
                    <td align="center" style="border-radius:999px;background:#0b1220;">
                      <a href="${input.ctaHref}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:999px;">
                        ${input.ctaLabel}
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                  ${input.footerHtml}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
