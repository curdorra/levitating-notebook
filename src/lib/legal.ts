import "server-only";

/**
 * Who runs the site, for the privacy policy and terms. Set these in the
 * deployment's environment variables; the pages say so plainly when they're missing.
 */
export function operator() {
  return {
    name: process.env.LEGAL_NAME?.trim() || null,
    email: process.env.CONTACT_EMAIL?.trim() || null,
    country: process.env.LEGAL_COUNTRY?.trim() || null,
  };
}

export const LEGAL_UPDATED = "24 September 2026";
