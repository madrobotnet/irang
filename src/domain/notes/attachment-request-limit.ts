import { MAX_ATTACHMENT_BYTES } from "./constants";

/** Multipart boundaries and form fields when Next clones the request in middleware. */
export const ATTACHMENT_MULTIPART_OVERHEAD_BYTES = 2 * 1024 * 1024;

/** Largest POST body we accept for `/api/attachments` (file + multipart wrapper). */
export const ATTACHMENT_MAX_REQUEST_BODY_BYTES =
  MAX_ATTACHMENT_BYTES + ATTACHMENT_MULTIPART_OVERHEAD_BYTES;
