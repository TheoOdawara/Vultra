/**
 * VULTRA — Domain Constants
 *
 * Shared configuration values used by Use Cases and Repositories.
 * Single source of truth — never duplicate inline.
 */

/** ArcFace cosine similarity — confirmed match threshold */
export const FACE_MATCH_THRESHOLD = 0.85;

/** Below this threshold → FACE_NOT_RECOGNIZED (no candidate returned) */
export const LOW_CONFIDENCE_THRESHOLD = 0.4;

/** Minimum quality score accepted at biometric enroll time */
export const MIN_ENROLL_QUALITY = 0.5;

/** Active embedding model identifier stored alongside every profile */
export const CURRENT_MODEL_VERSION = "ArcFace-v1";
