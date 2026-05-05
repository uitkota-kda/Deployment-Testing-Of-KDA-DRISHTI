const admin = require('firebase-admin');

if (!admin.apps.length) {
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    credential = admin.credential.cert(serviceAccount);
  } else {
    const serviceAccount = require('./firebase-service-account.json');
    credential = admin.credential.cert(serviceAccount);
  }

  admin.initializeApp({
    credential,
    databaseURL: "https://kda-drishti-default-rtdb.firebaseio.com",
    storageBucket: "kda-drishti.appspot.com"
  });
  console.log('🔥 Firebase Admin SDK initialized successfully');
}

const auth = admin.auth();
const db = admin.firestore();
const rtdb = admin.database();
const storage = admin.storage();
const bucket = storage.bucket();
const messaging = admin.messaging();

module.exports = { admin, auth, db, rtdb, storage, bucket, messaging };
