import z from '@deepseek-ai/schemastery';

export const name = 'dsh-siliconflow-balance';

/** Services this Host half needs once implemented: the browser connection and credentials. */
export const inject: string[] = ['connection', 'credentials'];

/**
 * The Loader row's config. The three preferences are `.volatile()` so a settings
 * surface can write them later; `baseUrl` and `credentialRef` stay patch-only
 * configuration. See docs/design.md §4.1.
 */
export const Config = z.object({
  baseUrl: z.string().default('https://api.siliconflow.com/v1'),
  credentialRef: z.string().default('SILICONFLOW_API_KEY'),
  refreshSeconds: z.natural().default(300).volatile(),
  showBreakdown: z.boolean().default(true).volatile(),
  warnThreshold: z.number().min(0).default(10).volatile(),
});

export type Config = ReturnType<typeof Config>;

/**
 * Host half (scaffold).
 *
 * Planned shape: register `GET /api/siliconflow.balance` on `ctx.connection.fetch`,
 * resolve `credentialRef`, call `${baseUrl}/user/info`, and serve the cached payload
 * described in docs/design.md §5.7.
 */
export function apply(_ctx: unknown, _config: Config): void {
  // TODO(implementation): route + credential resolution + TTL cache + state machine.
}
