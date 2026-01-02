// js/firebase-init.js

// --- 1. PASTE YOUR KEYS HERE ---
// (Look at your old file or Firebase Console to find these values)
const firebaseConfig = {
    apiKey: "AIzaSyDkeRPtQtq4UY5zu_F4-UlkIHdMw5VW57Q",
  authDomain: "medelife-v2.firebaseapp.com",
  projectId: "medelife-v2",
  storageBucket: "medelife-v2.firebasestorage.app",
  messagingSenderId: "68690670212",
  appId: "1:68690670212:web:be822816de83dde36b88d1",
};

// --- 2. CONNECT TO FIREBASE (DO NOT CHANGE THIS PART) ---
// This uses the "compat" syntax which works with the scripts we added in login.html
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

console.log("Firebase Connected Successfully");