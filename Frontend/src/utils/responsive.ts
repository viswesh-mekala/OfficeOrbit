import { Dimensions, PixelRatio, Platform, StatusBar } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Base reference dimensions (iPhone 14 / standard Android ~6.1")
 * All hardcoded sizes in the app were designed for these dimensions.
 */
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

/**
 * Horizontal scale factor — use for widths, horizontal padding, borderRadius.
 */
export const scaleX = (size: number): number =>
  Math.round((size * SCREEN_WIDTH) / BASE_WIDTH);

/**
 * Vertical scale factor — use for heights, vertical padding, margins.
 */
export const scaleY = (size: number): number =>
  Math.round((size * SCREEN_HEIGHT) / BASE_HEIGHT);

/**
 * Moderate scale — blends horizontal with a dampening factor.
 * Best for font sizes, icon sizes, and border radius — avoids
 * text becoming too large on tablets or too small on compact phones.
 *
 * factor 0 = no scaling, 0.5 = half scaling, 1 = full scaling
 */
export const moderateScale = (size: number, factor: number = 0.35): number =>
  Math.round(size + (scaleX(size) - size) * factor);

/** Font sizes that adapt to screen width (clamped so they're never absurd). */
export const scaledFont = (size: number): number => {
  const scaled = moderateScale(size, 0.3);
  const pixelDensity = PixelRatio.getFontScale();
  // Clamp: never below 80% or above 130% of the base size
  const min = Math.round(size * 0.8);
  const max = Math.round(size * 1.3);
  return Math.max(min, Math.min(max, Math.round(scaled / pixelDensity)));
};

/** Screen dimensions for layout calculations. */
export const screen = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  isSmall: SCREEN_WIDTH < 360,
  isMedium: SCREEN_WIDTH >= 360 && SCREEN_WIDTH < 400,
  isLarge: SCREEN_WIDTH >= 400,
};

/**
 * Status bar height — used for top padding on screens without SafeAreaView.
 */
export const STATUS_BAR_HEIGHT =
  Platform.OS === 'ios' ? 44 : StatusBar.currentHeight ?? 24;

/**
 * Android 3-button nav bar takes ~48dp. Gesture nav takes ~0.
 * We rely on useSafeAreaInsets() for the actual value at runtime,
 * but this constant is useful for static StyleSheets as a fallback.
 */
export const BOTTOM_NAV_FALLBACK = Platform.OS === 'android' ? 16 : 0;
