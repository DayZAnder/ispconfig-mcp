/**
 * ISPConfig 3 REST API client.
 *
 * The ISPConfig REST API uses JSON over HTTPS:
 *   POST https://{host}:8080/remote/json.php?{method_name}
 *
 * Authentication returns a session_id that must be passed to every call.
 */

export interface ISPConfigOptions {
  url: string; // e.g. https://ispconfig.example.com:8080
  username: string;
  password: string;
  /** Skip TLS certificate verification (self-signed certs). Default: false */
  insecure?: boolean;
}

export class ISPConfigClient {
  private url: string;
  private username: string;
  private password: string;
  private sessionId: string | null = null;
  private insecure: boolean;

  constructor(opts: ISPConfigOptions) {
    this.url = opts.url.replace(/\/+$/, "");
    this.username = opts.username;
    this.password = opts.password;
    this.insecure = opts.insecure ?? false;
  }

  /** Authenticate and obtain a session_id. */
  async login(): Promise<string> {
    const result = await this.rawCall("login", {
      username: this.username,
      password: this.password,
    });
    if (!result || typeof result !== "string") {
      throw new Error(`ISPConfig login failed: ${JSON.stringify(result)}`);
    }
    this.sessionId = result;
    return result;
  }

  /** End the current session. */
  async logout(): Promise<void> {
    if (this.sessionId) {
      await this.rawCall("logout", { session_id: this.sessionId });
      this.sessionId = null;
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
      // If session expired, re-login and retry once
      if (err instanceof Error && err.message.includes("session")) {
        this.sessionId = null;
        const newSession = await this.ensureSession();
        return await this.rawCall(method, { session_id: newSession, ...params });
      }
      throw err;
    }
  }

  /** Low-level API call without session management. */
  private async rawCall(method: string, params: Record<string, unknown>): Promise<unknown> {
    const endpoint = `${this.url}/remote/json.php?${method}`;

    const fetchOpts: RequestInit & { dispatcher?: unknown } = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    };

    // For self-signed certs: Node 18+ supports this via undici dispatcher
    // but the simplest approach is setting NODE_TLS_REJECT_UNAUTHORIZED=0
    const response = await fetch(endpoint, fetchOpts);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ISPConfig API error ${response.status}: ${text}`);
    }

    const json = await response.json();

    // ISPConfig wraps responses in { code: "ok", response: ... }
    if (json && typeof json === "object" && "code" in json) {
      if (json.code === "ok") {
        return json.response;
      }
      if (json.code === "remote_fault") {
        throw new Error(`ISPConfig remote fault: ${json.message ?? JSON.stringify(json)}`);
      }
    }

    return json;
  }
}
