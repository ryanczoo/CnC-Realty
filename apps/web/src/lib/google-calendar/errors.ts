/** Thrown when Google rejects our credentials (HTTP 401 or invalid_grant). */
export class GoogleAuthError extends Error {
  constructor(message = "Google authorization failed") {
    super(message);
    this.name = "GoogleAuthError";
  }
}

/** Thrown when Google's consent screen did not grant the Calendar scopes we need. */
export class MissingScopeError extends Error {
  constructor(message = "Google did not grant calendar access") {
    super(message);
    this.name = "MissingScopeError";
  }
}
