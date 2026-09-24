export type SaveStatus = "saved" | "unsaved" | "saving" | "error";
type Patch = { title?: string; content?: object };

const SAVE_DELAY = 700;
const RETRY_DELAY = 4000;
// Browsers cap keepalive request bodies at 64KB.
const KEEPALIVE_LIMIT = 60_000;

/**
 * Debounced autosave for one page. Edits are merged into a pending patch,
 * encrypted by `seal`, and PUT to /api/pages/:id; failures keep the patch and
 * retry. flush({ keepalive }) lets the save outlive the tab when it's closing.
 */
export function createSaver(
  pageId: string,
  onStatus: (s: SaveStatus) => void,
  seal: (patch: Patch) => Promise<Record<string, string>>,
) {
  let draft: Patch = {};
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;

  const hasDraft = () => draft.title !== undefined || draft.content !== undefined;

  function schedule(ms: number) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flush(), ms);
  }

  async function flush(opts: { keepalive?: boolean } = {}) {
    if (timer) clearTimeout(timer);
    timer = null;
    // One request at a time, except a last-chance save while the tab closes.
    if (inFlight && !opts.keepalive) return;
    if (!hasDraft()) return;

    const sent = draft;
    draft = {};
    inFlight = true;
    onStatus("saving");
    try {
      const body = JSON.stringify(await seal(sent));
      const res = await fetch(`/api/pages/${pageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: Boolean(opts.keepalive) && body.length < KEEPALIVE_LIMIT,
      });
      if (!res.ok) throw new Error(String(res.status));
      onStatus(hasDraft() ? "unsaved" : "saved");
    } catch {
      // Keep what failed; anything typed since takes precedence.
      draft = { ...sent, ...draft };
      onStatus("error");
      schedule(RETRY_DELAY);
    } finally {
      inFlight = false;
      if (hasDraft() && !timer) schedule(SAVE_DELAY);
    }
  }

  return {
    queue(patch: Patch) {
      draft = { ...draft, ...patch };
      onStatus("unsaved");
      schedule(SAVE_DELAY);
    },
    flush,
    isDirty: () => hasDraft() || inFlight,
  };
}
