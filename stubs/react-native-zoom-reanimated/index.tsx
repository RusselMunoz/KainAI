// Lightweight stub that replaces the heavy react-native-zoom-reanimated dependency
// GiftedChat only needs a simple container for pinch-to-zoom. For development we can
// render a plain View and keep the API surface compatible.
import React from 'react';
import { View, ViewProps } from 'react-native';

export type ZoomProps = ViewProps & {
  children?: React.ReactNode;
};

const Zoom = ({ children, ...rest }: ZoomProps) => {
  return <View {...rest}>{children}</View>;
};

export default Zoom;
