import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import {
	createContext,
	type ReactNode,
	useContext,
	useMemo,
	useState,
} from "react";
import { createAppTheme } from "./theme";
import type { ThemeMode } from "./tokens";

interface ColorModeContextValue {
	mode: ThemeMode;
	toggleMode: () => void;
}

const ColorModeContext = createContext<ColorModeContextValue | null>(null);

const STORAGE_KEY = "dataview-color-mode";

const readInitialMode = (): ThemeMode => {
	if (typeof window === "undefined") return "light";
	const stored = window.localStorage.getItem(STORAGE_KEY);
	if (stored === "light" || stored === "dark") return stored;
	return window.matchMedia?.("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
};

export const ColorModeProvider = ({ children }: { children: ReactNode }) => {
	const [mode, setMode] = useState<ThemeMode>(readInitialMode);

	const value = useMemo<ColorModeContextValue>(
		() => ({
			mode,
			toggleMode: () =>
				setMode((prev) => {
					const next = prev === "dark" ? "light" : "dark";
					window.localStorage.setItem(STORAGE_KEY, next);
					return next;
				}),
		}),
		[mode],
	);

	const theme = useMemo(() => createAppTheme(mode), [mode]);

	return (
		<ColorModeContext.Provider value={value}>
			<ThemeProvider theme={theme}>
				<CssBaseline />
				{children}
			</ThemeProvider>
		</ColorModeContext.Provider>
	);
};

export const useColorMode = (): ColorModeContextValue => {
	const ctx = useContext(ColorModeContext);
	if (!ctx)
		throw new Error("useColorMode must be used within a ColorModeProvider");
	return ctx;
};
