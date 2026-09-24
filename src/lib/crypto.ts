/**
 * End-to-end encryption, run in the browser with WebCrypto.
 *
 *   password ──PBKDF2(600k, salt = username)──▶ master
 *   master ──HKDF "auth"──▶ login key   (sent to the server, which stores bcrypt of it)
 *   master ──HKDF "wrap"──▶ password key (never leaves the browser)
 *
 * Each account has one random AES-256-GCM data key. The server stores it only
 * wrapped: once by the password key, once by a random recovery key that the
 * user keeps. Notebook titles, page titles and page content are encrypted with
 * the data key; each ciphertext is bound (as AES-GCM additional data) to the
 * record it belongs to, so the server can't swap one page's text into another.
 *
 * Ciphertext format: "v1.<iv>.<ciphertext+tag>", both base64url.
 */

const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

const PBKDF2_ITERATIONS = 600_000;

export const CIPHER_RE = /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/;
export const AUTH_RE = /^[0-9a-f]{64}$/;

export const aad = {
  notebookTitle: (id: string) => `notebook-title:${id}`,
  pageTitle: (id: string) => `page-title:${id}`,
  pageContent: (id: string) => `page-content:${id}`,
  passwordWrap: (username: string) => `wrap-password:${username}`,
  recoveryWrap: (username: string) => `wrap-recovery:${username}`,
};

// ---------- encoding ----------

export function toB64u(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64u(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const random = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));

function pack(iv: Uint8Array, data: ArrayBuffer) {
  return `v1.${toB64u(iv)}.${toB64u(new Uint8Array(data))}`;
}

function unpack(value: string) {
  if (!CIPHER_RE.test(value)) throw new Error("Not a ciphertext");
  const [, iv, data] = value.split(".");
  return { iv: fromB64u(iv), data: fromB64u(data) };
}

// ---------- keys from the password ----------

export type PasswordKeys = { auth: string; wrapKey: CryptoKey };

/** Usernames are stored lowercase, so the salt is too. */
export async function derivePasswordKeys(username: string, password: string): Promise<PasswordKeys> {
  const base = await subtle().importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const master = await subtle().deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: enc.encode(`levitating-notebook/v1/${username.toLowerCase()}`),
      iterations: PBKDF2_ITERATIONS,
    },
    base,
    256,
  );
  const hkdf = await subtle().importKey("raw", master, "HKDF", false, ["deriveBits", "deriveKey"]);
  const params = (info: string) => ({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: enc.encode(info) });
  const auth = await subtle().deriveBits(params("auth"), hkdf, 256);
  const wrapKey = await subtle().deriveKey(params("wrap"), hkdf, { name: "AES-GCM", length: 256 }, false, [
    "wrapKey",
    "unwrapKey",
  ]);
  return { auth: hex(new Uint8Array(auth)), wrapKey };
}

// ---------- the data key ----------

/** A fresh data key. Extractable only so it can be wrapped; store a non-extractable copy. */
export function newDataKey() {
  return subtle().generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]) as Promise<CryptoKey>;
}

export async function wrapDataKey(dataKey: CryptoKey, wrapKey: CryptoKey, context: string) {
  const iv = random(12);
  const wrapped = await subtle().wrapKey("raw", dataKey, wrapKey, {
    name: "AES-GCM",
    iv,
    additionalData: enc.encode(context),
  });
  return pack(iv, wrapped);
}

/** Throws if the wrapping key is wrong (e.g. a mistyped password). */
export async function unwrapDataKey(wrapped: string, wrapKey: CryptoKey, context: string, extractable = false) {
  const { iv, data } = unpack(wrapped);
  return subtle().unwrapKey(
    "raw",
    data,
    wrapKey,
    { name: "AES-GCM", iv, additionalData: enc.encode(context) },
    { name: "AES-GCM", length: 256 },
    extractable,
    ["encrypt", "decrypt"],
  );
}

/** A non-extractable copy of an extractable key, for keeping in the browser. */
export async function lockDown(key: CryptoKey) {
  const raw = await subtle().exportKey("raw", key);
  return subtle().importKey("raw", raw, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

// ---------- recovery key ----------

// Crockford base32: no I, L, O or U, so it survives being read aloud or retyped.
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function newRecoveryCode() {
  const bytes = random(20); // 160 bits → 32 characters
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out.match(/.{4}/g)!.join("-");
}

/** Accepts the code with or without dashes, spaces or lowercase; maps look-alikes. */
export function normaliseRecoveryCode(input: string) {
  const s = input.toUpperCase().replace(/[\s-]/g, "").replace(/[IL]/g, "1").replace(/O/g, "0");
  return /^[0-9A-HJKMNP-TV-Z]{32}$/.test(s) ? s : null;
}

export async function recoveryWrapKey(code: string) {
  const s = normaliseRecoveryCode(code);
  if (!s) throw new Error("That recovery key isn't the right shape.");
  const base = await subtle().importKey("raw", enc.encode(`levitating-notebook/recovery/${s}`), "HKDF", false, [
    "deriveKey",
  ]);
  return subtle().deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: enc.encode("recovery-wrap") },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
}

// ---------- text ----------

export async function encryptText(key: CryptoKey, text: string, context: string) {
  const iv = random(12);
  const data = await subtle().encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(context) }, key, enc.encode(text));
  return pack(iv, data);
}

export async function decryptText(key: CryptoKey, value: string, context: string) {
  const { iv, data } = unpack(value);
  const plain = await subtle().decrypt({ name: "AES-GCM", iv, additionalData: enc.encode(context) }, key, data);
  return dec.decode(plain);
}

// ---------- account setup ----------

/**
 * Everything a new (or freshly reset) account needs: the login key, the data
 * key wrapped both ways, the recovery code to show the user once, and a
 * non-extractable copy of the data key for this browser.
 */
export async function createAccountKeys(username: string, password: string) {
  const { auth, wrapKey } = await derivePasswordKeys(username, password);
  const dataKey = await newDataKey();
  const recoveryCode = newRecoveryCode();
  const [wrappedKey, recoveryWrappedKey, localKey] = await Promise.all([
    wrapDataKey(dataKey, wrapKey, aad.passwordWrap(username)),
    recoveryWrapKey(recoveryCode).then((k) => wrapDataKey(dataKey, k, aad.recoveryWrap(username))),
    lockDown(dataKey),
  ]);
  return { auth, wrappedKey, recoveryWrappedKey, recoveryCode, localKey };
}
