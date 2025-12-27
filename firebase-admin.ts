import * as admin from 'firebase-admin';

const projectId = process.env.GOOGLE_PROJECT_ID;
const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
  throw new Error('Missing Google Cloud environment variables for Firebase Admin. Check your environment variables.');
}

const firebaseAdminConfig = {
  projectId,
  clientEmail,
  // 環境変数の改行コードを正しく処理する
  privateKey: privateKey?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(firebaseAdminConfig as admin.ServiceAccount),
    });
    console.log('Firebase Admin initialized successfully');
  } catch (error: any) {
    console.error('Firebase Admin initialization error', error);
  }
}

export const db = admin.firestore();
export const auth = admin.auth();