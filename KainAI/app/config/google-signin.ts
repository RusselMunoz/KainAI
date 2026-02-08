import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';

export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: Constants.expoConfig?.extra?.webClientId,
    // If you added iOS client ID in Firebase, uncomment and set:
    // iosClientId: Constants.expoConfig?.extra?.iosClientId,
    offlineAccess: true,
    forceCodeForRefreshToken: true,
  });
};

export const ensurePlayServices = async () => {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
};