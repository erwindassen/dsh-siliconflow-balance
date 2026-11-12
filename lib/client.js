window.__ModuleLoader__.load({
  id: "dsh-siliconflow-balance",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let react = require("react");
    let react_dom = require("react-dom");
    /** Format a CNY amount for the pill: `¥88.88`. */
    function formatCny(amount) {
    	if (!Number.isFinite(amount)) throw new Error(`amount is not finite: ${String(amount)}`);
    	return `¥${amount.toFixed(2)}`;
    }
    // src/client.tsx
    /** Same-origin routes served by the Host half (`src/index.ts`). */
    const ROUTE_PATH = "/api/siliconflow.balance";
    const SESSION_PATH = `${ROUTE_PATH}/session`;
    const CLEAR_PATH = `${ROUTE_PATH}/clear`;
    /** Locale namespace and slot ids owned by this plugin. */
    const NS = "siliconflow-balance";
    const SLOT_ID = "siliconflow-balance";
    /** While the console session is refused, retry far less often than usual. */
    const EXPIRED_RETRY_MS = 18e5;
    const EN = {
    	"pill.loading": "…",
    	"pill.empty": "Balance —",
    	"pill.aria": "Balance {amount}. Open details.",
    	"pill.unconfiguredAria": "Balance not set up. Open setup instructions.",
    	"pill.expiredAria": "Balance session expired. Open setup instructions.",
    	"pill.errorAria": "Balance unavailable. Open details.",
    	"pop.title": "SiliconFlow balance",
    	"pop.available": "Available",
    	"pop.recharged": "Topped up",
    	"pop.used": "Used",
    	"pop.asOf": "Read {time}",
    	"pop.refresh": "Refresh now",
    	"pop.console": "Open console",
    	"pop.unconfigured": "No console session saved yet. Open Settings → {title} to paste your console cookie.",
    	"pop.unauthorized": "The console session expired. Paste a fresh cookie in Settings → {title}.",
    	"pop.error": "Could not read the balance. Try again in a moment.",
    	"pop.stale": "Could not refresh — showing the last reading.",
    	"pop.retired": "SiliconFlow retired the balance API for API keys. The console session is used instead.",
    	"pop.low": "Below the {threshold} warning threshold.",
    	"settings.title": "SiliconFlow balance",
    	"settings.intro": "SiliconFlow no longer serves account balance to API keys, so the pill reads the same wallet response the console uses. It needs your signed-in console cookie, which stays in the DSH credential store and never reaches the browser.",
    	"settings.how": "How to get the two values",
    	"settings.step1": "Open the console page below and sign in if asked.",
    	"settings.step2": "Open the browser developer tools and switch to the Network tab.",
    	"settings.step3": "Reload the page, then find the request to profile/peek.",
    	"settings.step4": "Copy the whole Cookie request header into the first field, and the x-subject-id request header value into the second.",
    	"settings.open": "Open the console page",
    	"settings.cookieLabel": "Cookie request header",
    	"settings.cookieHint": "Paste everything after “Cookie:” — it is long, that is expected.",
    	"settings.subjectLabel": "x-subject-id request header",
    	"settings.subjectHint": "The short id from the same request, for example dbksd38a55fc73cq8k2g.",
    	"settings.save": "Validate and save",
    	"settings.saving": "Checking the session…",
    	"settings.clear": "Forget session",
    	"settings.saved": "Session works. Available balance: {amount}.",
    	"settings.configured": "A console session is saved.",
    	"settings.notConfigured": "No console session is saved yet.",
    	"settings.expired": "The console rejected that session. Copy a fresh cookie and try again.",
    	"settings.notSaved": "Not saved: {message}",
    	"settings.failed": "Could not reach the console. Check the network and try again.",
    	"settings.cleared": "The console session was forgotten.",
    	"settings.checked": "Read {time}",
    	"settings.privacy": "The cookie and subject id are stored as DSH credentials, not in the plugin config file."
    };
    const ZH = {
    	"pill.loading": "…",
    	"pill.empty": "余额 —",
    	"pill.aria": "余额 {amount}。打开详情。",
    	"pill.unconfiguredAria": "尚未配置余额。打开配置说明。",
    	"pill.expiredAria": "余额读取会话已过期。打开配置说明。",
    	"pill.errorAria": "余额暂不可用。打开详情。",
    	"pop.title": "硅基流动余额",
    	"pop.available": "可用余额",
    	"pop.recharged": "累计充值",
    	"pop.used": "累计消费",
    	"pop.asOf": "读取于 {time}",
    	"pop.refresh": "立即刷新",
    	"pop.console": "打开控制台",
    	"pop.unconfigured": "尚未保存控制台会话。请在「设置 → {title}」中粘贴控制台 Cookie。",
    	"pop.unauthorized": "控制台会话已过期。请在「设置 → {title}」中粘贴新的 Cookie。",
    	"pop.error": "读取余额失败，请稍后重试。",
    	"pop.stale": "刷新失败，正在显示上次读取的结果。",
    	"pop.retired": "硅基流动已停止向 API Key 提供余额接口，现在改为读取控制台会话。",
    	"pop.low": "低于 {threshold} 的提醒阈值。",
    	"settings.title": "硅基流动余额",
    	"settings.intro": "硅基流动不再向 API Key 提供账户余额，因此余额标签读取的是控制台钱包接口的同一份数据。它需要你已登录的控制台 Cookie；该值保存在 DSH 凭据库中，不会发送到浏览器。",
    	"settings.how": "如何获取这两个值",
    	"settings.step1": "打开下面的控制台页面，如提示登录请先登录。",
    	"settings.step2": "打开浏览器开发者工具，切换到「网络 / Network」面板。",
    	"settings.step3": "刷新页面，找到发往 profile/peek 的请求。",
    	"settings.step4": "把请求头里完整的 Cookie 复制到第一栏，把 x-subject-id 的值复制到第二栏。",
    	"settings.open": "打开控制台页面",
    	"settings.cookieLabel": "Cookie 请求头",
    	"settings.cookieHint": "粘贴「Cookie:」后面的全部内容——很长是正常的。",
    	"settings.subjectLabel": "x-subject-id 请求头",
    	"settings.subjectHint": "同一请求里的短 id，例如 dbksd38a55fc73cq8k2g。",
    	"settings.save": "验证并保存",
    	"settings.saving": "正在验证会话…",
    	"settings.clear": "忘记会话",
    	"settings.saved": "会话有效。可用余额：{amount}。",
    	"settings.configured": "已保存控制台会话。",
    	"settings.notConfigured": "尚未保存控制台会话。",
    	"settings.expired": "控制台拒绝了该会话。请复制新的 Cookie 后重试。",
    	"settings.notSaved": "未保存：{message}",
    	"settings.failed": "无法连接控制台。请检查网络后重试。",
    	"settings.cleared": "已忘记控制台会话。",
    	"settings.checked": "读取于 {time}",
    	"settings.privacy": "Cookie 与 subject id 作为 DSH 凭据保存，不写入插件配置文件。"
    };
    /** The dictionaries, exported so tests can render real strings. */
    const dictionaries = {
    	en: EN,
    	zh: ZH
    };
    const CSS = `
    .dsfb_anchor{min-width:0;display:inline-flex;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px))}
    .dsfb_pill{display:inline-flex;align-items:center;gap:6px;padding:1px 8px;border:none;border-radius:var(--dsw-radius-sm);background:0 0;color:var(--dsw-alias-label-tertiary);font:inherit;font-variant-numeric:tabular-nums;cursor:pointer}
    .dsfb_pill:hover{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1)}
    .dsfb_pill:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
    .dsfb_pill[data-state='low']{color:var(--dsw-alias-state-warn-primary)}
    .dsfb_pill[data-state='unauthorized']{color:var(--dsw-alias-state-error-primary)}
    .dsfb_pill[data-state='unconfigured'],.dsfb_pill[data-state='error'],.dsfb_pill[data-state='retired'],.dsfb_pill[data-state='stale']{color:var(--dsw-alias-label-tertiary)}
    .dsfb_label{min-width:0;overflow:hidden;text-overflow:ellipsis}
    .dsfb_pop{position:fixed;z-index:10000;display:flex;flex-direction:column;gap:8px;min-width:230px;max-width:320px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:0 8px 24px rgba(0,0,0,.18);font-size:13px;line-height:1.45}
    .dsfb_pop_title{font-weight:600}
    .dsfb_rows{display:flex;flex-direction:column;gap:4px;margin:0}
    .dsfb_row{display:flex;justify-content:space-between;gap:12px}
    .dsfb_row dt{color:var(--dsw-alias-label-secondary)}
    .dsfb_row dd{margin:0;font-variant-numeric:tabular-nums}
    .dsfb_meta{color:var(--dsw-alias-label-tertiary);font-size:12px}
    .dsfb_note{color:var(--dsw-alias-label-secondary)}
    .dsfb_note[data-tone='warn']{color:var(--dsw-alias-state-warn-primary)}
    .dsfb_note[data-tone='error']{color:var(--dsw-alias-state-error-primary)}
    .dsfb_actions{display:flex;align-items:center;gap:10px;margin-top:2px}
    .dsfb_action{appearance:none;border:none;padding:0;background:0 0;color:var(--dsw-alias-brand-primary);font:inherit;cursor:pointer}
    .dsfb_action:hover{text-decoration:underline}
    .dsfb_link{color:var(--dsw-alias-brand-primary);text-decoration:none}
    .dsfb_link:hover{text-decoration:underline}
    .dsfb_setup{display:flex;flex-direction:column;gap:14px;max-width:720px;font-size:13px;line-height:1.55;color:var(--dsw-alias-label-primary)}
    .dsfb_setup_title{margin:0;font-size:16px;font-weight:600}
    .dsfb_setup_lead{margin:0;color:var(--dsw-alias-label-secondary)}
    .dsfb_setup_sub{margin:0;font-size:13px;font-weight:600}
    .dsfb_steps{margin:0;padding-left:20px;color:var(--dsw-alias-label-secondary);display:flex;flex-direction:column;gap:4px}
    .dsfb_steps code{padding:1px 4px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);font-size:12px}
    .dsfb_field{display:flex;flex-direction:column;gap:5px}
    .dsfb_field_label{font-weight:600}
    .dsfb_field_hint{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px}
    .dsfb_input{box-sizing:border-box;width:100%;padding:6px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;line-height:1.45;resize:vertical}
    .dsfb_input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-1px}
    .dsfb_setup_actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .dsfb_button{appearance:none;display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer}
    .dsfb_button:hover{border-color:var(--dsw-alias-border-l1)}
    .dsfb_button[data-variant='primary']{border-color:transparent;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
    .dsfb_button:disabled{cursor:default;opacity:.55}
    .dsfb_button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
    .dsfb_status{margin:0;color:var(--dsw-alias-label-secondary)}
    .dsfb_status[data-tone='success']{color:var(--dsw-alias-state-success-primary)}
    .dsfb_status[data-tone='warn']{color:var(--dsw-alias-state-warn-primary)}
    .dsfb_status[data-tone='error']{color:var(--dsw-alias-state-error-primary)}
    `;
    /** Install the stylesheet once per page and hand back its disposer. */
    function installStyles() {
    	const tag = document.createElement("style");
    	tag.dataset.dshSiliconflowBalance = "1";
    	tag.textContent = CSS;
    	document.head.append(tag);
    	return () => tag.remove();
    }
    const DEFAULT_POLICY = {
    	refreshSeconds: 300,
    	warnThreshold: 10,
    	showBreakdown: true
    };
    function readRoute() {
    	return fetch(ROUTE_PATH, {
    		credentials: "same-origin",
    		headers: { accept: "application/json" }
    	}).then((response) => response.json());
    }
    function postRoute(path, body) {
    	return fetch(path, {
    		method: "POST",
    		credentials: "same-origin",
    		headers: {
    			accept: "application/json",
    			...body === void 0 ? {} : { "content-type": "application/json" }
    		},
    		...body === void 0 ? {} : { body: JSON.stringify(body) }
    	}).then((response) => response.json());
    }
    function timeLabel(iso) {
    	if (iso === void 0) return "";
    	const date = new Date(iso);
    	if (Number.isNaN(date.getTime())) return "";
    	return date.toLocaleTimeString([], {
    		hour: "2-digit",
    		minute: "2-digit"
    	});
    }
    /** Floating detail card, portaled to the document body because the dock clips. */
    function BalancePopover(props) {
    	const { tr, payload, state, anchor, onClose, onRefresh, refreshing } = props;
    	const popRef = (0, react.useRef)(null);
    	const policy = payload?.policy ?? DEFAULT_POLICY;
    	const amounts = payload?.amounts;
    	const consoleUrl = payload?.consoleUrl;
    	(0, react.useEffect)(() => {
    		const onKeyDown = (event) => {
    			if (event.key === "Escape") onClose();
    		};
    		const onPointerDown = (event) => {
    			const target = event.target;
    			if (target !== null && popRef.current?.contains(target)) return;
    			onClose();
    		};
    		document.addEventListener("keydown", onKeyDown);
    		document.addEventListener("pointerdown", onPointerDown, true);
    		return () => {
    			document.removeEventListener("keydown", onKeyDown);
    			document.removeEventListener("pointerdown", onPointerDown, true);
    		};
    	}, [onClose]);
    	const style = (0, react.useMemo)(() => {
    		if (anchor === void 0) return {
    			top: 0,
    			left: 0
    		};
    		const width = 300;
    		return {
    			left: Math.min(Math.max(8, anchor.left), Math.max(8, window.innerWidth - width - 8)),
    			top: anchor.bottom + 6,
    			width: Math.min(width, window.innerWidth - 16)
    		};
    	}, [anchor]);
    	const note = (() => {
    		if (state === "unconfigured") return {
    			text: tr("pop.unconfigured", { title: tr("settings.title") }),
    			tone: "warn"
    		};
    		if (state === "unauthorized") return {
    			text: tr("pop.unauthorized", { title: tr("settings.title") }),
    			tone: "error"
    		};
    		if (state === "retired") return {
    			text: tr("pop.retired"),
    			tone: "warn"
    		};
    		if (state === "stale") return {
    			text: tr("pop.stale"),
    			tone: "plain"
    		};
    		if (state === "error") return {
    			text: tr("pop.error"),
    			tone: "plain"
    		};
    		if (state === "loading") return {
    			text: tr("pill.loading"),
    			tone: "plain"
    		};
    	})();
    	const body = (0, react.createElement)("div", {
    		className: "dsfb_pop",
    		style,
    		role: "dialog",
    		"aria-label": tr("pop.title"),
    		ref: popRef
    	}, (0, react.createElement)("div", { className: "dsfb_pop_title" }, tr("pop.title")), amounts !== void 0 && policy.showBreakdown ? (0, react.createElement)("dl", { className: "dsfb_rows" }, (0, react.createElement)("div", { className: "dsfb_row" }, (0, react.createElement)("dt", null, tr("pop.available")), (0, react.createElement)("dd", null, formatCny(amounts.available))), (0, react.createElement)("div", { className: "dsfb_row" }, (0, react.createElement)("dt", null, tr("pop.recharged")), (0, react.createElement)("dd", null, formatCny(amounts.recharged))), (0, react.createElement)("div", { className: "dsfb_row" }, (0, react.createElement)("dt", null, tr("pop.used")), (0, react.createElement)("dd", null, formatCny(amounts.used)))) : null, amounts !== void 0 && policy.warnThreshold > 0 && amounts.available < policy.warnThreshold ? (0, react.createElement)("div", {
    		className: "dsfb_note",
    		"data-tone": "warn"
    	}, tr("pop.low", { threshold: formatCny(policy.warnThreshold) })) : null, note === void 0 ? null : (0, react.createElement)("div", {
    		className: "dsfb_note",
    		"data-tone": note.tone === "plain" ? void 0 : note.tone
    	}, note.text), payload?.asOf === void 0 || amounts === void 0 ? null : (0, react.createElement)("div", { className: "dsfb_meta" }, tr("pop.asOf", { time: timeLabel(payload.asOf) })), (0, react.createElement)("div", { className: "dsfb_actions" }, (0, react.createElement)("button", {
    		type: "button",
    		className: "dsfb_action",
    		onClick: onRefresh,
    		disabled: refreshing
    	}, refreshing ? tr("pill.loading") : tr("pop.refresh")), consoleUrl === void 0 ? null : (0, react.createElement)("a", {
    		className: "dsfb_link",
    		href: consoleUrl,
    		target: "_blank",
    		rel: "noreferrer"
    	}, tr("pop.console"))));
    	return (0, react_dom.createPortal)(body, document.body);
    }
    /** The composer-dock pill: the ambient balance reading. */
    function BalancePill(props) {
    	const tr = props.tr;
    	const [payload, setPayload] = (0, react.useState)(void 0);
    	const [open, setOpen] = (0, react.useState)(false);
    	const [refreshing, setRefreshing] = (0, react.useState)(false);
    	const [loading, setLoading] = (0, react.useState)(true);
    	const [anchor, setAnchor] = (0, react.useState)(void 0);
    	const pillRef = (0, react.useRef)(null);
    	const busy = (0, react.useRef)(false);
    	const expired = (0, react.useRef)(false);
    	const load = (0, react.useCallback)(async (manual = false) => {
    		if (busy.current) return;
    		busy.current = true;
    		if (manual) setRefreshing(true);
    		try {
    			const next = await readRoute();
    			expired.current = next.ok === false && next.reason === "unauthorized";
    			setPayload((previous) => {
    				if (next.ok === false && (next.reason === "upstream" || next.reason === "invalid-response") && next.amounts === void 0 && previous?.amounts !== void 0) return {
    					...next,
    					amounts: previous.amounts,
    					...previous.asOf === void 0 ? {} : { asOf: previous.asOf }
    				};
    				return next;
    			});
    		} catch {
    			expired.current = false;
    			setPayload((previous) => ({
    				ok: false,
    				reason: "upstream",
    				configured: previous?.configured ?? true,
    				policy: previous?.policy ?? DEFAULT_POLICY,
    				consoleUrl: previous?.consoleUrl ?? "",
    				...previous?.amounts === void 0 ? {} : {
    					amounts: previous.amounts,
    					asOf: previous.asOf
    				}
    			}));
    		} finally {
    			busy.current = false;
    			setLoading(false);
    			if (manual) setRefreshing(false);
    		}
    	}, []);
    	const policy = payload?.policy ?? DEFAULT_POLICY;
    	const amounts = payload?.amounts;
    	const failure = payload?.ok === false ? payload.reason : void 0;
    	const state = loading && payload === void 0 ? "loading" : amounts !== void 0 ? payload?.ok === true && policy.warnThreshold > 0 && amounts.available < policy.warnThreshold ? "low" : payload?.ok === true ? "ok" : "stale" : failure === "unconfigured" ? "unconfigured" : failure === "unauthorized" ? "unauthorized" : failure === "retired" ? "retired" : "error";
    	const label = amounts === void 0 ? tr("pill.empty") : formatCny(amounts.available);
    	const ariaLabel = state === "unconfigured" ? tr("pill.unconfiguredAria") : state === "unauthorized" ? tr("pill.expiredAria") : state === "error" || state === "retired" ? tr("pill.errorAria") : tr("pill.aria", { amount: label });
    	(0, react.useEffect)(() => {
    		load();
    	}, [load]);
    	(0, react.useEffect)(() => {
    		const interval = expired.current ? EXPIRED_RETRY_MS : policy.refreshSeconds * 1e3;
    		const timer = window.setInterval(() => {
    			if (!document.hidden) load();
    		}, interval);
    		const wake = () => {
    			if (!document.hidden) load();
    		};
    		const onVisibility = () => {
    			if (!document.hidden) wake();
    		};
    		window.addEventListener("focus", wake);
    		document.addEventListener("visibilitychange", onVisibility);
    		return () => {
    			window.clearInterval(timer);
    			window.removeEventListener("focus", wake);
    			document.removeEventListener("visibilitychange", onVisibility);
    		};
    	}, [load, policy.refreshSeconds]);
    	const toggle = () => {
    		if (open) {
    			setOpen(false);
    			return;
    		}
    		setAnchor(pillRef.current?.getBoundingClientRect());
    		setOpen(true);
    	};
    	return (0, react.createElement)("span", {
    		className: "dsfb_anchor",
    		"data-composer-stat": SLOT_ID
    	}, (0, react.createElement)("button", {
    		type: "button",
    		ref: pillRef,
    		className: "dsfb_pill",
    		"data-state": state,
    		"aria-expanded": open,
    		"aria-haspopup": "dialog",
    		"aria-label": ariaLabel,
    		onClick: toggle
    	}, (0, react.createElement)("span", { className: "dsfb_label" }, label)), open ? (0, react.createElement)(BalancePopover, {
    		tr,
    		payload,
    		state,
    		anchor,
    		onClose: () => setOpen(false),
    		onRefresh: () => void load(true),
    		refreshing
    	}) : null);
    }
    /** Settings section: the retrieval instructions and the paste fields. */
    function BalanceSettings(props) {
    	const tr = props.tr;
    	const [payload, setPayload] = (0, react.useState)(void 0);
    	const [cookie, setCookie] = (0, react.useState)("");
    	const [subjectId, setSubjectId] = (0, react.useState)("");
    	const [busy, setBusy] = (0, react.useState)(false);
    	const [note, setNote] = (0, react.useState)(void 0);
    	const consoleUrl = payload?.consoleUrl ?? `https://cloud.siliconflow.com/me/expensebill`;
    	(0, react.useEffect)(() => {
    		let live = true;
    		readRoute().then((next) => {
    			if (live) setPayload(next);
    		}).catch(() => void 0);
    		return () => {
    			live = false;
    		};
    	}, []);
    	const save = (0, react.useCallback)(async () => {
    		setBusy(true);
    		setNote(void 0);
    		try {
    			const result = await postRoute(SESSION_PATH, {
    				cookie,
    				subjectId
    			});
    			setPayload(result);
    			if (result.ok) {
    				const available = result.amounts === void 0 ? "" : formatCny(result.amounts.available);
    				setCookie("");
    				setSubjectId("");
    				setNote({
    					text: tr("settings.saved", { amount: available }),
    					tone: "success"
    				});
    			} else if (result.reason === "unauthorized" || result.reason === "retired") setNote({
    				text: tr("settings.expired"),
    				tone: "error"
    			});
    			else if (result.message !== void 0) setNote({
    				text: tr("settings.notSaved", { message: result.message }),
    				tone: "error"
    			});
    			else setNote({
    				text: tr("settings.expired"),
    				tone: "error"
    			});
    		} catch {
    			setNote({
    				text: tr("settings.failed"),
    				tone: "error"
    			});
    		} finally {
    			setBusy(false);
    		}
    	}, [
    		cookie,
    		subjectId,
    		tr
    	]);
    	const clear = (0, react.useCallback)(async () => {
    		setBusy(true);
    		setNote(void 0);
    		try {
    			const result = await postRoute(CLEAR_PATH);
    			setPayload(result);
    			setNote({
    				text: tr("settings.cleared"),
    				tone: "success"
    			});
    		} catch {
    			setNote({
    				text: tr("settings.failed"),
    				tone: "error"
    			});
    		} finally {
    			setBusy(false);
    		}
    	}, [tr]);
    	const openConsole = () => {
    		window.open(consoleUrl, "_blank", "noopener,noreferrer");
    	};
    	const status = (() => {
    		if (payload === void 0) return tr("settings.notConfigured");
    		if (payload.ok && payload.amounts !== void 0) return `${tr("settings.configured")} ${tr("settings.saved", { amount: formatCny(payload.amounts.available) })}`;
    		if (payload.reason === "unauthorized") return tr("settings.expired");
    		if (payload.reason === "unconfigured") return tr("settings.notConfigured");
    		return tr("settings.notConfigured");
    	})();
    	return (0, react.createElement)("section", { className: "dsfb_setup" }, (0, react.createElement)("h2", { className: "dsfb_setup_title" }, tr("settings.title")), (0, react.createElement)("p", { className: "dsfb_setup_lead" }, tr("settings.intro")), (0, react.createElement)("div", { className: "dsfb_setup_actions" }, (0, react.createElement)("button", {
    		type: "button",
    		className: "dsfb_button",
    		onClick: openConsole
    	}, tr("settings.open")), payload?.asOf !== void 0 ? (0, react.createElement)("span", { className: "dsfb_meta" }, tr("settings.checked", { time: timeLabel(payload.asOf) })) : null), (0, react.createElement)("p", { className: "dsfb_setup_sub" }, tr("settings.how")), (0, react.createElement)("ol", { className: "dsfb_steps" }, (0, react.createElement)("li", null, tr("settings.step1")), (0, react.createElement)("li", null, tr("settings.step2")), (0, react.createElement)("li", null, tr("settings.step3")), (0, react.createElement)("li", null, tr("settings.step4"))), (0, react.createElement)("label", { className: "dsfb_field" }, (0, react.createElement)("span", { className: "dsfb_field_label" }, tr("settings.cookieLabel")), (0, react.createElement)("textarea", {
    		className: "dsfb_input",
    		rows: 3,
    		spellCheck: false,
    		autoComplete: "off",
    		value: cookie,
    		placeholder: "a1b2c3=…; a1b2c3-device=…",
    		onChange: (event) => setCookie(event.target.value)
    	}), (0, react.createElement)("p", { className: "dsfb_field_hint" }, tr("settings.cookieHint"))), (0, react.createElement)("label", { className: "dsfb_field" }, (0, react.createElement)("span", { className: "dsfb_field_label" }, tr("settings.subjectLabel")), (0, react.createElement)("input", {
    		className: "dsfb_input",
    		type: "text",
    		spellCheck: false,
    		autoComplete: "off",
    		value: subjectId,
    		placeholder: "dbksd38a55fc73cq8k2g",
    		onChange: (event) => setSubjectId(event.target.value)
    	}), (0, react.createElement)("p", { className: "dsfb_field_hint" }, tr("settings.subjectHint"))), (0, react.createElement)("div", { className: "dsfb_setup_actions" }, (0, react.createElement)("button", {
    		type: "button",
    		className: "dsfb_button",
    		"data-variant": "primary",
    		disabled: busy || cookie.trim() === "" || subjectId.trim() === "",
    		onClick: () => void save()
    	}, busy ? tr("settings.saving") : tr("settings.save")), (0, react.createElement)("button", {
    		type: "button",
    		className: "dsfb_button",
    		disabled: busy,
    		onClick: () => void clear()
    	}, tr("settings.clear"))), note === void 0 ? null : (0, react.createElement)("p", {
    		className: "dsfb_status",
    		"data-tone": note.tone
    	}, note.text), (0, react.createElement)("p", { className: "dsfb_status" }, status), (0, react.createElement)("p", { className: "dsfb_status" }, tr("settings.privacy")));
    }
    /** The Client half: styles, dictionaries, and both slot seats. */
    function apply(ctx) {
    	ctx.effect(() => installStyles(), "dsh-siliconflow-balance: styles");
    	ctx.effect(() => ctx.locale.register(NS, {
    		en: EN,
    		zh: ZH
    	}), "dsh-siliconflow-balance: dictionaries");
    	const tr = ctx.locale.bind(NS);
    	ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
    		name: "conversation.composer.dock",
    		id: SLOT_ID,
    		order: 2,
    		locale: NS,
    		inject: () => ({ tr })
    	}, BalancePill));
    	ctx.slots.inject("settings.section", () => ctx.slots.register({
    		name: "settings.section",
    		id: SLOT_ID,
    		order: 100,
    		label: () => tr("settings.title"),
    		locale: NS,
    		inject: () => ({ tr })
    	}, BalanceSettings));
    }
    const name = "dsh-siliconflow-balance";
    const inject = ["slots", "locale"];
    exports.BalancePill = BalancePill;
    exports.BalanceSettings = BalanceSettings;
    exports.CLEAR_PATH = CLEAR_PATH;
    exports.NS = NS;
    exports.ROUTE_PATH = ROUTE_PATH;
    exports.SESSION_PATH = SESSION_PATH;
    exports.SLOT_ID = SLOT_ID;
    exports.apply = apply;
    exports.dictionaries = dictionaries;
    exports.inject = inject;
    exports.installStyles = installStyles;
    exports.name = name;
    return module.exports;
  },
});
