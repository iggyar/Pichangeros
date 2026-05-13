import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, User as FirebaseUser, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

export type Role = "user" | "owner" | "admin";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: Role;
  createdAt: string;
  district?: string;
  favoritePosition?: string;
  phoneNumber?: string;
  paymentMethod?: string;
  paymentAccount?: string;
  identityVerified?: boolean;
  identityDocumentUrl?: string;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Listen to user profile changes
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          
          unsubscribeProfile = onSnapshot(userDocRef, async (docSnap) => {
            if (docSnap.exists()) {
              setProfile(docSnap.data() as UserProfile);
              setLoading(false);
            } else {
              // Create new user profile with default role 'user'
              // unless it's a known admin email
              const isAdminEmail = firebaseUser.email === "iggy666thepro@gmail.com" || firebaseUser.email === "ignaciotaipe0@gmail.com";
              
              const newProfile: UserProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                role: isAdminEmail ? "admin" : "user", 
                createdAt: new Date().toISOString(),
              };
              await setDoc(userDocRef, newProfile);
              setProfile(newProfile);
              setLoading(false);
            }
          }, (error) => {
            console.error("Error listening to user profile:", error);
            // If Firestore fails (e.g., due to missing config), set a mock profile
            setProfile({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              role: "user",
              createdAt: new Date().toISOString(),
            });
            setLoading(false);
          });
        } catch (error) {
          console.error("Error setting up profile listener:", error);
          setLoading(false);
        }
      } else {
        setProfile(null);
        setLoading(false);
        if (unsubscribeProfile) {
          unsubscribeProfile();
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
