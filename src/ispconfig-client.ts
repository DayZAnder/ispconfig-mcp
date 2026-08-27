/**
 * ISPConfig 3 REST API client.
 *
 * The ISPConfig REST API uses JSON over HTTPS:
 *   POST https://{host}:8080/remote/json.php?{method_name}
 *
 * Authentication returns a session_id that must be passed to every call.
 */

import { Agent, type Dispatcher } from "undici";

export interface ISPConfigOptions {
  url: string; // e.g. https://ispconfig.example.com:8080
  username: string;
  password: string;
  /**
   * Skip TLS certificate verification (self-signed certs).
   * Scoped to THIS client's connections only via a dedicated dispatcher,
   * never process-global. Default: false.
   */
  insecure?: boolean;
}

export class ISPConfigClient {
  private url: string;
  private username: string;
  private password: string;
  private sessionId: string | null = null;
  private insecure: boolean;
  /** Per-client undici dispatcher. Only set when insecure=true, so TLS
   * verification is disabled for this client's requests alone. */
  private dispatcher?: Dispatcher;

  constructor(opts: ISPConfigOptions) {
    this.url = opts.url.replace(/\/+$/, "");
    this.username = opts.username;
    this.password = opts.password;
    this.insecure = opts.insecure ?? false;
    if (this.insecure) {
      // Scope certificate bypass to this client only. This does NOT touch
      // NODE_TLS_REJECT_UNAUTHORIZED and therefore does not weaken TLS for
      // any other outbound request in the process.
      this.dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
    }
  }

  /** Authenticate and obtain a session_id. */
  async login(): Promise<string> {
    const result = await this.rawCall("login", {
      username: this.username,
      password: this.password,
    });
    if (!result || typeof result !== "string") {
      throw new Error("ISPConfig login failed: invalid credentials or unexpected response");
    }
    this.sessionId = result;
    return result;
  }

  /** End the current session. */
  async logout(): Promise<void> {
    if (this.sessionId) {
      try {
        await this.rawCall("logout", { session_id: this.sessionId });
      } finally {
        this.sessionId = null;
      }
    }
  }

  /** Ensure we have a valid session, login if needed. */
  private async ensureSession(): Promise<string> {
    if (!this.sessionId) {
      await this.login();
    }
    return this.sessionId!;
  }

  /**
   * Call any ISPConfig remote API method.
   * Session ID is automatically injected.
   */
  async call(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const sessionId = await this.ensureSession();
    try {
      return await this.rawCall(method, { session_id: sessionId, ...params });
    } catch (err: unknown) {
      // If the session expired, re-login and retry exactly once.
      // Match ISPConfig's session-related fault messages specifically rather
      // than any error text that happens to contain "session".
      if (err instanceof Error && this.isSessionError(err.message)) {
        this.sessionId = null;
        const newSession = await this.ensureSession();
        return await this.rawCall(method, { session_id: newSession, ...params });
      }
      throw err;
    }
  }

  private isSessionError(message: string): boolean {
    const m = message.toLowerCase();
    return (
      m.includes("session_id") ||
      m.includes("session does not exist") ||
      m.includes("session expired") ||
      m.includes("not logged in") ||
      m.includes("no_session")
    );
  }

  /** Low-level API call without session management. */
  private async rawCall(method: string, params: Record<string, unknown>): Promise<unknown> {
    const endpoint = `${this.url}/remote/json.php?${method}`;

    const fetchOpts: RequestInit & { dispatcher?: Dispatcher } = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    };
    if (this.dispatcher) {
      fetchOpts.dispatcher = this.dispatcher;
    }

    const response = await fetch(endpoint, fetchOpts);

    if (!response.ok) {
      // Avoid echoing raw response bodies (may contain sensitive data) into
      // error messages that end up in logs or model context.
      throw new Error(`ISPConfig API HTTP ${response.status} calling ${method}`);
    }

    const json = await response.json();

    // ISPConfig wraps responses in { code: "ok", response: ... }
    if (json && typeof json === "object" && "code" in json) {
      const wrapped = json as { code: string; response?: unknown; message?: string };
      if (wrapped.code === "ok") {
        return wrapped.response;
      }
      if (wrapped.code === "remote_fault") {
        throw new Error(`ISPConfig remote fault calling ${method}: ${wrapped.message ?? "unknown"}`);
      }
    }

    return json;
  }
}
