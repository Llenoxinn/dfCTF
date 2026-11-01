// Leave room for multipart overhead below Vercel's 4.5 MB function payload limit.
export const MAX_ARTIFACT_BYTES = 3 * 1024 * 1024;
export const ARTIFACT_SIZE_LABEL = "3 MiB";
