window.__ModuleLoader__.load({
  id: "dsh-siliconflow-balance",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let react = require("react");
    let react_dom = require("react-dom");
    let react_jsx_runtime = require("react/jsx-runtime");
    // src/balance.ts
    /**
    * Format a CNY amount for the pill: two decimals and a `¥` prefix
    * (`88.88` → `¥88.88`). Intentionally locale-independent so the value reads
    * identically in every DSH locale and in the Host log.
    */
    function formatCny(amount) {
    	if (!Number.isFinite(amount)) throw new TypeError("dsh-siliconflow-balance: amount is not finite");
    	return `¥${amount.toFixed(2)}`;
    }
    // src/client.tsx
    /**
    * Browser half of dsh-siliconflow-balance.
    *
    * Registers a compact pill in the composer dock that shows the SiliconFlow
    * account balance. The API key never reaches the browser: the pill reads the
    * Host route `/api/siliconflow.balance`, which owns the credential and the
    * upstream cache. The popover is portaled to `document.body` because the
    * docked composer clips fixed overlays.
    */
    const NS = "siliconflow-balance";
    const ROUTE = "/api/siliconflow.balance";
    const MIN_REFRESH_MS = 15e3;
    /** While upstream reports the route as retired, stop polling every 5 min. */
    const RETIRED_RETRY_MS = 18e5;
    const CONSOLE_URL = "https://cloud.siliconflow.com/";
    const POPOVER_WIDTH = 252;
    const POPOVER_EDGE = 8;
    const DEFAULT_POLICY = {
    	refreshSeconds: 300,
    	warnThreshold: 10,
    	showBreakdown: true
    };
    const ZH = {
    	"pill.loading": "余额 …",
    	"pill.empty": "余额 —",
    	"pill.aria": "硅基流动余额：{amount}",
    	"pop.title": "硅基流动余额",
    	"pop.granted": "赠送额度",
    	"pop.charged": "充值余额",
    	"pop.total": "总额",
    	"pop.updated": "更新于 {time}",
    	"pop.pending": "正在读取余额…",
    	"pop.low": "余额低于提醒阈值 {threshold}",
    	"pop.stale": "刷新失败，显示的是上次读取的数据",
    	"pop.error": "读取余额失败，请稍后重试。",
    	"pop.unconfigured": "尚未配置 SILICONFLOW_API_KEY，请在设置中添加。",
    	"pop.unauthorized": "API Key 被拒绝，请在设置中检查 SILICONFLOW_API_KEY。",
    	"pop.retired": "硅基流动已于 2026-08-14 下线余额查询接口（HTTP 410），金额只能在控制台查看。",
    	"pop.console": "打开控制台",
    	"pill.retiredAria": "硅基流动余额：不可用（余额接口已下线）",
    	"pop.refresh": "立即刷新"
    };
    const EN = {
    	"pill.loading": "Balance …",
    	"pill.empty": "Balance —",
    	"pill.aria": "SiliconFlow balance: {amount}",
    	"pop.title": "SiliconFlow balance",
    	"pop.granted": "Granted credit",
    	"pop.charged": "Topped-up credit",
    	"pop.total": "Total",
    	"pop.updated": "Updated {time}",
    	"pop.pending": "Reading the balance…",
    	"pop.low": "Below the {threshold} warning threshold",
    	"pop.stale": "Could not refresh — showing the last reading",
    	"pop.error": "Could not read the balance. Try again in a moment.",
    	"pop.unconfigured": "SILICONFLOW_API_KEY is not configured. Add it in Settings.",
    	"pop.unauthorized": "The API key was rejected. Check SILICONFLOW_API_KEY in Settings.",
    	"pop.retired": "SiliconFlow retired its balance endpoint on 2026-08-14 (HTTP 410). The balance is only visible in the console.",
    	"pop.console": "Open console",
    	"pill.retiredAria": "SiliconFlow balance: unavailable (balance endpoint retired upstream)",
    	"pop.refresh": "Refresh now"
    };
    function interpolate(text, params) {
    	if (!params) return text;
    	return text.replace(/\{(\w+)\}/g, (whole, name) => name in params ? String(params[name]) : whole);
    }
    function fallbackTranslate(key, params) {
    	return interpolate(EN[key] ?? key, params);
    }
    function formatClock(asOf) {
    	const date = new Date(asOf);
    	if (Number.isNaN(date.getTime())) return asOf;
    	try {
    		return date.toLocaleTimeString([], {
    			hour: "2-digit",
    			minute: "2-digit"
    		});
    	} catch {
    		return asOf;
    	}
    }
    function BalanceIcon() {
    	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
    		className: "dsfb_icon",
    		viewBox: "0 0 16 16",
    		"aria-hidden": "true",
    		focusable: "false",
    		children: [
    			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ellipse", {
    				cx: "8",
    				cy: "4.4",
    				rx: "4.3",
    				ry: "1.9",
    				fill: "none",
    				stroke: "currentColor",
    				strokeWidth: "1.2"
    			}),
    			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
    				d: "M3.7 4.4v3.1c0 1.05 1.92 1.9 4.3 1.9s4.3-.85 4.3-1.9V4.4",
    				fill: "none",
    				stroke: "currentColor",
    				strokeWidth: "1.2"
    			}),
    			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
    				d: "M3.7 7.5v3.1c0 1.05 1.92 1.9 4.3 1.9s4.3-.85 4.3-1.9V7.5",
    				fill: "none",
    				stroke: "currentColor",
    				strokeWidth: "1.2"
    			})
    		]
    	});
    }
    /** True when the browser reports a usable viewport width. */
    function viewportWidth() {
    	return typeof window === "undefined" ? 268 : window.innerWidth;
    }
    function BalancePill(props) {
    	const translate = typeof props.t === "function" ? props.t : fallbackTranslate;
    	const tr = (key, params) => translate(key, params);
    	const [sample, setSample] = (0, react.useState)(null);
    	const [failure, setFailure] = (0, react.useState)(null);
    	const [settled, setSettled] = (0, react.useState)(false);
    	const [busy, setBusy] = (0, react.useState)(false);
    	const [policy, setPolicy] = (0, react.useState)(DEFAULT_POLICY);
    	const [open, setOpen] = (0, react.useState)(false);
    	const [position, setPosition] = (0, react.useState)({ right: POPOVER_EDGE });
    	const buttonRef = (0, react.useRef)(null);
    	const popoverRef = (0, react.useRef)(null);
    	const refreshRef = (0, react.useRef)(() => {});
    	const policyRef = (0, react.useRef)(DEFAULT_POLICY);
    	const retiredRef = (0, react.useRef)(false);
    	(0, react.useEffect)(() => {
    		let disposed = false;
    		let timer;
    		let inFlight = false;
    		const clearTimer = () => {
    			if (timer !== void 0) {
    				clearTimeout(timer);
    				timer = void 0;
    			}
    		};
    		const schedule = () => {
    			clearTimer();
    			if (disposed || typeof document === "undefined" || document.hidden) return;
    			const base = Math.max(MIN_REFRESH_MS, policyRef.current.refreshSeconds * 1e3);
    			const interval = retiredRef.current ? Math.max(base, RETIRED_RETRY_MS) : base;
    			timer = setTimeout(() => {
    				timer = void 0;
    				load();
    			}, interval);
    		};
    		const load = async () => {
    			if (disposed || inFlight) return;
    			inFlight = true;
    			setBusy(true);
    			try {
    				const response = await fetch(ROUTE, {
    					credentials: "same-origin",
    					cache: "no-store",
    					headers: { accept: "application/json" }
    				});
    				if (disposed) return;
    				if (!response.ok) {
    					setFailure("upstream");
    					setSettled(true);
    					return;
    				}
    				const payload = await response.json();
    				if (disposed) return;
    				if (payload.policy) {
    					policyRef.current = payload.policy;
    					setPolicy(payload.policy);
    				}
    				retiredRef.current = payload.reason === "retired";
    				if (payload.ok && payload.amounts) {
    					setSample({
    						amounts: payload.amounts,
    						asOf: payload.asOf ?? (/* @__PURE__ */ new Date()).toISOString()
    					});
    					setFailure(null);
    				} else setFailure(payload.reason ?? "upstream");
    				setSettled(true);
    			} catch {
    				if (!disposed) {
    					setFailure("upstream");
    					setSettled(true);
    				}
    			} finally {
    				inFlight = false;
    				if (!disposed) {
    					setBusy(false);
    					schedule();
    				}
    			}
    		};
    		refreshRef.current = () => {
    			clearTimer();
    			load();
    		};
    		const wake = () => {
    			if (disposed) return;
    			if (typeof document !== "undefined" && document.hidden) return;
    			clearTimer();
    			load();
    		};
    		if (typeof document !== "undefined" && !document.hidden) load();
    		else schedule();
    		const onVisibility = () => {
    			if (document.hidden) clearTimer();
    			else wake();
    		};
    		document.addEventListener("visibilitychange", onVisibility);
    		window.addEventListener("focus", wake);
    		return () => {
    			disposed = true;
    			clearTimer();
    			document.removeEventListener("visibilitychange", onVisibility);
    			window.removeEventListener("focus", wake);
    		};
    	}, []);
    	const state = (() => {
    		if (failure === "unconfigured") return "unconfigured";
    		if (failure === "unauthorized") return "unauthorized";
    		if (failure === "retired") return sample ? "stale" : "retired";
    		if (failure) return "stale";
    		if (!settled) return "loading";
    		if (sample && policy.warnThreshold > 0 && sample.amounts.total < policy.warnThreshold) return "low";
    		return "ok";
    	})();
    	const amountLabel = sample ? formatCny(sample.amounts.total) : void 0;
    	const label = state === "loading" ? tr("pill.loading") : amountLabel ?? tr("pill.empty");
    	const ariaLabel = state === "retired" ? tr("pill.retiredAria") : tr("pill.aria", { amount: label });
    	const place = (0, react.useCallback)(() => {
    		const button = buttonRef.current;
    		if (!button) return;
    		const rect = button.getBoundingClientRect();
    		const width = Math.min(POPOVER_WIDTH, viewportWidth() - 16);
    		const right = Math.max(POPOVER_EDGE, Math.min(viewportWidth() - rect.right, viewportWidth() - width - POPOVER_EDGE));
    		if (rect.top >= 240) setPosition({
    			right,
    			bottom: Math.max(POPOVER_EDGE, window.innerHeight - rect.top + POPOVER_EDGE)
    		});
    		else setPosition({
    			right,
    			top: Math.min(window.innerHeight - POPOVER_EDGE, rect.bottom + POPOVER_EDGE)
    		});
    	}, []);
    	(0, react.useEffect)(() => {
    		if (!open) return;
    		place();
    		const onResize = () => place();
    		window.addEventListener("resize", onResize);
    		window.addEventListener("scroll", onResize, true);
    		return () => {
    			window.removeEventListener("resize", onResize);
    			window.removeEventListener("scroll", onResize, true);
    		};
    	}, [open, place]);
    	(0, react.useEffect)(() => {
    		if (!open) return;
    		const onKeyDown = (event) => {
    			if (event.key !== "Escape") return;
    			event.stopPropagation();
    			setOpen(false);
    			buttonRef.current?.focus();
    		};
    		const onPointerDown = (event) => {
    			const target = event.target;
    			if (!target) return;
    			if (popoverRef.current?.contains(target)) return;
    			if (buttonRef.current?.contains(target)) return;
    			setOpen(false);
    		};
    		document.addEventListener("keydown", onKeyDown, true);
    		document.addEventListener("pointerdown", onPointerDown, true);
    		return () => {
    			document.removeEventListener("keydown", onKeyDown, true);
    			document.removeEventListener("pointerdown", onPointerDown, true);
    		};
    	}, [open]);
    	const popover = open ? (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
    		ref: popoverRef,
    		className: "dsfb_pop",
    		role: "dialog",
    		"aria-label": tr("pop.title"),
    		style: {
    			right: position.right,
    			bottom: position.bottom,
    			top: position.top
    		},
    		children: [
    			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
    				className: "dsfb_pop_head",
    				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
    					className: "dsfb_pop_title",
    					children: tr("pop.title")
    				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
    					className: "dsfb_pop_total",
    					children: amountLabel ?? tr("pill.empty")
    				})]
    			}),
    			sample && policy.showBreakdown ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
    				className: "dsfb_rows",
    				children: [
    					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
    						className: "dsfb_row",
    						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: tr("pop.granted") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
    							className: "dsfb_value",
    							children: formatCny(sample.amounts.granted)
    						})]
    					}),
    					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
    						className: "dsfb_row",
    						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: tr("pop.charged") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
    							className: "dsfb_value",
    							children: formatCny(sample.amounts.charged)
    						})]
    					}),
    					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
    						className: "dsfb_row",
    						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: tr("pop.total") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
    							className: "dsfb_value",
    							children: formatCny(sample.amounts.total)
    						})]
    					})
    				]
    			}) : null,
    			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
    				className: "dsfb_note",
    				children: sample ? tr("pop.updated", { time: formatClock(sample.asOf) }) : settled ? null : tr("pop.pending")
    			}),
    			state === "low" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
    				className: "dsfb_note",
    				"data-tone": "warn",
    				children: tr("pop.low", { threshold: formatCny(policy.warnThreshold) })
    			}) : null,
    			state === "stale" && sample ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
    				className: "dsfb_note",
    				"data-tone": "warn",
    				children: tr("pop.stale")
    			}) : null,
    			state === "stale" && !sample ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
    				className: "dsfb_note",
    				"data-tone": "warn",
    				children: tr("pop.error")
    			}) : null,
    			state === "retired" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
    				className: "dsfb_note",
    				"data-tone": "warn",
    				children: tr("pop.retired")
    			}) : null,
    			state === "unconfigured" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
    				className: "dsfb_note",
    				"data-tone": "warn",
    				children: tr("pop.unconfigured")
    			}) : null,
    			state === "unauthorized" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
    				className: "dsfb_note",
    				"data-tone": "error",
    				children: tr("pop.unauthorized")
    			}) : null,
    			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
    				className: "dsfb_actions",
    				children: [state === "retired" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
    					className: "dsfb_action dsfb_link",
    					href: CONSOLE_URL,
    					target: "_blank",
    					rel: "noreferrer",
    					children: tr("pop.console")
    				}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
    					type: "button",
    					className: "dsfb_action",
    					disabled: busy,
    					onClick: () => refreshRef.current(),
    					children: tr("pop.refresh")
    				})]
    			})
    		]
    	}), document.body) : null;
    	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
    		className: "dsfb_anchor",
    		"data-composer-stat": NS,
    		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
    			ref: buttonRef,
    			type: "button",
    			className: "dsfb_pill",
    			"data-state": state,
    			"aria-expanded": open,
    			"aria-haspopup": "dialog",
    			"aria-label": ariaLabel,
    			title: ariaLabel,
    			onClick: () => {
    				if (open) {
    					setOpen(false);
    					return;
    				}
    				place();
    				setOpen(true);
    			},
    			children: [state === "stale" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
    				className: "dsfb_dot",
    				"aria-hidden": "true"
    			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BalanceIcon, {}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
    				className: "dsfb_label",
    				children: label
    			})]
    		}), popover]
    	});
    }
    const CSS = `
    .dsfb_anchor {
      min-width: 0;
      font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px);
      line-height: calc(20px + var(--dsh-content-font-delta-secondary, 0px));
      display: inline-flex;
    }
    .dsfb_pill {
      border-radius: var(--dsw-radius-sm);
      color: var(--dsw-alias-label-tertiary);
      font-variant-numeric: tabular-nums;
      background: 0 0;
      border: none;
      align-items: center;
      gap: 6px;
      padding: 1px 8px;
      display: inline-flex;
      cursor: pointer;
      transition: color .15s ease;
    }
    .dsfb_pill:hover { color: var(--dsw-alias-label-secondary); }
    .dsfb_pill:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
    .dsfb_pill[data-state='loading'] { color: var(--dsw-alias-state-idle-primary); }
    .dsfb_pill[data-state='low'] { color: var(--dsw-alias-state-warn-primary); }
    .dsfb_pill[data-state='stale'],
    .dsfb_pill[data-state='retired'],
    .dsfb_pill[data-state='unconfigured'],
    .dsfb_pill[data-state='unauthorized'] { color: var(--dsw-alias-label-tertiary); }
    .dsfb_icon { width: 14px; height: 14px; flex: none; }
    .dsfb_dot { width: 6px; height: 6px; border-radius: 999px; flex: none; margin: 0 4px; background: var(--dsw-alias-state-idle-primary); }
    .dsfb_label { text-overflow: ellipsis; min-width: 0; overflow: hidden; }
    .dsfb_pop {
      position: fixed;
      z-index: 10000;
      width: 252px;
      max-height: calc(100vh - 24px);
      overflow: auto;
      padding: 10px 12px;
      border-radius: var(--dsw-radius-md, 10px);
      background: var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-1));
      border: 1px solid var(--dsw-alias-border-l1);
      box-shadow: 0 8px 24px rgba(0, 0, 0, .18);
      color: var(--dsw-alias-label-primary);
      font-size: var(--dsh-content-font-size-secondary, 13px);
      line-height: 1.5;
    }
    .dsfb_pop_head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    .dsfb_pop_title { font-weight: 600; color: var(--dsw-alias-label-primary); }
    .dsfb_pop_total { font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-primary); }
    .dsfb_rows { display: flex; flex-direction: column; gap: 2px; }
    .dsfb_row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; color: var(--dsw-alias-label-secondary); }
    .dsfb_value { font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-primary); }
    .dsfb_note { margin-top: 8px; color: var(--dsw-alias-label-tertiary); }
    .dsfb_note[data-tone='warn'] { color: var(--dsw-alias-state-warn-primary); }
    .dsfb_note[data-tone='error'] { color: var(--dsw-alias-state-error-primary); }
    .dsfb_actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
    .dsfb_action {
      appearance: none;
      border: 1px solid var(--dsw-alias-border-l2, var(--dsw-alias-border-l1));
      border-radius: var(--dsw-radius-sm);
      background: transparent;
      color: var(--dsw-alias-label-secondary);
      padding: 3px 10px;
      font: inherit;
      cursor: pointer;
    }
    .dsfb_action:hover:not(:disabled) { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
    .dsfb_action:disabled { opacity: .5; cursor: default; }
    .dsfb_link { text-decoration: none; }
    .dsfb_link:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
    `;
    /** Append the pill stylesheet once per page and remove it with the plugin. */
    function installStyles() {
    	if (typeof document === "undefined") return () => {};
    	const tag = document.createElement("style");
    	tag.dataset["dshSiliconflowBalance"] = "1";
    	tag.textContent = CSS;
    	document.head.append(tag);
    	return () => {
    		tag.remove();
    	};
    }
    const name = "dsh-siliconflow-balance";
    const inject = ["slots", "locale"];
    function apply(ctx) {
    	ctx.effect(() => installStyles(), "dsh-siliconflow-balance: styles");
    	ctx.effect(() => ctx.locale.register(NS, {
    		zh: ZH,
    		en: EN
    	}), "dsh-siliconflow-balance: dictionaries");
    	ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
    		name: "conversation.composer.dock",
    		id: "siliconflow-balance",
    		order: 2,
    		locale: NS
    	}, BalancePill));
    }
    exports.BalancePill = BalancePill;
    exports.apply = apply;
    exports.inject = inject;
    exports.name = name;
    return module.exports;
  },
});
