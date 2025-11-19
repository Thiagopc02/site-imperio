// src/firebase/admin.ts
import * as admin from 'firebase-admin';

let app: admin.app.App;

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin: variáveis FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL ou FIREBASE_PRIVATE_KEY não configuradas.'
    );
  }

  // Remove aspas extras no começo/fim, se existirem
  privateKey = privateKey.replace(/^"|"$/g, '');

  // Se estiver no formato com "\n" escapado (ex: em .env local), converte para quebras de linha reais
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
} else {
  app = admin.app();
}

export { admin, app };

// Firestore Admin (usado pelos webhooks, etc.)
export const afs = admin.firestore();
