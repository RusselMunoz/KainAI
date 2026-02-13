// components/LazyComponent.tsx
// Wrapper for lazy loading heavy components in React Native
import React, { Suspense, ComponentType, useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';

interface LazyComponentProps {
  factory: () => Promise<{ default: ComponentType<any> }>;
  fallback?: React.ReactNode;
  componentProps?: Record<string, any>;
}

/**
 * LazyComponent - Defers loading of heavy components until they're needed
 * 
 * Usage:
 * <LazyComponent
 *   factory={() => import('./HeavyComponent')}
 *   componentProps={{ prop1: value1 }}
 * />
 */
export function LazyComponent({ factory, fallback, componentProps = {} }: LazyComponentProps) {
  const [Component, setComponent] = useState<ComponentType<any> | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    
    factory()
      .then((module) => {
        if (mounted) {
          setComponent(() => module.default);
        }
      })
      .catch((err) => {
        if (mounted) {
          console.error('LazyComponent load error:', err);
          setError(err);
        }
      });

    return () => {
      mounted = false;
    };
  }, [factory]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Failed to load component</Text>
      </View>
    );
  }

  if (!Component) {
    return fallback || (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  return <Component {...componentProps} />;
}

/**
 * useLazyImport - Hook for lazy loading components
 * Returns [Component, isLoading, error]
 */
export function useLazyImport<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  shouldLoad: boolean = true
): [T | null, boolean, Error | null] {
  const [Component, setComponent] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!shouldLoad) return;
    
    let mounted = true;
    setLoading(true);

    factory()
      .then((module) => {
        if (mounted) {
          setComponent(() => module.default as T);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [shouldLoad]);

  return [Component, loading, error];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
  },
});

export default LazyComponent;
