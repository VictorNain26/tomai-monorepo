/**
 * CSS-wrapped SafeAreaView
 *
 * NativeWind v5 only CSS-wraps SafeAreaProvider (not SafeAreaView).
 * This component adds className support via styled() (NativeWind v5 API).
 */

import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { styled } from 'nativewind';

export const SafeAreaView = styled(RNSafeAreaView, { className: 'style' });
