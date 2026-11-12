/** Why a balance reading could not be produced. */
export type BalanceFailure =
  /** No console session has been pasted yet. */
  | 'unconfigured'
  /** The console answered with a login redirect or 401/403: the session expired. */
  | 'unauthorized'
  /** The console wallet request failed with a server or transport error. */
  | 'upstream'
  /** The console answered with something that is not a wallet reading. */
  | 'invalid-response'
  /** The upstream API retired the endpoint this plugin used to read. */
  | 'retired'
  /** The credential store refused the write. */
  | 'storage';

/** US-dollar amounts decoded from the console wallet response. */
export interface BalanceAmounts {
  /** Spendable right now (the wallet's `available`, scaled to US dollars). */
  available: number;
  /** Total topped up over the account's life. */
  recharged: number;
  /** Total already spent. */
  used: number;
}

/** Client-facing display policy, so the browser does not need Host config access. */
export interface BalancePolicy {
  refreshSeconds: number;
  warnThreshold: number;
  showBreakdown: boolean;
}

/** Every route answers this shape, always with HTTP 200. */
export interface BalancePayload {
  ok: boolean;
  reason?: BalanceFailure;
  /** Human-readable detail for a refused session paste. */
  message?: string;
  /** Whether a console session is currently stored. */
  configured: boolean;
  amounts?: BalanceAmounts;
  /** ISO timestamp of the reading. */
  asOf?: string;
  /** Status of the console wallet response, when there was one. */
  upstreamStatus?: number;
  policy: BalancePolicy;
  /** Where the user copies the session values from. */
  consoleUrl: string;
}

/** Body of `POST /api/siliconflow.balance/session`. */
export interface SessionInput {
  cookie: string;
  subjectId: string;
}
