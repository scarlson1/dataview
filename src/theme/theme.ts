import { createTheme } from '@mui/material/styles';
import type {} from '@mui/material/themeCssVarsAugmentation';
import { darkPalette, lightPalette, MONO_FONT, type ChipTone } from './tokens';

// Expose the custom design tokens on the MUI theme object.
declare module '@mui/material/styles' {
  interface TypeText {
    muted?: string;
  }
  interface PaletteOptions {
    paper2: string;
    authBg: string;
    borderSoft: string;
    borderRow: string;
    borderInput: string;
    hover: string;
    iconMuted: string;
    primaryHover: string;
    chips: Record<ChipTone, { bg: string; color: string }>;
  }
  interface Palette {
    paper2: string;
    authBg: string;
    borderSoft: string;
    borderRow: string;
    borderInput: string;
    hover: string;
    iconMuted: string;
    primaryHover: string;
    chips: Record<ChipTone, { bg: string; color: string }>;
  }
}

// export const createAppTheme = (): Theme => {
// 	// const tokens = getTokens(mode);
// 	// const dark = mode === "dark";

// 	return
// };

export const theme = createTheme({
  cssVariables: {
    colorSchemeSelector: 'class',
    cssVarPrefix: '',
  },
  colorSchemes: {
    light: {
      palette: {
        primary: {
          light: lightPalette.primarySoft,
          main: '#1976d2',
          dark: lightPalette.primaryDark,
          contrastText: lightPalette.onPrimary,
        },
        background: {
          default: '#f4f6f8',
          paper: '#ffffff',
        },
        text: {
          primary: 'rgba(0,0,0,0.87)',
          secondary: 'rgba(0,0,0,0.60)',
          disabled: 'rgba(0,0,0,0.35)',
          muted: 'rgba(0,0,0,0.50)',
        },
        divider: 'rgba(0,0,0,0.12)',
        paper2: '#fafafa',
        borderSoft: 'rgba(0,0,0,0.08)',
        borderRow: 'rgba(0,0,0,0.055)',
        borderInput: 'rgba(0,0,0,0.23)',
        hover: 'rgba(0,0,0,0.04)',
        iconMuted: 'rgba(0,0,0,0.55)',
        authBg: '#eef1f5',
        primaryHover: 'rgba(25,118,210,0.05)',
        chips: {
          green: { bg: '#e6f4ea', color: '#1e7e34' },
          amber: { bg: '#fff4e5', color: '#b26a00' },
          red: { bg: '#fdecea', color: '#c0342b' },
          blue: { bg: '#e8f0fe', color: '#1a56c4' },
          grey: { bg: '#eceff1', color: '#546e7a' },
          // [ChipColor.amber]: { bg: "#fff4e5", color: "#b26a00" },
          // [ChipColor.red]: { bg: "#fdecea", color: "#c0342b" },
          // [ChipColor.blue]: { bg: "#e8f0fe", color: "#1a56c4" },
          // [ChipColor.grey]: { bg: "#eceff1", color: "#546e7a" },
        },
      },
    },
    dark: {
      palette: {
        primary: {
          light: darkPalette.primarySoft,
          main: '#7ab0e5',
          dark: darkPalette.primaryDark,
          contrastText: darkPalette.onPrimary,
        },
        background: {
          default: '#121212',
          paper: '#1e1e1e',
        },
        text: {
          primary: 'rgba(255,255,255,0.92)',
          secondary: 'rgba(255,255,255,0.68)',
          disabled: 'rgba(255,255,255,0.40)',
          muted: 'rgba(255,255,255,0.55)',
        },
        divider: 'rgba(255,255,255,0.14)',
        paper2: '#262626',
        borderSoft: 'rgba(255,255,255,0.09)',
        borderRow: 'rgba(255,255,255,0.07)',
        borderInput: 'rgba(255,255,255,0.23)',
        hover: 'rgba(255,255,255,0.06)',
        iconMuted: 'rgba(255,255,255,0.60)',
        authBg: '#0e0e0e',
        primaryHover: 'rgba(122,176,229,0.10)',
        chips: {
          green: { bg: 'rgba(76,175,80,0.20)', color: '#81c784' },
          amber: { bg: 'rgba(255,167,38,0.20)', color: '#ffb74d' },
          red: { bg: 'rgba(239,83,80,0.22)', color: '#ef9a9a' },
          blue: { bg: 'rgba(66,165,245,0.24)', color: '#90caf9' },
          grey: {
            bg: 'rgba(255,255,255,0.11)',
            color: 'rgba(255,255,255,0.72)',
          },
          // [ChipColor.green]: { bg: "rgba(76,175,80,0.20)", color: "#81c784" },
          // [ChipColor.amber]: { bg: "rgba(255,167,38,0.20)", color: "#ffb74d" },
          // [ChipColor.red]: { bg: "rgba(239,83,80,0.22)", color: "#ef9a9a" },
          // [ChipColor.blue]: { bg: "rgba(66,165,245,0.24)", color: "#90caf9" },
          // [ChipColor.grey]: { bg: "rgba(255,255,255,0.11)", color: "rgba(255,255,255,0.72)" },
        },
      },
    },
  },
  // palette: {
  // 	mode,
  // 	primary: {
  // 		main: PRIMARY[mode],
  // 		dark: tokens.primaryDark,
  // 		contrastText: tokens.onPrimary,
  // 	},
  // 	background: {
  // 		default: dark ? "#121212" : "#f4f6f8",
  // 		paper: dark ? "#1e1e1e" : "#ffffff",
  // 	},
  // 	text: {
  // 		primary: dark ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.87)",
  // 		secondary: dark ? "rgba(255,255,255,0.68)" : "rgba(0,0,0,0.60)",
  // 		disabled: dark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.35)",
  // 	},
  // 	divider: dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)",
  // },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: "'Roboto', system-ui, -apple-system, sans-serif",
    h1: { fontFamily: MONO_FONT },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { WebkitFontSmoothing: 'antialiased' },
        'input::placeholder': { color: 'rgba(128,128,128,0.7)', opacity: 1 },
        '::-webkit-scrollbar': { width: 11, height: 11 },
        '::-webkit-scrollbar-thumb': {
          background: 'rgba(128,128,128,0.4)',
          borderRadius: 6,
          border: '2px solid transparent',
          backgroundClip: 'content-box',
        },
        '::-webkit-scrollbar-thumb:hover': {
          background: 'rgba(128,128,128,0.6)',
          backgroundClip: 'content-box',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 9, letterSpacing: 0 },
        contained: ({ theme }) => ({
          boxShadow: `0 1px 3px ${theme.vars.palette.primary.light}`,
          '&:hover': {
            boxShadow: `0 2px 6px ${theme.vars.palette.primary.light}`,
          },
          ...theme.applyStyles('dark', {
            boxShadow: `0 1px 3px ${theme.vars.palette.primary.light}`,
            '&:hover': {
              boxShadow: `0 2px 6px ${theme.vars.palette.primary.light}`,
            },
          }),
        }),
        outlined: ({ theme }) => ({
          borderColor: theme.vars.palette.borderInput,
          color: theme.vars.palette.text.secondary,
          '&:hover': {
            borderColor: theme.vars.palette.borderInput,
            backgroundColor: theme.vars.palette.hover,
          },
        }),
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 8,
          color: theme.vars.palette.iconMuted,
          '&:hover': { backgroundColor: theme.vars.palette.hover },
        }),
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 9,
          backgroundColor: theme.vars.palette.background.paper,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: theme.vars.palette.borderInput,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderWidth: 1,
            borderColor: theme.vars.palette.primary.main,
          },
          '&.Mui-focused': {
            boxShadow: `0 0 0 3px ${theme.vars.palette.primary.light}`,
          },
        }),
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 9,
          '&:hover': { backgroundColor: theme.vars.palette.hover },
        }),
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 52 },
        indicator: { height: 2 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: ({ theme }) => ({
          minHeight: 52,
          textTransform: 'none',
          fontSize: 14,
          fontWeight: 500,
          color: theme.vars.palette.text.muted,
          '& svg': { color: 'inherit' },
          '&.Mui-selected': { color: theme.vars.palette.primary.main },
        }),
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: ({ theme }) => ({ borderColor: theme.vars.palette.borderRow }),
        head: ({ theme }) => ({
          fontSize: 11.5,
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: theme.vars.palette.text.muted,
          backgroundColor: theme.vars.palette.paper2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          whiteSpace: 'nowrap',
        }),
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { fontSize: 12 },
      },
    },
  },
});
