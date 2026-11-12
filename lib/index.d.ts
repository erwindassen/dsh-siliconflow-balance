import z from '@deepseek-ai/schemastery';
export declare const name = "dsh-siliconflow-balance";
/** Services this Host half needs: the browser connection and credentials. */
export declare const inject: string[];
/** Exact same-origin route the browser half polls. */
export declare const ROUTE_PATH = "/api/siliconflow.balance";
/**
 * The Loader row's config. The three preferences are `.volatile()` so a settings
 * surface can write them later; `baseUrl` and `credentialRef` stay patch-only
 * configuration. See docs/design.md §4.1.
 */
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    baseUrl: z<string, string, "defined">;
    credentialRef: z<string, string, "defined">;
    refreshSeconds: z<number, number, "volatile-defined">;
    showBreakdown: z<boolean, boolean, "volatile-defined">;
    warnThreshold: z<number, number, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    baseUrl: z<string, string, "defined">;
    credentialRef: z<string, string, "defined">;
    refreshSeconds: z<number, number, "volatile-defined">;
    showBreakdown: z<boolean, boolean, "volatile-defined">;
    warnThreshold: z<number, number, "volatile-defined">;
}>>, "plain">;
/** Validated row config, after defaults. */
export interface ResolvedConfig {
    baseUrl: string;
    credentialRef: string;
    refreshSeconds: number;
    showBreakdown: boolean;
    warnThreshold: number;
}
/**
 * Minimal shape of the services this plugin uses. Declared structurally so the
 * package needs no `@deepseek-ai/*` runtime dependency beyond schemastery: the
 * services are resolved by name from the running Host.
 */
interface CredentialValue {
    readonly value: string;
}
interface CredentialsLike {
    resolve(ref: string): Promise<CredentialValue | undefined>;
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
interface HostContext {
    connection: ConnectionLike;
    credentials: CredentialsLike;
    effect(callback: () => (() => unknown) | void, label?: string): void;
}
/**
 * Normalize the row config without trusting it: an unknown or malformed field
 * falls back to its default instead of disabling the plugin.
 *
 * The Loader may hand over either plain values or schemastery volatile
 * accessors, so every read goes through `readField`.
 */
export declare function resolveConfig(raw: unknown): ResolvedConfig;
/**
 * Host half.
 *
 * Registers `GET /api/siliconflow.balance` on `ctx.connection.fetch`, resolves
 * the configured credential, calls `${baseUrl}/user/info`, and serves the cached
 * payload described in docs/design.md §5.7. Failures are HTTP 200 with
 * `{ ok: false, reason }` so the composer is never blocked; the API key never
 * appears in the answer.
 */
export declare function apply(ctx: HostContext, rawConfig: unknown): void;
export {};
//# sourceMappingURL=index.d.ts.map