import * as admin from 'firebase-admin';

const projectId = process.env.GOOGLE_PROJECT_ID;
const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY;

const firebaseAdminConfig = {
  projectId,
  clientEmail,
  // 環境変数の改行コードを正しく処理する
  privateKey: privateKey?.replace(/\\n/g, '\n'),
};

if (!projectId || !clientEmail || !privateKey) {
  throw new Error('Missing Google Cloud environment variables for Firebase Admin. Check your .env.local file.');
}

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(firebaseAdminConfig),
    });
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Firebase Admin initialization error', error);
  }
}

export const db = admin.firestore();
export const auth = admin.auth();