import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
    projectId: "brewbooks-mvp",
    appId: "1:495427564009:web:607ffc73ff70cc70191b78",
    storageBucket: "brewbooks-mvp.firebasestorage.app",
    apiKey: "AIzaSyB8ugTqPfTgMMneMY8_Jmacwf91dsINTjk",
    authDomain: "brewbooks-mvp.firebaseapp.com",
    messagingSenderId: "495427564009"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
