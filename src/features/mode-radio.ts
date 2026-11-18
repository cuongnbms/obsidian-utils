import { App, Component, MarkdownView, setIcon, setTooltip } from "obsidian";

type Mode = "preview" | "source";

const GROUP_CLS = "mode-radio-group";
const OPTION_CLS = "mode-radio-option";
const HIDDEN_CLS = "mode-radio-hidden";

const OPTIONS: { mode: Mode; icon: string; label: string }[] = [
	{ mode: "preview", icon: "book-open", label: "Reading view" },
	{ mode: "source", icon: "pencil", label: "Editing view" },
];

interface Attached {
	group: HTMLElement;
	buttons: Map<Mode, HTMLElement>;
	original: HTMLElement | null;
	observer: MutationObserver | null;
}

/** Replaces the Reading/Editing toggle in the note header with a radio group. */
export class ModeRadioFeature extends Component {
	private attached = new Map<MarkdownView, Attached>();

	constructor(private app: App) {
		super();
	}

	onload() {
		const refresh = () => this.refresh();
		this.app.workspace.onLayoutReady(refresh);
		this.registerEvent(this.app.workspace.on("layout-change", refresh));
		this.registerEvent(this.app.workspace.on("active-leaf-change", refresh));
		this.registerEvent(this.app.workspace.on("file-open", refresh));
	}

	onunload() {
		for (const view of [...this.attached.keys()]) this.detach(view);
	}

	/** Idempotent: attach to new markdown views, drop closed ones, sync checked state. */
	private refresh() {
		const live = new Set<MarkdownView>();
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			// Deferred (not yet loaded) leaves are not MarkdownView instances.
			if (!(view instanceof MarkdownView)) continue;
			live.add(view);
			if (!this.attached.has(view)) this.attach(view);
			this.sync(view);
		}
		for (const view of [...this.attached.keys()]) {
			if (!live.has(view)) this.detach(view);
		}
	}

	private attach(view: MarkdownView) {
		const actions = view.containerEl.querySelector<HTMLElement>(".view-actions");
		if (!actions) return;

		// `modeButtonEl` is undocumented; if it is missing, keep the pencil visible.
		const candidate = (view as unknown as { modeButtonEl?: unknown }).modeButtonEl;
		// Not `instanceof HTMLElement`: popout windows have their own realm.
		const original =
			candidate && (candidate as Node).nodeType === Node.ELEMENT_NODE ? (candidate as HTMLElement) : null;

		const group = createDiv({ cls: GROUP_CLS, attr: { role: "radiogroup", "aria-label": "View mode" } });
		const buttons = new Map<Mode, HTMLElement>();
		for (const opt of OPTIONS) {
			const btn = group.createDiv({ cls: [OPTION_CLS, "clickable-icon"], attr: { role: "radio", "data-mode": opt.mode } });
			setIcon(btn, opt.icon);
			setTooltip(btn, opt.label);
			btn.setAttr("aria-label", opt.label);
			btn.addEventListener("click", () => void this.setMode(view, opt.mode));
			btn.addEventListener("keydown", (evt) => this.onKeydown(view, opt.mode, evt));
			buttons.set(opt.mode, btn);
		}

		if (original && original.parentElement === actions) {
			actions.insertBefore(group, original);
			original.addClass(HIDDEN_CLS);
		} else {
			actions.prepend(group);
		}

		// Cmd+E and other mode switches update the original button; use it as a change signal.
		let observer: MutationObserver | null = null;
		if (original) {
			observer = new MutationObserver(() => this.sync(view));
			observer.observe(original, { attributes: true, childList: true, subtree: true });
		}

		this.attached.set(view, { group, buttons, original, observer });
	}

	private detach(view: MarkdownView) {
		const a = this.attached.get(view);
		if (!a) return;
		a.observer?.disconnect();
		a.group.remove();
		a.original?.removeClass(HIDDEN_CLS);
		this.attached.delete(view);
	}

	private sync(view: MarkdownView) {
		const a = this.attached.get(view);
		if (!a) return;
		const current = view.getMode();
		for (const [mode, btn] of a.buttons) {
			const checked = mode === current;
			btn.setAttr("aria-checked", String(checked));
			btn.setAttr("tabindex", checked ? "0" : "-1");
			btn.toggleClass("is-active", checked);
		}
	}

	private async setMode(view: MarkdownView, mode: Mode) {
		if (view.getMode() === mode) return;
		const leaf = view.leaf;
		const vs = leaf.getViewState();
		// Spread the existing state so `source` (Live Preview vs Source) is kept.
		await leaf.setViewState({ ...vs, state: { ...vs.state, mode } });
		this.sync(view);
	}

	private onKeydown(view: MarkdownView, mode: Mode, evt: KeyboardEvent) {
		const idx = OPTIONS.findIndex((o) => o.mode === mode);
		let next: Mode | null = null;
		if (evt.key === "ArrowRight" || evt.key === "ArrowDown") next = OPTIONS[(idx + 1) % OPTIONS.length].mode;
		else if (evt.key === "ArrowLeft" || evt.key === "ArrowUp") next = OPTIONS[(idx - 1 + OPTIONS.length) % OPTIONS.length].mode;
		else if (evt.key === " " || evt.key === "Enter") next = mode;
		if (!next) return;
		evt.preventDefault();
		void this.setMode(view, next).then(() => this.attached.get(view)?.buttons.get(next!)?.focus());
	}
}
