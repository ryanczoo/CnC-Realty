/** Thrown when Google rejects our credentials (HTTP 401 or invalid_grant). */
export class GoogleAuthError extends Error {
  constructor(message = "Google authorization failed") {
    super(message);
    this.name = "GoogleAuthError";
  }
}
