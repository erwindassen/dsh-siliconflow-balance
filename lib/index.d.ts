import z from '@deepseek-ai/schemastery';
import type { SessionInput } from './types.js';
export declare const name = "dsh-siliconflow-balance";
/** Services this Host half needs: the browser connection and credentials. */
export declare const inject: string[];
/** Same-origin route the browser half polls for a reading. */
export declare const ROUTE_PATH = "/api/siliconflow.balance";
/** Same-origin route that validates and stores a pasted console session. */
export declare const SESSION_PATH = "/api/siliconflow.balance/session";
/** Same-origin route that forgets the stored console session. */
export declare const CLEAR_PATH = "/api/siliconflow.balance/clear";
/**
 * Credential refs the console session lives under. They are real DSH credentials
 * (not patch config), so the cookie never sits in plaintext YAML.
 */
export declare const COOKIE_REF = "SILICONFLOW_CONSOLE_COOKIE";
export declare const SUBJECT_REF = "SILICONFLOW_CONSOLE_SUBJECT";
/**
 * The Loader row's config. This *is* the plugin's config plane: DSH renders a
 * settings form from this schema, including the field descriptions below.
 */
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    consoleBaseUrl: z<string, string, "defined">;
    cookieRef: z<string, string, "defined">;
    subjectRef: z<string, string, "defined">;
    refreshSeconds: z<number, number, "volatile-defined">;
    showBreakdown: z<boolean, boolean, "volatile-defined">;
    warnThreshold: z<number, number, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    consoleBaseUrl: z<string, string, "defined">;
    cookieRef: z<string, string, "defined">;
    subjectRef: z<string, string, "defined">;
    refreshSeconds: z<number, number, "volatile-defined">;
    showBreakdown: z<boolean, boolean, "volatile-defined">;
    warnThreshold: z<number, number, "volatile-defined">;
}>>, "plain">;
/** Validated row config, after defaults. */
export interface ResolvedConfig {
    consoleBaseUrl: string;
    cookieRef: string;
    subjectRef: string;
    refreshSeconds: number;
    showBreakdown: boolean;
    warnThreshold: number;
}
/**
 * Minimal shapes of the services this plugin uses. Declared structurally so the
 * package needs no `@deepseek-ai/*` runtime dependency beyond schemastery: the
 * services are resolved by name from the running Host.
 */
interface CredentialValue {
    readonly value: string;
}
interface CredentialsLike {
    resolve(ref: string): Promise<CredentialValue | undefined>;
    set(ref: string, value: string): Promise<void>;
    unset(ref: string): Promise<void>;
}
interface ConnectionRoute {
    path: string;
    methods: readonly ('GET' | 'HEAD' | 'POST')[];
    requestBody: 'buffered' | 'streaming';
    fetch: (request: Request) => Promise<Response>;
}
interface ConnectionLike {
    fetch: {
        register(route: ConnectionRoute): () => Promise<void>;
    };
}
/** The slice of the Cordis context this plugin touches. */
export interface HostContext {
    effect: (setup: () => () => unknown, label?: string) => () => void;
    connection: ConnectionLike;
    credentials: CredentialsLike;
}
/** Validate and clamp the row config. Never throws: bad input falls back. */
export declare function resolveConfig(raw: unknown): ResolvedConfig;
/** Validate the pasted session. Throws a message meant for the setup panel. */
export declare function parseSessionInput(body: unknown): SessionInput;
/**
 * The Host half: resolves the pasted console session, calls the console wallet
 * service, caches a sample briefly, and publishes the same-origin routes.
 */
export declare function apply(ctx: HostContext, rawConfig: unknown): void;
export {};
//# sourceMappingURL=index.d.ts.map