/**
 * Poseidon Design Tokens
 * Navy + Gold color scheme for professional finance aesthetic
 */

export const colors = {
  // Core palette
  navy: {
    950: '#0D1B2A',
    900: '#1B263B',
    800: '#2D3A4F',
    700: '#415A77',
    600: '#567A97',
  },
  gold: {
    500: '#F59E0B',
    400: '#FBBF24',
    300: '#FCD34D',
    600: '#D97706',
  },
  white: {
    pure: '#FFFFFF',
    soft: '#F8FAFC',
    muted: '#E2E8F0',
  },
  slate: {
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
  },

  // Semantic colors
  background: '#0D1B2A',
  foreground: '#F8FAFC',
  card: '#1B263B',
  cardHover: '#2D3A4F',
  border: '#415A77',
  borderMuted: '#2D3A4F',
  primary: '#F59E0B',
  primaryHover: '#FBBF24',
  secondary: '#415A77',
  muted: '#64748B',

  // Status colors
  success: '#22C55E',
  warning: '#FBBF24',
  danger: '#EF4444',
  info: '#3B82F6',
} as const;

export const typography = {
  fonts: {
    heading: 'var(--font-sora)',
    body: 'var(--font-inter)',
    mono: 'var(--font-jetbrains)',
  },
  weights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
  '3xl': '64px',
} as const;

export const radii = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  md: '0 4px 6px rgba(0, 0, 0, 0.4)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.4)',
  glow: '0 0 20px rgba(245, 158, 11, 0.3)',
  glowStrong: '0 0 30px rgba(245, 158, 11, 0.5)',
} as const;

// CSS custom properties for easy access
export const cssVariables = `
  --background: ${colors.background};
  --foreground: ${colors.foreground};
  --card: ${colors.card};
  --card-hover: ${colors.cardHover};
  --border: ${colors.border};
  --border-muted: ${colors.borderMuted};
  --primary: ${colors.primary};
  --primary-hover: ${colors.primaryHover};
  --secondary: ${colors.secondary};
  --muted: ${colors.muted};
  --success: ${colors.success};
  --warning: ${colors.warning};
  --danger: ${colors.danger};
  --info: ${colors.info};
`;

export default colors;
