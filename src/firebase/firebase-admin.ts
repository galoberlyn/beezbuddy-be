import * as admin from 'firebase-admin';

const bbAdminSdk = JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON || '{}');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: bbAdminSdk.project_id,
    clientEmail: bbAdminSdk.client_email,
    privateKey: bbAdminSdk.private_key,
  } as admin.ServiceAccount),
});

export default admin;
