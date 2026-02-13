// components/Avatar.tsx - Reusable Avatar component with letter fallback
import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, ViewStyle, ImageStyle } from 'react-native';

interface AvatarProps {
  /** User's display name - used for letter fallback */
  name?: string | null;
  /** User's profile photo URL */
  photoURL?: string | null;
  /** Size of the avatar (width and height) */
  size?: number;
  /** Optional custom style for the container */
  style?: ViewStyle;
}

// Brand green color for default avatars
const AVATAR_BACKGROUND_COLOR = '#18b66f';

/**
 * Avatar component that displays either:
 * 1. User's profile picture if available
 * 2. First letter of name in a green circle as fallback
 */
export function Avatar({ name, photoURL, size = 40, style }: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Get first letter of name for fallback
  const getInitial = (): string => {
    if (!name || name.trim().length === 0) {
      return '?';
    }
    return name.trim().charAt(0).toUpperCase();
  };

  // Dynamically calculate font size based on avatar size
  const fontSize = Math.round(size * 0.45);

  // Show image if URL exists and hasn't errored
  const showImage = photoURL && !imageError;

  // Image-specific container style
  const imageContainerStyle: ImageStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  // View container style
  const viewContainerStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (showImage) {
    return (
      <Image
        source={{ uri: photoURL }}
        style={[styles.image, imageContainerStyle]}
        onError={() => setImageError(true)}
      />
    );
  }

  // Fallback to letter avatar
  return (
    <View style={[styles.letterContainer, viewContainerStyle, style]}>
      <Text style={[styles.letter, { fontSize }]}>
        {getInitial()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    resizeMode: 'cover',
  },
  letterContainer: {
    backgroundColor: AVATAR_BACKGROUND_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    color: '#ffffff',
    fontWeight: '700',
  },
});

export default Avatar;
