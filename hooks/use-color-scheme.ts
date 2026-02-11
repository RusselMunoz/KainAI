import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * Native platforms use the color scheme directly from React Native
 */
export function useColorScheme() {
  return useRNColorScheme();
}
