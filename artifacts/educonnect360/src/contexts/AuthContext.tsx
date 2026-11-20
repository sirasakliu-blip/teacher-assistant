import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import { createUserProfile, getUserProfile } from "@/lib/firestore";
import type { User, UserRole } from "@/types";

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: User | null;
  loading: boolean;
  register: (
    email: string,
    password: string,
    displayName: string,
    role: UserRole,
    inviteCode?: string,
  ) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const userProfile = await getUserProfile(user.uid);
        setProfile(userProfile);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function register(
    email: string,
    password: string,
    displayName: string,
    role: UserRole,
    inviteCode?: string,
  ) {
    if (!auth || !db) throw new Error("Firebase is not configured.");

    // Validation for Teacher role
    if (role === "teacher") {
      if (!inviteCode || !inviteCode.trim()) {
        throw new Error("กรุณากรอกรหัสลงทะเบียนบุคลากร");
      }
      const cleanCode = inviteCode.trim().toUpperCase();

      // Pre-flight check in Firestore
      const inviteRef = doc(db, "teacher_invites", cleanCode);
      const inviteSnap = await getDoc(inviteRef);
      if (!inviteSnap.exists() || inviteSnap.data()?.isUsed === true) {
        throw new Error("ไม่พบรหัสลงทะเบียนบุคลากร หรือรหัสนี้ถูกใช้งานไปแล้ว");
      }

      // Create Firebase Auth Account
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName });

      // Run Transaction to atomically create user profile and consume invite code
      try {
        await runTransaction(db, async (transaction) => {
          const freshInviteSnap = await transaction.get(inviteRef);
          if (!freshInviteSnap.exists() || freshInviteSnap.data()?.isUsed === true) {
            throw new Error("ไม่พบรหัสลงทะเบียนบุคลากร หรือรหัสนี้ถูกใช้งานไปแล้ว");
          }

          const userRef = doc(db, "users", credential.user.uid);
          transaction.set(userRef, {
            uid: credential.user.uid,
            email,
            displayName,
            role: "teacher",
            inviteCodeUsed: cleanCode,
            linkedStudentIds: [],
            photoURL: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          transaction.update(inviteRef, {
            isUsed: true,
            usedByUid: credential.user.uid,
            usedByName: displayName,
            usedAt: serverTimestamp(),
          });
        });

        const userProfile = await getUserProfile(credential.user.uid);
        setFirebaseUser(credential.user);
        setProfile(userProfile);
      } catch (txError) {
        // Rollback Firebase Auth user if transaction fails
        try {
          await credential.user.delete();
        } catch (delError) {
          console.error("Failed to rollback auth account:", delError);
        }
        throw txError;
      }
      return;
    }

    // Default flow for parent or other roles
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName });
    const userProfile = await createUserProfile(
      credential.user.uid,
      email,
      displayName,
      role,
    );
    setFirebaseUser(credential.user);
    setProfile(userProfile);
  }

  async function login(email: string, password: string) {
    if (!auth) throw new Error("Firebase Auth is not configured.");
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const userProfile = await getUserProfile(credential.user.uid);
    setFirebaseUser(credential.user);
    setProfile(userProfile);
  }

  async function logout() {
    if (!auth) return;
    await signOut(auth);
    setFirebaseUser(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider
      value={{ firebaseUser, profile, loading, register, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
