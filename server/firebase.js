const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
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
