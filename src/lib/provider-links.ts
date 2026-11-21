// Default sign-in pages for the providers the household uses, so every
// account card can link straight to its portal. An account's own `loginUrl`
// (editable in the account drawer) always wins over these defaults.

const PROVIDER_LOGINS: { match: RegExp; url: string }[] = [
  { match: /clal|כלל/i, url: "https://www.clalbit.co.il/" },
  { match: /migdal|מגדל/i, url: "https://www.migdal.co.il/" },
  { match: /harel|הראל/i, url: "https://www.harel-group.co.il/" },
  { match: /menora|מנורה/i, url: "https://www.menoramivt.co.il/" },
  { match: /\bmore\b|מור/i, url: "https://www.more.co.il/" },
  { match: /yelin|lapidot|ילין/i, url: "https://ylp.co.il/" },
  { match: /altshuler|אלטשולר/i, url: "https://www.as-invest.co.il/" },
  { match: /meitav|מיטב/i, url: "https://www.meitav.co.il/" },
  { match: /schwab/i, url: "https://workplace.schwab.com/" },
  { match: /morgan stanley|stockplan/i, url: "https://www.stockplanconnect.com/" },
  { match: /fidelity/i, url: "https://nb.fidelity.com/" },
  { match: /inspira/i, url: "https://www.inspirafinancial.com/" },
  { match: /lincoln/i, url: "https://www.lincolnfinancial.com/" },
  { match: /aetna/i, url: "https://www.aetna.com/" },
  { match: /metlife/i, url: "https://www.metlife.com/" },
];

/** The default login page for a provider name, or null when unknown. */
export function defaultLoginUrl(provider: string | null | undefined): string | null {
  if (!provider) return null;
  return PROVIDER_LOGINS.find((p) => p.match.test(provider))?.url ?? null;
}

/** The account's own login URL if set, else the provider default. */
export function loginUrlFor(a: { loginUrl?: string | null; provider?: string | null; source?: string | null }): string | null {
  return a.loginUrl || defaultLoginUrl(a.provider ?? a.source ?? null);
}
