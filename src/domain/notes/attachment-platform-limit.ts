import { MAX_ATTACHMENT_BYTES } from "./constants";

/**
 * Next.js 15 App Router has no per-route `bodySizeLimit` export; with auth middleware
 * enabled, `experimental.middlewareClientMaxBodySize` is the platform multipart envelope
 * for POST `/api/attachments` (default ~10MB otherwise → opaque 500 before Rex 413 handler).
 */
export const ATTACHMENT_UPLOAD_BODY_SIZE_LIMIT = "102mb" as const;

/** Rex handler cap (100MB file); platform limit must be >= this. */
export const ATTACHMENT_UPLOAD_BODY_SIZE_MIN_BYTES = MAX_ATTACHMENT_BYTES;
