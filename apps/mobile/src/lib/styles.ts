import { type ViewStyle } from 'react-native';

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  } as ViewStyle,

  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 1,
    elevation: 1,
  } as ViewStyle,

  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  } as ViewStyle,

  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  } as ViewStyle,

  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  } as ViewStyle,

  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  } as ViewStyle,
};

export const bgColors = {
  primary: {
    5: 'rgba(37, 99, 235, 0.05)',
    10: 'rgba(37, 99, 235, 0.1)',
    15: 'rgba(37, 99, 235, 0.15)',
    20: 'rgba(37, 99, 235, 0.2)',
    30: 'rgba(37, 99, 235, 0.3)',
  },
  success: {
    5: 'rgba(5, 150, 105, 0.05)',
    10: 'rgba(5, 150, 105, 0.1)',
    15: 'rgba(5, 150, 105, 0.15)',
    20: 'rgba(5, 150, 105, 0.2)',
  },
  warning: {
    5: 'rgba(217, 119, 6, 0.05)',
    10: 'rgba(217, 119, 6, 0.1)',
    15: 'rgba(217, 119, 6, 0.15)',
    20: 'rgba(217, 119, 6, 0.2)',
  },
  destructive: {
    5: 'rgba(220, 38, 38, 0.05)',
    10: 'rgba(220, 38, 38, 0.1)',
    15: 'rgba(220, 38, 38, 0.15)',
    20: 'rgba(220, 38, 38, 0.2)',
  },
  info: {
    5: 'rgba(14, 165, 233, 0.05)',
    10: 'rgba(14, 165, 233, 0.1)',
    15: 'rgba(14, 165, 233, 0.15)',
    20: 'rgba(14, 165, 233, 0.2)',
  },
  muted: {
    30: 'rgba(107, 114, 128, 0.3)',
    50: 'rgba(107, 114, 128, 0.5)',
  },
  black: {
    30: 'rgba(0, 0, 0, 0.3)',
    50: 'rgba(0, 0, 0, 0.5)',
    60: 'rgba(0, 0, 0, 0.6)',
  },
  white: {
    80: 'rgba(255, 255, 255, 0.8)',
    90: 'rgba(255, 255, 255, 0.9)',
  },
  background: {
    5: 'rgba(250, 250, 249, 0.05)',
    10: 'rgba(250, 250, 249, 0.1)',
    20: 'rgba(250, 250, 249, 0.2)',
    90: 'rgba(250, 250, 249, 0.9)',
  },
};

export const borderColors = {
  primary: {
    20: 'rgba(37, 99, 235, 0.2)',
    30: 'rgba(37, 99, 235, 0.3)',
    50: 'rgba(37, 99, 235, 0.5)',
  },
  success: {
    20: 'rgba(5, 150, 105, 0.2)',
    30: 'rgba(5, 150, 105, 0.3)',
  },
  warning: {
    20: 'rgba(217, 119, 6, 0.2)',
    30: 'rgba(217, 119, 6, 0.3)',
  },
  destructive: {
    20: 'rgba(220, 38, 38, 0.2)',
    30: 'rgba(220, 38, 38, 0.3)',
  },
  info: {
    20: 'rgba(14, 165, 233, 0.2)',
    30: 'rgba(14, 165, 233, 0.3)',
  },
  muted: {
    20: 'rgba(107, 114, 128, 0.2)',
    30: 'rgba(107, 114, 128, 0.3)',
  },
};
