/**
 * dsh-siliconflow-balance — browser half (scaffold).
 *
 * Planned registration (docs/design.md §1.2):
 *
 *   ctx.slots.inject('conversation.composer.dock', function* () {
 *     yield ctx.slots.register(
 *       { name: 'conversation.composer.dock', id: 'siliconflow-balance', order: 2, locale: NS },
 *       BalancePill,
 *     );
 *   });
 *
 * `NS` is the package name. The pill fetches `GET /api/siliconflow.balance` with
 * `credentials: 'same-origin'` and follows the refresh loop in §5.7.
 */
export function apply(_ctx: unknown): void {
  // TODO(implementation): register the dock entry and implement the pill + popover.
}
