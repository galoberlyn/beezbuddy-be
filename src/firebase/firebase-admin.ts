import * as admin from 'firebase-admin';
import bbAdminSdk from './bb-admin-sdk';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: bbAdminSdk.project_id,
    clientEmail: bbAdminSdk.client_email,
    privateKey: bbAdminSdk.private_key,
  } as admin.ServiceAccount),
});

export default admin;
