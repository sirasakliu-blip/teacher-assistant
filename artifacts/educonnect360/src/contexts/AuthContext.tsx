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
  updatePassword,
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
import type { User, UserRole, SchoolLocationInfo } from "@/types";

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
    securityKey?: string,
    schoolInfo?: SchoolLocationInfo,
  ) => Promise<void>;
  registerAdminWithGoogle: (
    user: FirebaseUser,
    displayName: string,
    securityKey: string,
    schoolInfo?: SchoolLocationInfo,
    password?: string,
  ) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  reloadUser: () => Promise<FirebaseUser | null>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  selectGoogleAccount: () => Promise<FirebaseUser>;
  registerTeacherWithEmail: (
    email: string,
    password: string,
    displayName: string,
    inviteCode: string,
    schoolInfo?: SchoolLocationInfo,
  ) => Promise<void>;
  registerTeacherWithGoogle: (
    user: FirebaseUser,
    displayName: string,
    inviteCode: string,
    schoolInfo?: SchoolLocationInfo,
    password?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
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
    securityKey?: string,
    schoolInfo?: SchoolLocationInfo,
  ) {
    if (!auth || !db) throw new Error("Firebase is not configured.");
    const cleanEmail = email.trim().toLowerCase();
    const cleanKey = (securityKey || "").trim().toUpperCase();

    // Check prefix isolation: Teachers cannot register here with TCH-
    if (cleanKey.startsWith("TCH-")) {
      throw new Error("รหัสขึ้นต้นด้วย TCH- เป็นรหัสลงทะเบียนสำหรับครู ไม่สามารถใช้ลงทะเบียนผู้ดูแลระบบได้ กรุณาใช้รหัส ADM- หรือติดต่อผู้ดูแลระบบ");
    }

    const MASTER_KEYS = ["ADMIN2026", "EDUCONNECT-ADMIN", "ADMIN-360", "ADM-0000", "0000", "ADMIN"];
    let authorized = MASTER_KEYS.includes(cleanKey);

    if (!authorized) {
      const isWhitelisted = await checkAdminWhitelist(cleanEmail);
      if (isWhitelisted) authorized = true;
    }

    if (!authorized && cleanKey) {
      const inviteRef = doc(db, "admin_invites", cleanKey);
      const inviteSnap = await getDoc(inviteRef);
      if (inviteSnap.exists() && inviteSnap.data()?.isUsed !== true) {
        authorized = true;
        await setDoc(inviteRef, { isUsed: true, usedByUid: "", usedByName: displayName, usedAt: serverTimestamp() }, { merge: true });
      }
    }

    if (!authorized) {
      throw new Error("รหัสความปลอดภัยผู้ดูแลระบบ (Admin Security Key) ไม่ถูกต้อง");
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
      schoolName: schoolInfo?.schoolName || "",
      address: schoolInfo?.address || "",
      moo: schoolInfo?.moo || "",
      postalCode: schoolInfo?.postalCode || "",
      province: schoolInfo?.province || "",
      district: schoolInfo?.district || "",
      subDistrict: schoolInfo?.subDistrict || "",
      linkedStudentIds: [],
      photoURL: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const userProfile = await getUserProfile(credential.user.uid);
    setFirebaseUser(credential.user);
    setProfile(userProfile);
  }

  async function registerAdminWithGoogle(
    user: FirebaseUser,
    displayName: string,
    securityKey: string,
    schoolInfo?: SchoolLocationInfo,
    password?: string,
  ) {
    if (!auth || !db) throw new Error("Firebase is not configured.");

    const cleanKey = (securityKey || "").trim().toUpperCase();
    const cleanEmail = (user.email || "").trim().toLowerCase();

    // Check prefix isolation: Teachers cannot register here with TCH-
    if (cleanKey.startsWith("TCH-")) {
      throw new Error("รหัสขึ้นต้นด้วย TCH- เป็นรหัสลงทะเบียนสำหรับครู ไม่สามารถใช้ลงทะเบียนผู้ดูแลระบบได้ กรุณาใช้รหัส ADM- หรือติดต่อผู้ดูแลระบบ");
    }

    // Check valid master security keys, whitelisted email, or admin invite code
    const MASTER_KEYS = ["ADMIN2026", "EDUCONNECT-ADMIN", "ADMIN-360", "ADM-0000", "0000", "ADMIN"];
    let authorized = MASTER_KEYS.includes(cleanKey);

    if (!authorized) {
      const isWhitelisted = await checkAdminWhitelist(cleanEmail);
      if (isWhitelisted) authorized = true;
    }

    if (!authorized && cleanKey) {
      const inviteRef = doc(db, "admin_invites", cleanKey);
      const inviteSnap = await getDoc(inviteRef);
      if (inviteSnap.exists() && inviteSnap.data()?.isUsed !== true) {
        authorized = true;
        await setDoc(inviteRef, { isUsed: true, usedByUid: user.uid, usedByName: displayName, usedAt: serverTimestamp() }, { merge: true });
      }
    }

    if (!authorized) {
      throw new Error("รหัสความปลอดภัยผู้ดูแลระบบ (Admin Security Key) ไม่ถูกต้อง");
    }

    await updateProfile(user, { displayName });

    if (password && password.length >= 6) {
      try {
        await updatePassword(user, password);
      } catch (pwErr) {
        console.warn("Could not set password on Google Admin account:", pwErr);
      }
    }

    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      email: cleanEmail,
      displayName,
      fullName: displayName,
      role: "admin",
      schoolName: schoolInfo?.schoolName || "",
      address: schoolInfo?.address || "",
      moo: schoolInfo?.moo || "",
      postalCode: schoolInfo?.postalCode || "",
      province: schoolInfo?.province || "",
      district: schoolInfo?.district || "",
      subDistrict: schoolInfo?.subDistrict || "",
      linkedStudentIds: [],
      photoURL: user.photoURL || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const userProfile = await getUserProfile(user.uid);
    setFirebaseUser(user);
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
    if (!userProfile) {
      await signOut(auth);
      setFirebaseUser(null);
      setProfile(null);
      throw new Error("ยังไม่พบบัญชีผู้ใช้งานในระบบ กรุณาลงทะเบียนก่อนเข้าสู่ระบบ (กด 'สมัครสมาชิก' ด้านล่าง)");
    }
    setFirebaseUser(credential.user);
    setProfile(userProfile);
  }

  async function loginWithGoogle() {
    if (!auth || !db) throw new Error("Firebase Auth is not configured.");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const credential = await signInWithPopup(auth, provider);
    const user = credential.user;

    // Strict Check: User MUST register first with invite code or admin key
    const userProfile = await getUserProfile(user.uid);
    if (!userProfile) {
      // Sign out immediately so Firebase Auth does not maintain a session for an unregistered user
      await signOut(auth);
      setFirebaseUser(null);
      setProfile(null);
      throw new Error("ยังไม่พบบัญชีผู้ใช้งานในระบบ กรุณาสมัครสมาชิก / ลงทะเบียนก่อนเข้าสู่ระบบ (กด 'สมัครสมาชิก' ด้านล่าง)");
    }

    setFirebaseUser(user);
    setProfile(userProfile);
  }

  async function selectGoogleAccount(): Promise<FirebaseUser> {
    if (!auth) throw new Error("Firebase Auth is not configured.");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const credential = await signInWithPopup(auth, provider);
    return credential.user;
  }

  async function registerTeacherWithEmail(
    email: string,
    password: string,
    displayName: string,
    inviteCode: string,
    schoolInfo?: SchoolLocationInfo,
  ) {
    if (!auth || !db) throw new Error("Firebase is not configured.");

    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanCode = (inviteCode || "").trim().toUpperCase();

    if (!cleanEmail) throw new Error("กรุณากรอกอีเมล");
    if (!password || password.length < 6) throw new Error("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
    if (!cleanCode) throw new Error("กรุณากรอกรหัสลงทะเบียนบุคลากร");

    // Check prefix isolation: Admins cannot register here with ADM-
    if (cleanCode.startsWith("ADM-")) {
      throw new Error("รหัสขึ้นต้นด้วย ADM- เป็นรหัสความปลอดภัยสำหรับผู้ดูแลระบบ (Admin) ไม่สามารถใช้ลงทะเบียนครูได้ กรุณาใช้รหัส TCH- หรือลงทะเบียนที่หน้าระบบแอดมิน");
    }

    const inviteRef = doc(db, "teacher_invites", cleanCode);
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists() || inviteSnap.data()?.isUsed === true) {
      throw new Error("ไม่พบรหัสลงทะเบียนบุคลากร หรือรหัสนี้ถูกใช้งานไปแล้ว");
    }

    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    const user = cred.user;

    await updateProfile(user, { displayName });

    await runTransaction(db, async (transaction) => {
      const freshInviteSnap = await transaction.get(inviteRef);
      if (!freshInviteSnap.exists() || freshInviteSnap.data()?.isUsed === true) {
        throw new Error("ไม่พบรหัสลงทะเบียนบุคลากร หรือรหัสนี้ถูกใช้งานไปแล้ว");
      }

      const userRef = doc(db, "users", user.uid);
      transaction.set(userRef, {
        uid: user.uid,
        email: cleanEmail,
        displayName,
        fullName: displayName,
        role: "teacher",
        inviteCodeUsed: cleanCode,
        schoolName: schoolInfo?.schoolName || "",
        address: schoolInfo?.address || "",
        moo: schoolInfo?.moo || "",
        postalCode: schoolInfo?.postalCode || "",
        province: schoolInfo?.province || "",
        district: schoolInfo?.district || "",
        subDistrict: schoolInfo?.subDistrict || "",
        linkedStudentIds: [],
        photoURL: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      transaction.update(inviteRef, {
        isUsed: true,
        usedByUid: user.uid,
        usedByName: displayName,
        usedAt: serverTimestamp(),
      });
    });

    const userProfile = await getUserProfile(user.uid);
    setFirebaseUser(user);
    setProfile(userProfile);
  }

  async function registerTeacherWithGoogle(
    user: FirebaseUser,
    displayName: string,
    inviteCode: string,
    schoolInfo?: SchoolLocationInfo,
    password?: string,
  ) {
    if (!auth || !db) throw new Error("Firebase is not configured.");

    const cleanCode = (inviteCode || "").trim().toUpperCase();
    if (!cleanCode) {
      throw new Error("กรุณากรอกรหัสลงทะเบียนบุคลากร");
    }

    // Check prefix isolation: Admins cannot register here with ADM-
    if (cleanCode.startsWith("ADM-")) {
      throw new Error("รหัสขึ้นต้นด้วย ADM- เป็นรหัสความปลอดภัยสำหรับผู้ดูแลระบบ (Admin) ไม่สามารถใช้ลงทะเบียนครูได้ กรุณาใช้รหัส TCH- หรือลงทะเบียนที่หน้าระบบแอดมิน");
    }

    const inviteRef = doc(db, "teacher_invites", cleanCode);
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists() || inviteSnap.data()?.isUsed === true) {
      throw new Error("ไม่พบรหัสลงทะเบียนบุคลากร หรือรหัสนี้ถูกใช้งานไปแล้ว");
    }

    await updateProfile(user, { displayName });

    if (password && password.length >= 6) {
      try {
        await updatePassword(user, password);
      } catch (pwErr) {
        console.warn("Could not set password for Google account:", pwErr);
      }
    }

    // Atomically create user profile and consume invite code
    await runTransaction(db, async (transaction) => {
      const freshInviteSnap = await transaction.get(inviteRef);
      if (!freshInviteSnap.exists() || freshInviteSnap.data()?.isUsed === true) {
        throw new Error("ไม่พบรหัสลงทะเบียนบุคลากร หรือรหัสนี้ถูกใช้งานไปแล้ว");
      }

      const userRef = doc(db, "users", user.uid);
      transaction.set(userRef, {
        uid: user.uid,
        email: user.email || "",
        displayName,
        fullName: displayName,
        role: "teacher",
        inviteCodeUsed: cleanCode,
        schoolName: schoolInfo?.schoolName || "",
        address: schoolInfo?.address || "",
        moo: schoolInfo?.moo || "",
        postalCode: schoolInfo?.postalCode || "",
        province: schoolInfo?.province || "",
        district: schoolInfo?.district || "",
        subDistrict: schoolInfo?.subDistrict || "",
        linkedStudentIds: [],
        photoURL: user.photoURL || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      transaction.update(inviteRef, {
        isUsed: true,
        usedByUid: user.uid,
        usedByName: displayName,
        usedAt: serverTimestamp(),
      });
    });

    const userProfile = await getUserProfile(user.uid);
    setFirebaseUser(user);
    setProfile(userProfile);
  }

  async function logout() {
    if (!auth) return;
    await signOut(auth);
    setFirebaseUser(null);
    setProfile(null);
  }

  async function refreshProfile() {
    if (auth?.currentUser) {
      const userProfile = await getUserProfile(auth.currentUser.uid);
      setProfile(userProfile);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        loading,
        register,
        registerAdmin,
        registerAdminWithGoogle,
        resendVerificationEmail,
        reloadUser,
        login,
        loginWithGoogle,
        selectGoogleAccount,
        registerTeacherWithEmail,
        registerTeacherWithGoogle,
        logout,
        refreshProfile,
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
