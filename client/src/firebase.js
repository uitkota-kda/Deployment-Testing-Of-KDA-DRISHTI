// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCBjBH0ZVdeSqjxHu68a1RFBrIGMv_K2PE",
  authDomain: "kda-drishti.firebaseapp.com",
  projectId: "kda-drishti",
  storageBucket: "kda-drishti.firebasestorage.app",
  messagingSenderId: "1060418674566",
  appId: "1:1060418674566:web:79ade6495a545af1d35607",
  measurementId: "G-K82Q1YF6GC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, analytics, auth, db, storage };
