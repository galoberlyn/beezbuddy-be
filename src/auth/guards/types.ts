import { DecodedIdToken } from 'firebase-admin/lib/auth/token-verifier';

export type DecodedFirebaseTokenWithCustomClaims = DecodedIdToken & {
  userDbId: string;
  role: string;
  org: string;
};
