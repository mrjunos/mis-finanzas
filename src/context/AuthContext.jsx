import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleProvider, db } from '../firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loginError, setLoginError] = useState('');

    const loginWithGoogle = () => {
        setLoginError('');
        return signInWithPopup(auth, googleProvider);
    };

    const logout = () => {
        return signOut(auth);
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    // Check authorization list
                    const usersRef = doc(db, 'finance_settings', 'users');
                    const usersSnap = await getDoc(usersRef);

                    if (!usersSnap.exists()) {
                        // First user ever -> becomes admin
                        console.log("Initializing first admin: ", user.email);
                        await setDoc(usersRef, {
                            allowedEmails: [user.email]
                        });
                        setCurrentUser(user);
                    } else {
                        // Document exists, check whitelist
                        const data = usersSnap.data();
                        const allowed = data.allowedEmails || [];

                        // Compare ignoring case just to be safe
                        if (allowed.some(email => email.toLowerCase() === user.email.toLowerCase())) {
                            setCurrentUser(user);
                        } else {
                            // User not in whitelist
                            console.warn("Blocked unauthorized login attempt from: ", user.email);
                            await signOut(auth);
                            setLoginError('Acceso Denegado: Tu correo no se encuentra en la lista de usuarios autorizados.');
                            setCurrentUser(null);
                        }
                    }
                } catch (error) {
                    console.error("Error checking whitelist: ", error);
                    setLoginError('Error de servidor verificando permisos.');
                    setCurrentUser(null);
                }
            } else {
                setCurrentUser(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        loginWithGoogle,
        logout,
        loginError
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
