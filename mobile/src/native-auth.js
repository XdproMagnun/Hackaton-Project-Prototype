import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

export async function signInWithGoogleNative() {
  const result = await FirebaseAuthentication.signInWithGoogle();
  const idToken = result.credential?.idToken;
  if (!idToken) throw new Error('Google no devolvió un token de acceso de Firebase.');
  return idToken;
}

export function signOutNative() {
  return FirebaseAuthentication.signOut();
}
