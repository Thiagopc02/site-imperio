// src/lib/firebase-admin.ts
// Inicializa o Firebase Admin (lado do servidor) apenas uma vez.

import * as admin from 'firebase-admin';

let app: admin.app.App;

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Usa credenciais do arquivo apontado por GOOGLE_APPLICATION_CREDENTIALS
    app = admin.initializeApp();
  } else if (projectId && clientEmail && privateKey) {
    // Usa credenciais inline do .env
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } else {
    throw new Error(
      'Faltam variáveis para o Firebase Admin: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e/ou FIREBASE_PRIVATE_KEY (ou defina GOOGLE_APPLICATION_CREDENTIALS).'
    );
  }
} else {
  app = admin.app();
}

// Helpers prontos
export const adminDb = admin.firestore();
export const adminAuth = admin.auth();

// Exporta o namespace admin para quem precisar de FieldValue, Timestamp, etc.
export { admin };

// Export default evita warning de variável não usada
export default app;
