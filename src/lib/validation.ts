import * as z from "zod";
import { AUTH_RE, CIPHER_RE } from "./crypto";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, { error: "Username must be at least 3 characters." })
  .max(24, { error: "Username must be 24 characters or fewer." })
  .regex(/^[a-z0-9._-]+$/, { error: "Use letters, numbers, dots, dashes or underscores." });

export const passwordSchema = z
  .string()
  .min(8, { error: "Password must be at least 8 characters." })
  .max(200, { error: "Password is too long." });

export const optionalEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.email({ error: "That doesn't look like an email address." }).nullable());

/** The login key the browser derives from the password (lib/crypto.ts). */
export const authKeySchema = z.string().regex(AUTH_RE, { error: "Something went wrong. Please try again." });

/** An encrypted value: a wrapped key, a title or page content. */
export const cipherSchema = (maxLength = 4096) =>
  z.string().max(maxLength).regex(CIPHER_RE, { error: "Something went wrong. Please try again." });

export type FormState =
  | {
      error?: string;
      ok?: string;
      /** Login only: this account predates encryption; resend with the password to upgrade it. */
      legacy?: boolean;
      /** Login only: the data key wrapped by the password key, for the browser to unwrap. */
      wrappedKey?: string;
      // Echoed back so non-secret fields survive React's post-action form reset.
      fields?: Record<string, string>;
    }
  | undefined;
