import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCJRusEheOjBhpeFaOGqCl_e9JxvNG0hbg",
  authDomain: "rodell-4c397.firebaseapp.com",
  projectId: "rodell-4c397",
  storageBucket: "rodell-4c397.firebasestorage.app",
  messagingSenderId: "741268630780",
  appId: "1:741268630780:web:d0cbf90a7fd3308f7cfb79",
  measurementId: "G-NXLJT71X55"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
