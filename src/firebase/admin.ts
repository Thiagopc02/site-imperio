// src/firebase/admin.ts
import * as admin from 'firebase-admin';

let app: admin.app.App;
if (admin.apps.length === 0) {
  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // no .env, as quebras de linha vêm escapadas; convertemos aqui:
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
} else {
  app = admin.app();
}

export { admin, app };

// Firestore Admin (será usado nos webhooks)
export const afs = admin.firestore();
