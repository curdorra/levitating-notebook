// Per-account quotas. They keep one account from filling the database.
export const MAX_NOTEBOOKS = 200;
export const MAX_PAGES = 3000;
/** Encrypted titles and content across all of an account's pages. */
export const MAX_STORAGE_BYTES = 5 * 1024 * 1024;
/** One autosave request (one page's encrypted title and content). */
export const MAX_PAGE_BYTES = 2_000_000;
