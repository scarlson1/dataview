export type ThemeMode = "light" | "dark";

export type ChipTone = "green" | "amber" | "red" | "blue" | "grey";

export interface ChipStyle {
	bg: string;
	color: string;
}

/**
 * Design-specific colours that don't map onto the standard MUI palette. These
 * are merged into each color scheme's `palette` (see `theme.ts`) so MUI emits
 * them as CSS variables (`--mui-palette-*`) that switch automatically between
 * light and dark. Read them through `theme.vars.palette.*`.
 */
export interface AppPaletteTokens {
	/** Subtle raised surface — input fields, table header row. */
	paper2: string;
	/** Faint separators, weaker than `palette.divider`. */
	borderSoft: string;
	/** Table row separators. */
	borderRow: string;
	/** Idle outline for text inputs / secondary buttons. */
	inputBorder: string;
	/** Neutral hover overlay for icon buttons and rows. */
	hover: string;
	/** Muted icon colour. */
	iconMuted: string;
	/** Text a step stronger than `text.disabled`. */
	textMuted: string;
	/** Auth screen backdrop colour. */
	authBg: string;
	/** Primary-derived accents. */
	primarySoft: string;
	primaryHover: string;
	primaryDark: string;
	/** Foreground used on top of the primary colour (buttons, badges). */
	onPrimary: string;
	/** Status-chip palette, keyed by tone. */
	chips: Record<ChipTone, ChipStyle>;
}

/** Mode-independent monospace stack for ids, types and table names. */
export const MONO_FONT =
	"'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** Dotted backdrop for the auth screen; differs by mode. */
export const AUTH_DOTS: Record<ThemeMode, string> = {
	light:
		"radial-gradient(circle at 1px 1px, rgba(0,0,0,0.05) 1px, transparent 0)",
	dark: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)",
};

export const lightPalette: AppPaletteTokens = {
	paper2: "#fafafa",
	borderSoft: "rgba(0,0,0,0.08)",
	borderRow: "rgba(0,0,0,0.055)",
	inputBorder: "rgba(0,0,0,0.23)",
	hover: "rgba(0,0,0,0.04)",
	iconMuted: "rgba(0,0,0,0.55)",
	textMuted: "rgba(0,0,0,0.50)",
	authBg: "#eef1f5",
	primarySoft: "rgba(25,118,210,0.11)",
	primaryHover: "rgba(25,118,210,0.05)",
	primaryDark: "#1564b3",
	onPrimary: "#ffffff",
	chips: {
		green: { bg: "#e6f4ea", color: "#1e7e34" },
		amber: { bg: "#fff4e5", color: "#b26a00" },
		red: { bg: "#fdecea", color: "#c0342b" },
		blue: { bg: "#e8f0fe", color: "#1a56c4" },
		grey: { bg: "#eceff1", color: "#546e7a" },
	},
};

export const darkPalette: AppPaletteTokens = {
	paper2: "#262626",
	borderSoft: "rgba(255,255,255,0.09)",
	borderRow: "rgba(255,255,255,0.07)",
	inputBorder: "rgba(255,255,255,0.23)",
	hover: "rgba(255,255,255,0.06)",
	iconMuted: "rgba(255,255,255,0.60)",
	textMuted: "rgba(255,255,255,0.55)",
	authBg: "#0e0e0e",
	primarySoft: "rgba(122,176,229,0.20)",
	primaryHover: "rgba(122,176,229,0.10)",
	primaryDark: "#8dbbe9",
	onPrimary: "#0f1620",
	chips: {
		green: { bg: "rgba(76,175,80,0.20)", color: "#81c784" },
		amber: { bg: "rgba(255,167,38,0.20)", color: "#ffb74d" },
		red: { bg: "rgba(239,83,80,0.22)", color: "#ef9a9a" },
		blue: { bg: "rgba(66,165,245,0.24)", color: "#90caf9" },
		grey: { bg: "rgba(255,255,255,0.11)", color: "rgba(255,255,255,0.72)" },
	},
};

// export const getTokens = (mode: ThemeMode): AppTokens =>
// 	mode === "dark" ? darkPalette : lightPalette;

/** Maps a raw cell value (status / role) to a chip tone. */
export const valueTone = (value: unknown): ChipTone => {
	const v = String(value).toLowerCase();
	if (
		["active", "paid", "completed", "success", "in_stock", "delivered"].includes(
			v,
		)
	)
		return "green";
	if (["invited", "pending", "processing", "low_stock", "queued"].includes(v))
		return "amber";
	if (
		["suspended", "refunded", "failed", "error", "out_of_stock", "blocked"].includes(
			v,
		)
	)
		return "red";
	if (v === "admin") return "blue";
	return "grey";
};

/** Maps a schema key constraint (PK / UNIQUE / FK) to a chip tone. */
export const keyTone = (key: string): ChipTone => {
	const k = key.toUpperCase();
	if (k === "PK") return "blue";
	if (k === "UNIQUE") return "amber";
	return "grey";
};
