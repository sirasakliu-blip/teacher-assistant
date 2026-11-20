import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import {
  checkAdminWhitelist,
  createUserProfile,
  generateParentViewToken,
  getUserProfile,
} from "@/lib/firestore";
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
    inviteCodeOrExtra?: string | { inviteCode?: string; studentId?: string },
  ) => Promise<void>;
  registerAdmin: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  reloadUser: () => Promise<FirebaseUser | null>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
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
    inviteCodeOrExtra?: string | { inviteCode?: string; studentId?: string },
  ) {
    if (!auth || !db) throw new Error("Firebase is not configured.");

    const inviteCode =
      typeof inviteCodeOrExtra === "string"
        ? inviteCodeOrExtra
        : inviteCodeOrExtra?.inviteCode;
    const studentId =
      typeof inviteCodeOrExtra === "object"
        ? inviteCodeOrExtra?.studentId
        : undefined;

    // 1. Flow for Student role (with Student ID)
    if (role === "student") {
      const cleanStudentId = studentId?.trim();
      if (!cleanStudentId) {
        throw new Error("กรุณากรอกรหัสนักเรียน");
      }

      const syntheticEmail = `${cleanStudentId}@student.school.local`;
      const syntheticPassword = `STD_PASS_${cleanStudentId}`;

      let credential;
      try {
        credential = await createUserWithEmailAndPassword(auth, syntheticEmail, syntheticPassword);
      } catch (authError: any) {
        if (authError?.code === "auth/email-already-in-use") {
          throw new Error("รหัสนักเรียนนี้ถูกลงทะเบียนไปแล้ว กรุณาเข้าสู่ระบบด้วยรหัสนักเรียนนี้");
        }
        throw authError;
      }

      await updateProfile(credential.user, { displayName });

      const parentViewToken = generateParentViewToken();

      // Create document in parent_view_tokens collection
      await setDoc(doc(db, "parent_view_tokens", parentViewToken), {
        token: parentViewToken,
        studentUid: credential.user.uid,
        studentId: cleanStudentId,
        studentName: displayName,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const userProfile = await createUserProfile(
        credential.user.uid,
        syntheticEmail,
        displayName,
        "student",
        {
          studentId: cleanStudentId,
          parentViewToken,
        },
      );

      setFirebaseUser(credential.user);
      setProfile(userProfile);
      return;
    }

    // 2. Validation & Transaction for Teacher role
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
            fullName: displayName,
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

    // 3. Default flow for Parent role
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

  async function registerAdmin(
    email: string,
    password: string,
    displayName: string,
  ) {
    if (!auth || !db) throw new Error("Firebase is not configured.");
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.endsWith(".ac.th")) {
      throw new Error("อีเมลผู้ดูแลระบบต้องลงท้ายด้วย .ac.th เท่านั้น");
    }

    const isWhitelisted = await checkAdminWhitelist(cleanEmail);
    if (!isWhitelisted) {
      throw new Error("อีเมลนี้ไม่ได้รับสิทธิ์ให้ลงทะเบียนเป็นผู้ดูแลระบบ");
    }

    const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    await updateProfile(credential.user, { displayName });

    const userRef = doc(db, "users", credential.user.uid);
    await setDoc(userRef, {
      uid: credential.user.uid,
      email: cleanEmail,
      displayName,
      fullName: displayName,
      role: "admin",
      linkedStudentIds: [],
      photoURL: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    try {
      await sendEmailVerification(credential.user);
    } catch (err) {
      console.warn("sendEmailVerification warning:", err);
    }

    const userProfile = await getUserProfile(credential.user.uid);
    setFirebaseUser(credential.user);
    setProfile(userProfile);
  }

  async function resendVerificationEmail() {
    if (!auth?.currentUser) throw new Error("ไม่มีผู้ใช้ที่เข้าสู่ระบบ");
    await sendEmailVerification(auth.currentUser);
  }

  async function reloadUser(): Promise<FirebaseUser | null> {
    if (!auth?.currentUser) return null;
    await auth.currentUser.reload();
    setFirebaseUser(auth.currentUser);
    return auth.currentUser;
  }

  async function login(email: string, password: string) {
    if (!auth) throw new Error("Firebase Auth is not configured.");
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const userProfile = await getUserProfile(credential.user.uid);
    setFirebaseUser(credential.user);
    setProfile(userProfile);
  }

  async function loginWithGoogle() {
    if (!auth || !db) throw new Error("Firebase Auth is not configured.");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const credential = await signInWithPopup(auth, provider);
    const user = credential.user;

    // Check existing profile
    let userProfile = await getUserProfile(user.uid);
    if (!userProfile) {
      const cleanEmail = (user.email || "").trim().toLowerCase();
      // Check if email is an approved admin in whitelist
      const isApprovedAdmin = await checkAdminWhitelist(cleanEmail);
      const role: UserRole = isApprovedAdmin ? "admin" : "teacher";

      const newProfile: Partial<User> = {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || user.email?.split("@")[0] || "คุณครู",
        fullName: user.displayName || user.email?.split("@")[0] || "คุณครู",
        role: role,
        linkedStudentIds: [],
        photoURL: user.photoURL || null,
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
      };

      await setDoc(doc(db, "users", user.uid), newProfile);
      userProfile = await getUserProfile(user.uid);
    }

    setFirebaseUser(user);
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
      value={{
        firebaseUser,
        profile,
        loading,
        register,
        registerAdmin,
        resendVerificationEmail,
        reloadUser,
        login,
        loginWithGoogle,
        logout,
      }}
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
