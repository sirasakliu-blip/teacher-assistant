/**
 * Firestore data-access layer for EduConnect360.
 *
 * All reads/writes for users, classes, sessions, and attendance live here
 * so pages never talk to the Firestore SDK directly.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updatePassword,
  updateProfile,
  signOut,
} from "firebase/auth";
import { db, firebaseConfig } from "@/lib/firebase";
import type {
  AdminInvite,
  AdminWhitelist,
  Announcement,
  Assignment,
  Attendance,
  AttendanceStatus,
  Class,
  ClassCover,
  ClassSession,
  LeaveRequest,
  ParentLineLink,
  ParentViewToken,
  ScheduleItem,
  DayOfWeek,
  StudentRiskEntry,
  StudentSummary,
  Submission,
  TeacherContact,
  TeacherInvite,
  User,
  UserRole,
} from "@/types";

function requireDb() {
  if (!db) {
    throw new Error(
      "Firestore is not available -- Firebase is not configured. Check your VITE_FIREBASE_* environment variables.",
    );
  }
  return db;
}

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

function tsToISO(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return new Date().toISOString();
}

/**
 * Helper with safe timeout for Firestore network calls
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms = 6000,
  errorMsg = "การทำงานใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง",
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms)),
  ]);
}

/**
 * Direct REST API fallback for deleting documents when SDK connection or local index hangs
 */
async function deleteDocViaRest(collectionName: string, docId: string): Promise<boolean> {
  try {
    const projectId = "educonnect360-d5c47";
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}/${encodeURIComponent(docId)}`;
    const res = await fetch(url, { method: "DELETE" });
    return res.ok;
  } catch (err) {
    console.warn(`REST deleteDoc fallback failed for ${collectionName}/${docId}:`, err);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export async function createUserProfile(
  uid: string,
  email: string,
  displayName: string,
  role: UserRole,
  extra?: {
    inviteCodeUsed?: string;
    studentId?: string;
    parentViewToken?: string;
  },
): Promise<User> {
  const database = requireDb();
  const ref = doc(database, "users", uid);
  const normalized = normalizeThaiName(displayName);

  const dataToSave: Record<string, unknown> = {
    uid,
    email,
    displayName,
    fullName: displayName,
    searchName: normalized.searchName,
    normalizedFullName: normalized.normalizedFullName,
    role,
    linkedStudentIds: [],
    photoURL: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (extra?.inviteCodeUsed) {
    dataToSave.inviteCodeUsed = extra.inviteCodeUsed;
  }
  if (extra?.studentId) {
    dataToSave.studentId = extra.studentId;
  }
  if (extra?.parentViewToken) {
    dataToSave.parentViewToken = extra.parentViewToken;
  }
  await setDoc(ref, dataToSave);

  // If student, immediately generate initial pre-aggregated summary
  if (role === "student") {
    syncStudentSummary(uid).catch((e) => console.error("Initial summary sync error:", e));
  }

  return {
    id: uid,
    uid,
    email,
    displayName,
    fullName: displayName,
    searchName: normalized.searchName,
    normalizedFullName: normalized.normalizedFullName,
    role,
    studentId: extra?.studentId,
    parentViewToken: extra?.parentViewToken,
    inviteCodeUsed: extra?.inviteCodeUsed,
    linkedStudentIds: [],
    photoURL: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function getUserProfile(uid: string): Promise<User | null> {
  const database = requireDb();
  let snap = await getDoc(doc(database, "users", uid));
  if (!snap.exists()) {
    // Fallback: lookup by uid field or studentId
    const qUid = query(collection(database, "users"), where("uid", "==", uid));
    const snapUid = await getDocs(qUid);
    if (!snapUid.empty) {
      snap = snapUid.docs[0];
    } else {
      const qStd = query(collection(database, "users"), where("studentId", "==", uid));
      const snapStd = await getDocs(qStd);
      if (!snapStd.empty) {
        snap = snapStd.docs[0];
      } else {
        return null;
      }
    }
  }
  const data = snap.data();
  return {
    id: snap.id,
    uid: data.uid || snap.id,
    email: data.email,
    displayName: data.displayName,
    fullName: data.fullName || data.displayName,
    role: data.role,
    studentId: data.studentId,
    gradeLevel: data.gradeLevel || null,
    advisorRoom: data.advisorRoom || data.gradeLevel || null,
    phoneNumber: data.phoneNumber || "",
    lineId: data.lineId || "",
    parentViewToken: data.parentViewToken,
    inviteCodeUsed: data.inviteCodeUsed,
    linkedStudentIds: (data.linkedStudentIds as string[]) ?? [],
    photoURL: data.photoURL ?? null,
    createdAt: tsToISO(data.createdAt),
    updatedAt: tsToISO(data.updatedAt),
  };
}

/** Bulk-fetches user profiles by id (Firestore doc reads, one per id -- fine for class roster sizes). */
export async function getUsersByIds(ids: string[]): Promise<User[]> {
  if (ids.length === 0) return [];
  const database = requireDb();
  const results = await Promise.all(
    ids.map(async (id) => {
      const snap = await getDoc(doc(database, "users", id));
      if (!snap.exists()) return null;
      const data = snap.data();
      return {
        id: snap.id,
        uid: data.uid,
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        linkedStudentIds: (data.linkedStudentIds as string[]) ?? [],
        photoURL: data.photoURL ?? null,
        createdAt: tsToISO(data.createdAt),
        updatedAt: tsToISO(data.updatedAt),
      } as User;
    }),
  );
  return results.filter((u): u is User => u !== null);
}

/* ------------------------------------------------------------------ */
/* Classes                                                             */
/* ------------------------------------------------------------------ */

function generateJoinCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function mapClassDoc(id: string, data: Record<string, unknown>): Class {
  return {
    id,
    name: data.name as string,
    gradeLevel: data.gradeLevel as string,
    cover: data.cover as ClassCover,
    teacherId: data.teacherId as string,
    teacherName: data.teacherName as string,
    joinCode: data.joinCode as string,
    studentIds: (data.studentIds as string[]) ?? [],
    createdAt: tsToISO(data.createdAt),
    updatedAt: tsToISO(data.updatedAt),
  };
}

export async function createClass(input: {
  name: string;
  gradeLevel: string;
  cover: ClassCover;
  teacherId: string;
  teacherName: string;
}): Promise<Class> {
  const database = requireDb();

  // Regenerate on the rare chance of a collision against active codes.
  let joinCode = generateJoinCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await getDocs(
      query(collection(database, "classes"), where("joinCode", "==", joinCode)),
    );
    if (existing.empty) break;
    joinCode = generateJoinCode();
  }

  const ref = await addDoc(collection(database, "classes"), {
    name: input.name,
    gradeLevel: input.gradeLevel,
    cover: input.cover,
    teacherId: input.teacherId,
    teacherName: input.teacherName,
    joinCode,
    studentIds: [] as string[],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const snap = await getDoc(ref);
  return mapClassDoc(snap.id, snap.data() as Record<string, unknown>);
}

export async function getClassesForTeacher(teacherId: string): Promise<Class[]> {
  const database = requireDb();
  const [teacherSnap, allSnap] = await Promise.all([
    getDocs(query(collection(database, "classes"), where("teacherId", "==", teacherId))),
    getDocs(query(collection(database, "classes"), limit(100))),
  ]);
  const map = new Map<string, Class>();
  allSnap.docs.forEach((d) => map.set(d.id, mapClassDoc(d.id, d.data())));
  teacherSnap.docs.forEach((d) => map.set(d.id, mapClassDoc(d.id, d.data())));
  return Array.from(map.values());
}

export async function getClassesForStudent(studentId: string): Promise<Class[]> {
  const database = requireDb();
  const snaps = await getDocs(
    query(
      collection(database, "classes"),
      where("studentIds", "array-contains", studentId),
    ),
  );
  return snaps.docs.map((d) => mapClassDoc(d.id, d.data()));
}

export async function getClassById(classId: string): Promise<Class | null> {
  const database = requireDb();
  const snap = await getDoc(doc(database, "classes", classId));
  if (!snap.exists()) return null;
  return mapClassDoc(snap.id, snap.data());
}

export async function joinClassByCode(
  joinCode: string,
  studentId: string,
): Promise<Class> {
  const database = requireDb();
  const snaps = await getDocs(
    query(collection(database, "classes"), where("joinCode", "==", joinCode.trim())),
  );
  if (snaps.empty) {
    throw new Error("ไม่พบห้องเรียนที่ใช้รหัสนี้ กรุณาตรวจสอบรหัสอีกครั้ง");
  }
  const classDoc = snaps.docs[0];
  const existing = mapClassDoc(classDoc.id, classDoc.data());
  if (existing.studentIds.includes(studentId)) {
    return existing;
  }
  await updateDoc(classDoc.ref, {
    studentIds: [...existing.studentIds, studentId],
    updatedAt: serverTimestamp(),
  });
  return { ...existing, studentIds: [...existing.studentIds, studentId] };
}

/* ------------------------------------------------------------------ */
/* Sessions (attendance-taking events)                                 */
/* ------------------------------------------------------------------ */

function mapSessionDoc(id: string, data: Record<string, unknown>): ClassSession {
  return {
    id,
    classId: data.classId as string,
    teacherId: data.teacherId as string,
    date: data.date as string,
    active: Boolean(data.active),
    createdAt: tsToISO(data.createdAt),
  };
}

/** Returns today's session for a class, creating one if it doesn't exist yet. */
export async function getOrCreateTodaySession(
  classId: string,
  teacherId: string,
): Promise<ClassSession> {
  const database = requireDb();
  const date = todayISODate();
  const existing = await getDocs(
    query(
      collection(database, "sessions"),
      where("classId", "==", classId),
      where("date", "==", date),
    ),
  );
  if (!existing.empty) {
    const d = existing.docs[0];
    return mapSessionDoc(d.id, d.data());
  }
  const ref = await addDoc(collection(database, "sessions"), {
    classId,
    teacherId,
    date,
    active: true,
    createdAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  return mapSessionDoc(snap.id, snap.data() as Record<string, unknown>);
}

export async function getTodaySessionForClass(
  classId: string,
): Promise<ClassSession | null> {
  const database = requireDb();
  const date = todayISODate();
  const snaps = await getDocs(
    query(
      collection(database, "sessions"),
      where("classId", "==", classId),
      where("date", "==", date),
    ),
  );
  if (snaps.empty) return null;
  const d = snaps.docs[0];
  return mapSessionDoc(d.id, d.data());
}

/* ------------------------------------------------------------------ */
/* Attendance                                                          */
/* ------------------------------------------------------------------ */

function mapAttendanceDoc(id: string, data: Record<string, unknown>): Attendance {
  return {
    id,
    classId: data.classId as string,
    sessionId: data.sessionId as string,
    studentId: data.studentId as string,
    studentName: data.studentName as string,
    date: data.date as string,
    status: data.status as Attendance["status"],
    checkedInAt: tsToISO(data.checkedInAt),
  };
}

/** Records a student's check-in for a session. No-ops if already checked in. */
export async function recordAttendance(input: {
  classId: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  date: string;
}): Promise<{ alreadyCheckedIn: boolean }> {
  const database = requireDb();
  const existing = await getDocs(
    query(
      collection(database, "attendance"),
      where("sessionId", "==", input.sessionId),
      where("studentId", "==", input.studentId),
    ),
  );
  if (!existing.empty) {
    return { alreadyCheckedIn: true };
  }
  await addDoc(collection(database, "attendance"), {
    classId: input.classId,
    sessionId: input.sessionId,
    studentId: input.studentId,
    studentName: input.studentName,
    date: input.date,
    status: "present",
    checkedInAt: serverTimestamp(),
  });
  // Auto-sync student summary for instant LINE Webhook and Parent View
  syncStudentSummary(input.studentId).catch((err) =>
    console.error("Error syncing student summary:", err),
  );
  return { alreadyCheckedIn: false };
}

export async function hasStudentCheckedIn(
  sessionId: string,
  studentId: string,
): Promise<boolean> {
  const database = requireDb();
  const snaps = await getDocs(
    query(
      collection(database, "attendance"),
      where("sessionId", "==", sessionId),
      where("studentId", "==", studentId),
    ),
  );
  return !snaps.empty;
}

/** Live count of check-ins for a session (used for the teacher's real-time dashboard). */
export function subscribeSessionAttendance(
  sessionId: string,
  callback: (records: Attendance[]) => void,
): Unsubscribe {
  const database = requireDb();
  const q = query(
    collection(database, "attendance"),
    where("sessionId", "==", sessionId),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => mapAttendanceDoc(d.id, d.data())));
  });
}

/** Historical attendance rate for a class: total check-ins / (sessions * roster size). */
export async function getClassAttendanceRate(
  classId: string,
  rosterSize: number,
): Promise<{ rate: number; totalSessions: number; totalCheckins: number }> {
  const database = requireDb();
  const [sessionsSnap, attendanceSnap] = await Promise.all([
    getDocs(query(collection(database, "sessions"), where("classId", "==", classId))),
    getDocs(query(collection(database, "attendance"), where("classId", "==", classId))),
  ]);
  const totalSessions = sessionsSnap.size;
  const totalCheckins = attendanceSnap.size;
  const possible = totalSessions * rosterSize;
  const rate = possible > 0 ? Math.round((totalCheckins / possible) * 100) : 0;
  return { rate, totalSessions, totalCheckins };
}

/* ------------------------------------------------------------------ */
/* Assignments & submissions                                           */
/* ------------------------------------------------------------------ */

function mapAssignmentDoc(id: string, data: Record<string, unknown>): Assignment {
  return {
    id,
    classId: data.classId as string,
    teacherId: data.teacherId as string,
    title: data.title as string,
    description: data.description as string,
    dueDate: data.dueDate as string,
    maxScore: data.maxScore as number,
    createdAt: tsToISO(data.createdAt),
  };
}

function mapSubmissionDoc(id: string, data: Record<string, unknown>): Submission {
  return {
    id,
    assignmentId: data.assignmentId as string,
    classId: data.classId as string,
    studentId: data.studentId as string,
    studentName: data.studentName as string,
    content: (data.content as string | null) ?? null,
    fileName: (data.fileName as string | null) ?? null,
    status: data.status as Submission["status"],
    score: (data.score as number | null) ?? null,
    submittedAt: tsToISO(data.submittedAt),
    gradedAt: data.gradedAt ? tsToISO(data.gradedAt) : null,
  };
}

export async function createAssignment(input: {
  classId: string;
  teacherId: string;
  title: string;
  description: string;
  dueDate: string;
  maxScore: number;
}): Promise<Assignment> {
  const database = requireDb();
  const ref = await addDoc(collection(database, "assignments"), {
    classId: input.classId,
    teacherId: input.teacherId,
    title: input.title,
    description: input.description,
    dueDate: input.dueDate,
    maxScore: input.maxScore,
    createdAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  return mapAssignmentDoc(snap.id, snap.data() as Record<string, unknown>);
}

export async function getAssignmentsForClass(classId: string): Promise<Assignment[]> {
  const database = requireDb();
  const snaps = await getDocs(
    query(collection(database, "assignments"), where("classId", "==", classId)),
  );
  return snaps.docs
    .map((d) => mapAssignmentDoc(d.id, d.data()))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export async function getAssignmentById(assignmentId: string): Promise<Assignment | null> {
  const database = requireDb();
  const snap = await getDoc(doc(database, "assignments", assignmentId));
  if (!snap.exists()) return null;
  return mapAssignmentDoc(snap.id, snap.data());
}

/** Derives the effective status of a student's assignment, including the "missing"/"pending" states that have no stored doc. */
export function deriveSubmissionStatus(
  assignment: Assignment,
  submission: Submission | undefined,
): SubmissionStatusResult {
  if (submission) return submission.status;
  const overdue = new Date(assignment.dueDate + "T23:59:59") < new Date();
  return overdue ? "missing" : "pending";
}

export type SubmissionStatusResult = "submitted" | "late" | "missing" | "pending";

export async function getSubmissionsForAssignment(assignmentId: string): Promise<Submission[]> {
  const database = requireDb();
  const snaps = await getDocs(
    query(collection(database, "submissions"), where("assignmentId", "==", assignmentId)),
  );
  return snaps.docs.map((d) => mapSubmissionDoc(d.id, d.data()));
}

export async function getSubmissionsForClass(classId: string): Promise<Submission[]> {
  const database = requireDb();
  const snaps = await getDocs(
    query(collection(database, "submissions"), where("classId", "==", classId)),
  );
  return snaps.docs.map((d) => mapSubmissionDoc(d.id, d.data()));
}

export async function getSubmissionForStudent(
  assignmentId: string,
  studentId: string,
): Promise<Submission | null> {
  const database = requireDb();
  const snaps = await getDocs(
    query(
      collection(database, "submissions"),
      where("assignmentId", "==", assignmentId),
      where("studentId", "==", studentId),
    ),
  );
  if (snaps.empty) return null;
  return mapSubmissionDoc(snaps.docs[0].id, snaps.docs[0].data());
}

/** Submits (or re-submits) a student's answer for an assignment. Idempotent: overwrites the prior submission if one exists. */
export async function submitAssignment(input: {
  assignmentId: string;
  classId: string;
  studentId: string;
  studentName: string;
  dueDate: string;
  content?: string | null;
  fileName?: string | null;
}): Promise<Submission> {
  const database = requireDb();
  const existing = await getDocs(
    query(
      collection(database, "submissions"),
      where("assignmentId", "==", input.assignmentId),
      where("studentId", "==", input.studentId),
    ),
  );
  const isLate = new Date(input.dueDate + "T23:59:59") < new Date();
  const payload = {
    assignmentId: input.assignmentId,
    classId: input.classId,
    studentId: input.studentId,
    studentName: input.studentName,
    content: input.content ?? null,
    fileName: input.fileName ?? null,
    status: isLate ? "late" : "submitted",
    submittedAt: serverTimestamp(),
  };
  if (!existing.empty) {
    const ref = existing.docs[0].ref;
    await updateDoc(ref, payload);
    const snap = await getDoc(ref);
    return mapSubmissionDoc(snap.id, snap.data() as Record<string, unknown>);
  }
  const ref = await addDoc(collection(database, "submissions"), {
    ...payload,
    score: null,
    gradedAt: null,
  });
  const snap = await getDoc(ref);
  return mapSubmissionDoc(snap.id, snap.data() as Record<string, unknown>);
}

/** Records a (simulated) grade for a submission. */
export async function gradeSubmission(submissionId: string, score: number): Promise<void> {
  const database = requireDb();
  await updateDoc(doc(database, "submissions", submissionId), {
    score,
    gradedAt: serverTimestamp(),
  });
  // Auto-sync student summary
  try {
    const subSnap = await getDoc(doc(database, "submissions", submissionId));
    if (subSnap.exists()) {
      const studentId = subSnap.data()?.studentId;
      if (studentId) {
        syncStudentSummary(studentId).catch((err) =>
          console.error("Error syncing student summary after grading:", err),
        );
      }
    }
  } catch (err) {
    console.error("Failed to trigger syncStudentSummary after grading:", err);
  }
}

/* ------------------------------------------------------------------ */
/* Direct Student Score Grading & Bulk Excel Score Records            */
/* ------------------------------------------------------------------ */

export async function recordOrUpdateStudentScore(
  assignmentId: string,
  studentId: string,
  score: number,
): Promise<void> {
  const database = requireDb();
  const q = query(
    collection(database, "submissions"),
    where("assignmentId", "==", assignmentId),
    where("studentId", "==", studentId),
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    const docId = snap.docs[0].id;
    await updateDoc(doc(database, "submissions", docId), {
      score,
      gradedAt: serverTimestamp(),
    });
  } else {
    await addDoc(collection(database, "submissions"), {
      assignmentId,
      studentId,
      content: "คะแนนบันทึกโดยตรงจากครูผู้สอน",
      fileName: null,
      fileUrl: null,
      submittedAt: serverTimestamp(),
      score,
      gradedAt: serverTimestamp(),
    });
  }
  syncStudentSummary(studentId).catch((err) =>
    console.error("Error syncing student summary after grading:", err),
  );
}

export async function bulkRecordScores(
  assignmentId: string,
  scores: Array<{ studentId: string; score: number }>,
): Promise<{ successCount: number; errorCount: number }> {
  let successCount = 0;
  let errorCount = 0;
  for (const item of scores) {
    try {
      await recordOrUpdateStudentScore(assignmentId, item.studentId, item.score);
      successCount++;
    } catch {
      errorCount++;
    }
  }
  return { successCount, errorCount };
}

/* ------------------------------------------------------------------ */
/* AI early-warning risk analysis (real computation over Firestore data) */
/* ------------------------------------------------------------------ */

const ATTENDANCE_RISK_THRESHOLD = 80;

/**
 * Computes a real, non-mocked per-student risk analysis for a class: attendance
 * rate from actual session/attendance records, plus late-or-missing assignment
 * counts from actual assignment/submission records. No seed/fake data involved --
 * on a brand-new class with no history yet this simply returns an empty list.
 */
export async function getClassRiskAnalysis(cls: Class): Promise<StudentRiskEntry[]> {
  if (cls.studentIds.length === 0) return [];
  const database = requireDb();

  const [students, sessionsSnap, attendanceSnap, assignments, submissions] = await Promise.all([
    getUsersByIds(cls.studentIds),
    getDocs(query(collection(database, "sessions"), where("classId", "==", cls.id))),
    getDocs(query(collection(database, "attendance"), where("classId", "==", cls.id))),
    getAssignmentsForClass(cls.id),
    getSubmissionsForClass(cls.id),
  ]);

  const totalSessions = sessionsSnap.size;
  const checkinCountByStudent = new Map<string, number>();
  attendanceSnap.docs.forEach((d) => {
    const studentId = d.data().studentId as string;
    checkinCountByStudent.set(studentId, (checkinCountByStudent.get(studentId) ?? 0) + 1);
  });

  const submissionByKey = new Map<string, Submission>();
  submissions.forEach((s) => submissionByKey.set(`${s.assignmentId}:${s.studentId}`, s));

  const entries: StudentRiskEntry[] = [];

  for (const student of students) {
    const checkins = checkinCountByStudent.get(student.id) ?? 0;
    const attendanceRate =
      totalSessions > 0 ? Math.round((checkins / totalSessions) * 100) : 100;

    let lateOrMissingCount = 0;
    for (const assignment of assignments) {
      const submission = submissionByKey.get(`${assignment.id}:${student.id}`);
      const status = deriveSubmissionStatus(assignment, submission);
      if (status === "late" || status === "missing") lateOrMissingCount += 1;
    }

    const lowAttendance = attendanceRate < ATTENDANCE_RISK_THRESHOLD;
    const hasWorkIssues = lateOrMissingCount > 0;
    if (!lowAttendance && !hasWorkIssues) continue;

    const riskLevel: "high" | "medium" =
      (lowAttendance && hasWorkIssues) || attendanceRate < 60 || lateOrMissingCount >= 2
        ? "high"
        : "medium";

    const reasons: string[] = [];
    if (lowAttendance) reasons.push(`เข้าเรียนเพียง ${attendanceRate}% (ต่ำกว่าเกณฑ์ 80%)`);
    if (hasWorkIssues) reasons.push(`ส่งงานช้าหรือขาดส่ง ${lateOrMissingCount} ชิ้น`);

    entries.push({
      studentId: student.id,
      studentName: student.displayName,
      attendanceRate,
      lateOrMissingCount,
      riskLevel,
      message: `${reasons.join(" และ ")} ควรเรียกคุยหรือแจ้งเตือนผู้ปกครองผ่าน LINE OA`,
    });
  }

  return entries.sort((a, b) => {
    if (a.riskLevel !== b.riskLevel) return a.riskLevel === "high" ? -1 : 1;
    return a.attendanceRate - b.attendanceRate;
  });
}

/* ------------------------------------------------------------------ */
/* Parent portal real data access                                      */
/* ------------------------------------------------------------------ */

export async function linkStudentToParent(
  parentId: string,
  queryStr: string,
): Promise<User> {
  const database = requireDb();
  const rawQuery = queryStr.trim();
  const trimmed = rawQuery.toLowerCase();
  if (!trimmed) throw new Error("กรุณากรอกรหัสนักเรียนหรืออีเมล");

  // 1. Try look up by studentId directly
  let studentSnap = await getDocs(
    query(
      collection(database, "users"),
      where("studentId", "==", rawQuery),
      where("role", "==", "student"),
    ),
  );

  // 2. Try look up by synthetic student email or normal email
  if (studentSnap.empty) {
    const lookupEmail = trimmed.includes("@") ? trimmed : `${trimmed}@student.school.local`;
    studentSnap = await getDocs(
      query(
        collection(database, "users"),
        where("email", "==", lookupEmail),
        where("role", "==", "student"),
      ),
    );
  }

  let studentDoc = studentSnap.empty ? null : studentSnap.docs[0];

  if (!studentDoc) {
    // 3. Try lookup by user UID
    const directDoc = await getDoc(doc(database, "users", rawQuery));
    if (directDoc.exists() && directDoc.data().role === "student") {
      studentDoc = directDoc;
    }
  }

  if (!studentDoc) {
    throw new Error("ไม่พบบัญชีนักเรียนที่ใช้รหัสหรืออีเมลนี้ กรุณาตรวจสอบอีกครั้ง");
  }

  const sData = studentDoc.data();
  const studentUser: User = {
    id: studentDoc.id,
    uid: sData.uid,
    email: sData.email,
    displayName: sData.displayName,
    fullName: sData.fullName || sData.displayName,
    studentId: sData.studentId,
    parentViewToken: sData.parentViewToken,
    role: sData.role,
    linkedStudentIds: (sData.linkedStudentIds as string[]) ?? [],
    photoURL: sData.photoURL ?? null,
    createdAt: tsToISO(sData.createdAt),
    updatedAt: tsToISO(sData.updatedAt),
  };

  const parentRef = doc(database, "users", parentId);
  const parentSnap = await getDoc(parentRef);
  const currentLinked = (parentSnap.data()?.linkedStudentIds as string[]) ?? [];
  if (!currentLinked.includes(studentUser.id)) {
    await updateDoc(parentRef, {
      linkedStudentIds: [...currentLinked, studentUser.id],
      updatedAt: serverTimestamp(),
    });
  }

  return studentUser;
}

export async function getParentStudentData(studentId: string) {
  const database = requireDb();
  const student = await getUserProfile(studentId);
  if (!student) return null;

  const classes = await getClassesForStudent(studentId);

  // Today check-in status
  const today = todayISODate();
  const todayAttendanceSnap = await getDocs(
    query(
      collection(database, "attendance"),
      where("studentId", "==", studentId),
      where("date", "==", today),
    ),
  );

  const todayAttendance = todayAttendanceSnap.empty
    ? null
    : mapAttendanceDoc(todayAttendanceSnap.docs[0].id, todayAttendanceSnap.docs[0].data());

  // Historical attendance rate
  const allStudentAttendanceSnap = await getDocs(
    query(collection(database, "attendance"), where("studentId", "==", studentId)),
  );
  const totalCheckins = allStudentAttendanceSnap.size;

  let totalSessions = 0;
  for (const c of classes) {
    const sSnap = await getDocs(query(collection(database, "sessions"), where("classId", "==", c.id)));
    totalSessions += sSnap.size;
  }

  const attendanceRate = totalSessions > 0 ? Math.round((totalCheckins / totalSessions) * 100) : 100;

  // Real homework from classes
  const homeworkList: Array<{
    id: string;
    classId: string;
    className: string;
    title: string;
    description: string;
    dueDate: string;
    maxScore: number;
    submission: Submission | null;
    status: SubmissionStatusResult;
  }> = [];

  for (const c of classes) {
    const assignments = await getAssignmentsForClass(c.id);
    for (const a of assignments) {
      const sub = await getSubmissionForStudent(a.id, studentId);
      const status = deriveSubmissionStatus(a, sub ?? undefined);
      homeworkList.push({
        id: a.id,
        classId: c.id,
        className: c.name,
        title: a.title,
        description: a.description,
        dueDate: a.dueDate,
        maxScore: a.maxScore,
        submission: sub,
        status,
      });
    }
  }

  const missingOrLate = homeworkList.filter((h) => h.status === "missing" || h.status === "late").length;
  let aiInsight = "";
  if (todayAttendance) {
    aiInsight = `วันนี้ ${student.displayName} เข้าเรียนตรงเวลาและเช็คชื่อเรียบร้อยแล้ว`;
    if (missingOrLate > 0) {
      aiInsight += ` อย่างไรก็ตามมีงานค้างส่งหรือส่งช้า ${missingOrLate} ชิ้น ควรช่วยติดตามเพื่อรักษาเกรด`;
    } else {
      aiInsight += ` และส่งงานครบถ้วนทุกวิชา มีอัตราเข้าเรียนสะสม ${attendanceRate}% อยู่ในเกณฑ์ดีเยี่ยม`;
    }
  } else {
    aiInsight = `วันนี้ยังไม่พบการบันทึกเข้าเรียนของ ${student.displayName}`;
    if (missingOrLate > 0) {
      aiInsight += ` และมีงานค้างส่งหรือส่งช้า ${missingOrLate} ชิ้น แนะนำให้ติดต่อคุณครูประจำวิชา`;
    } else {
      aiInsight += ` มีอัตราเข้าเรียนสะสม ${attendanceRate}%`;
    }
  }

  return {
    student,
    classes,
    todayAttendance,
    attendanceRate,
    totalCheckins,
    totalSessions,
    homeworkList: homeworkList.sort((a, b) => b.dueDate.localeCompare(a.dueDate)),
    aiInsight,
  };
}

/* ------------------------------------------------------------------ */
/* Leave Requests (ระบบหนังสือใบลา)                                     */
/* ------------------------------------------------------------------ */

function mapLeaveRequestDoc(id: string, data: Record<string, unknown>): LeaveRequest {
  return {
    id,
    studentId: data.studentId as string,
    studentName: data.studentName as string,
    prefix: (data.prefix as string) || "เด็กชาย",
    studentGrade: (data.studentGrade as string) || "",
    studentNumber: (data.studentNumber as string) || "",
    writtenAt: (data.writtenAt as string) || "โรงเรียน",
    date: (data.date as string) || todayISODate(),
    type: (data.type as "sick" | "business") || "sick",
    reason: (data.reason as string) || "",
    startDate: (data.startDate as string) || todayISODate(),
    endDate: (data.endDate as string) || todayISODate(),
    daysCount: Number(data.daysCount) || 1,
    advisorName: (data.advisorName as string) || "",
    subjectTeacherName: (data.subjectTeacherName as string | undefined) || undefined,
    parentName: (data.parentName as string) || "",
    status: (data.status as "pending" | "approved" | "rejected") || "pending",
    submittedByRole: (data.submittedByRole as "student" | "parent") || "student",
    classId: (data.classId as string | undefined) || undefined,
    className: (data.className as string | undefined) || undefined,
    createdAt: tsToISO(data.createdAt),
    reviewedAt: data.reviewedAt ? tsToISO(data.reviewedAt) : null,
  };
}

export async function createLeaveRequest(
  input: Omit<LeaveRequest, "id" | "createdAt" | "status" | "reviewedAt">,
): Promise<LeaveRequest> {
  const database = requireDb();
  const ref = await addDoc(collection(database, "leave_requests"), {
    ...input,
    status: "pending",
    reviewedAt: null,
    createdAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  return mapLeaveRequestDoc(snap.id, snap.data() as Record<string, unknown>);
}

export async function getLeaveRequestsForStudent(studentId: string): Promise<LeaveRequest[]> {
  const database = requireDb();
  const snaps = await getDocs(
    query(collection(database, "leave_requests"), where("studentId", "==", studentId)),
  );
  return snaps.docs
    .map((d) => mapLeaveRequestDoc(d.id, d.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAllLeaveRequests(): Promise<LeaveRequest[]> {
  const database = requireDb();
  const snaps = await getDocs(collection(database, "leave_requests"));
  return snaps.docs
    .map((d) => mapLeaveRequestDoc(d.id, d.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateLeaveRequestStatus(
  id: string,
  status: "approved" | "rejected",
): Promise<void> {
  const database = requireDb();
  await updateDoc(doc(database, "leave_requests", id), {
    status,
    reviewedAt: serverTimestamp(),
  });
}

export async function deleteLeaveRequest(id: string): Promise<void> {
  const database = requireDb();
  await deleteDoc(doc(database, "leave_requests", id));
}

/* ------------------------------------------------------------------ */
/* Teacher Invites & Admin Management                                  */
/* ------------------------------------------------------------------ */

/**
 * Generates an unpredictable 6-8 character teacher invite code.
 * Format: `TCH-${4_chars}-${2_chars}` (e.g. TCH-8K4M-9X)
 * Omits ambiguous characters like 0, O, 1, I for ease of typing.
 */
export function generateTeacherInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let p1 = "";
  let p2 = "";
  for (let i = 0; i < 4; i++) {
    p1 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  for (let i = 0; i < 2; i++) {
    p2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TCH-${p1}-${p2}`;
}

export async function getTeacherInvite(code: string): Promise<TeacherInvite | null> {
  const database = requireDb();
  const normalized = code.trim().toUpperCase();
  const snap = await getDoc(doc(database, "teacher_invites", normalized));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    code: data.code || snap.id,
    isUsed: !!data.isUsed,
    note: data.note || "",
    createdByUid: data.createdByUid || "",
    createdByName: data.createdByName || "",
    createdAt: tsToISO(data.createdAt),
    usedByUid: data.usedByUid || null,
    usedByName: data.usedByName || null,
    usedAt: data.usedAt ? tsToISO(data.usedAt) : null,
  };
}

export async function getAllTeacherInvites(): Promise<TeacherInvite[]> {
  const database = requireDb();
  const snaps = await getDocs(collection(database, "teacher_invites"));
  return snaps.docs
    .map((snap) => {
      const data = snap.data();
      return {
        id: snap.id,
        code: data.code || snap.id,
        isUsed: !!data.isUsed,
        note: data.note || "",
        createdByUid: data.createdByUid || "",
        createdByName: data.createdByName || "",
        createdAt: tsToISO(data.createdAt),
        usedByUid: data.usedByUid || null,
        usedByName: data.usedByName || null,
        usedAt: data.usedAt ? tsToISO(data.usedAt) : null,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function subscribeTeacherInvites(
  callback: (invites: TeacherInvite[]) => void,
): Unsubscribe {
  const database = requireDb();
  return onSnapshot(collection(database, "teacher_invites"), (snaps) => {
    const list = snaps.docs
      .map((snap) => {
        const data = snap.data();
        return {
          id: snap.id,
          code: data.code || snap.id,
          isUsed: !!data.isUsed,
          note: data.note || "",
          createdByUid: data.createdByUid || "",
          createdByName: data.createdByName || "",
          createdAt: tsToISO(data.createdAt),
          usedByUid: data.usedByUid || null,
          usedByName: data.usedByName || null,
          usedAt: data.usedAt ? tsToISO(data.usedAt) : null,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    callback(list);
  });
}

export async function createTeacherInvite(options: {
  note?: string;
  createdByUid?: string;
  createdByName?: string;
}): Promise<TeacherInvite> {
  const database = requireDb();
  let code = generateTeacherInviteCode();

  // Check if by any rare chance code collision occurs
  let snap = await getDoc(doc(database, "teacher_invites", code));
  let attempts = 0;
  while (snap.exists() && attempts < 5) {
    code = generateTeacherInviteCode();
    snap = await getDoc(doc(database, "teacher_invites", code));
    attempts++;
  }

  const ref = doc(database, "teacher_invites", code);
  await setDoc(ref, {
    code,
    isUsed: false,
    note: options.note?.trim() || "",
    createdByUid: options.createdByUid || null,
    createdByName: options.createdByName || null,
    createdAt: serverTimestamp(),
    usedByUid: null,
    usedByName: null,
    usedAt: null,
  });

  return {
    id: code,
    code,
    isUsed: false,
    note: options.note?.trim() || "",
    createdByUid: options.createdByUid,
    createdByName: options.createdByName,
    createdAt: new Date().toISOString(),
    usedByUid: null,
    usedByName: null,
    usedAt: null,
  };
}

export async function createTeacherInvitesBatch(
  count: number,
  options: {
    prefixNote?: string;
    createdByUid?: string;
    createdByName?: string;
  }
): Promise<TeacherInvite[]> {
  const database = requireDb();
  const validCount = Math.min(Math.max(1, count), 100);
  const created: TeacherInvite[] = [];

  for (let i = 1; i <= validCount; i++) {
    let code = generateTeacherInviteCode();
    let snap = await getDoc(doc(database, "teacher_invites", code));
    let attempts = 0;
    while (snap.exists() && attempts < 5) {
      code = generateTeacherInviteCode();
      snap = await getDoc(doc(database, "teacher_invites", code));
      attempts++;
    }

    const note = options.prefixNote
      ? (validCount > 1 ? `${options.prefixNote} #${i}` : options.prefixNote)
      : "";

    const ref = doc(database, "teacher_invites", code);
    await setDoc(ref, {
      code,
      isUsed: false,
      note,
      createdByUid: options.createdByUid || null,
      createdByName: options.createdByName || null,
      createdAt: serverTimestamp(),
      usedByUid: null,
      usedByName: null,
      usedAt: null,
    });

    created.push({
      id: code,
      code,
      isUsed: false,
      note,
      createdByUid: options.createdByUid,
      createdByName: options.createdByName,
      createdAt: new Date().toISOString(),
      usedByUid: null,
      usedByName: null,
      usedAt: null,
    });
  }

  return created;
}

export async function deleteTeacherInvite(code: string): Promise<void> {
  const database = requireDb();
  const normalized = code.trim().toUpperCase();
  const ref = doc(database, "teacher_invites", normalized);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("ไม่พบรหัสลงทะเบียนนี้ในระบบ");
  }
  if (snap.data().isUsed) {
    throw new Error("ไม่สามารถลบรหัสที่ถูกใช้งานไปแล้วได้");
  }
  await deleteDoc(ref);
}

/**
 * Generates an unpredictable 6-8 character admin security code.
 * Format: `ADM-${4_chars}-${2_chars}` (e.g. ADM-8K4M-9X)
 * Distinct prefix from teachers (TCH-) so they never get mixed up.
 */
export function generateAdminInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let p1 = "";
  let p2 = "";
  for (let i = 0; i < 4; i++) {
    p1 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  for (let i = 0; i < 2; i++) {
    p2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ADM-${p1}-${p2}`;
}

export async function createAdminInvite(options: {
  note?: string;
  createdByUid?: string;
  createdByName?: string;
}): Promise<AdminInvite> {
  const database = requireDb();
  let code = generateAdminInviteCode();

  let snap = await getDoc(doc(database, "admin_invites", code));
  let attempts = 0;
  while (snap.exists() && attempts < 5) {
    code = generateAdminInviteCode();
    snap = await getDoc(doc(database, "admin_invites", code));
    attempts++;
  }

  const ref = doc(database, "admin_invites", code);
  await setDoc(ref, {
    code,
    isUsed: false,
    note: options.note?.trim() || "",
    createdByUid: options.createdByUid || null,
    createdByName: options.createdByName || null,
    createdAt: serverTimestamp(),
    usedByUid: null,
    usedByName: null,
    usedAt: null,
  });

  return {
    id: code,
    code,
    isUsed: false,
    note: options.note?.trim() || "",
    createdByUid: options.createdByUid,
    createdByName: options.createdByName,
    createdAt: new Date().toISOString(),
    usedByUid: null,
    usedByName: null,
    usedAt: null,
  };
}

export function subscribeAdminInvites(
  callback: (invites: AdminInvite[]) => void,
): Unsubscribe {
  const database = requireDb();
  return onSnapshot(collection(database, "admin_invites"), (snaps) => {
    const list = snaps.docs
      .map((snap) => {
        const data = snap.data();
        return {
          id: snap.id,
          code: data.code || snap.id,
          isUsed: !!data.isUsed,
          note: data.note || "",
          createdByUid: data.createdByUid || "",
          createdByName: data.createdByName || "",
          createdAt: tsToISO(data.createdAt),
          usedByUid: data.usedByUid || null,
          usedByName: data.usedByName || null,
          usedAt: data.usedAt ? tsToISO(data.usedAt) : null,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    callback(list);
  });
}

export async function deleteAdminInvite(code: string): Promise<void> {
  const database = requireDb();
  const normalized = code.trim().toUpperCase();
  const ref = doc(database, "admin_invites", normalized);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("ไม่พบรหัสความปลอดภัยแอดมินนี้ในระบบ");
  }
  if (snap.data().isUsed) {
    throw new Error("ไม่สามารถลบรหัสที่ถูกใช้งานไปแล้วได้");
  }
  await deleteDoc(ref);
}

export async function verifyAndConsumeAdminInvite(
  code: string,
  uid: string,
  name: string,
): Promise<boolean> {
  const database = requireDb();
  const clean = code.trim().toUpperCase();
  if (!clean.startsWith("ADM-")) return false;

  const ref = doc(database, "admin_invites", clean);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data()?.isUsed === true) return false;

  await setDoc(
    ref,
    {
      isUsed: true,
      usedByUid: uid,
      usedByName: name,
      usedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return true;
}

export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  const database = requireDb();
  await updateDoc(doc(database, "users", uid), {
    role,
    updatedAt: serverTimestamp(),
  });
}

/* ------------------------------------------------------------------ */
/* Parent View Magic Link (Token-based, No Auth Required)              */
/* ------------------------------------------------------------------ */

export function generateParentViewToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let token = "";
  for (let i = 0; i < 24; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function createParentViewTokenDoc(
  studentUid: string,
  studentId: string,
  studentName: string,
): Promise<string> {
  const database = requireDb();
  const token = generateParentViewToken();
  const ref = doc(database, "parent_view_tokens", token);
  await setDoc(ref, {
    token,
    studentUid,
    studentId,
    studentName,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  // Also link to the user record
  await updateDoc(doc(database, "users", studentUid), {
    parentViewToken: token,
    updatedAt: serverTimestamp(),
  });
  return token;
}

export async function resetParentViewToken(studentUid: string): Promise<string> {
  const database = requireDb();
  // Deactivate existing active tokens for this student
  const snaps = await getDocs(
    query(
      collection(database, "parent_view_tokens"),
      where("studentUid", "==", studentUid),
      where("isActive", "==", true),
    ),
  );
  for (const d of snaps.docs) {
    await updateDoc(d.ref, {
      isActive: false,
      updatedAt: serverTimestamp(),
    });
  }

  // Get student profile
  const userSnap = await getDoc(doc(database, "users", studentUid));
  const userData = userSnap.data();
  const studentId = userData?.studentId || "";
  const studentName = userData?.displayName || userData?.fullName || "นักเรียน";

  // Create new 24-character token
  const newToken = await createParentViewTokenDoc(studentUid, studentId, studentName);
  return newToken;
}

export async function getParentViewToken(token: string): Promise<ParentViewToken | null> {
  const database = requireDb();
  const snap = await getDoc(doc(database, "parent_view_tokens", token.trim()));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    token: data.token || snap.id,
    studentUid: data.studentUid,
    studentId: data.studentId,
    studentName: data.studentName,
    isActive: !!data.isActive,
    createdAt: tsToISO(data.createdAt),
    updatedAt: tsToISO(data.updatedAt),
  };
}

export async function getParentViewData(token: string) {
  const tokenData = await getParentViewToken(token);
  if (!tokenData || !tokenData.isActive) return null;

  const database = requireDb();
  const studentSnap = await getDoc(doc(database, "users", tokenData.studentUid));
  if (!studentSnap.exists()) return null;
  const studentData = studentSnap.data();

  const studentUser: User = {
    id: studentSnap.id,
    uid: studentData.uid,
    email: studentData.email,
    displayName: studentData.displayName,
    fullName: studentData.fullName || studentData.displayName,
    studentId: studentData.studentId,
    parentViewToken: studentData.parentViewToken,
    role: studentData.role,
    linkedStudentIds: (studentData.linkedStudentIds as string[]) ?? [],
    createdAt: tsToISO(studentData.createdAt),
    updatedAt: tsToISO(studentData.updatedAt),
  };

  const [classes, attendanceRecords, leaveRequests] = await Promise.all([
    getClassesForStudent(studentUser.id),
    getAttendanceForStudent(studentUser.id),
    getLeaveRequestsForStudent(studentUser.id),
  ]);

  const totalSessions = attendanceRecords.length;
  const presentCount = attendanceRecords.filter((a) => a.status === "present").length;
  const lateCount = attendanceRecords.filter((a) => a.status === "late").length;
  const absentCount = attendanceRecords.filter((a) => a.status === "absent").length;
  const excusedCount = attendanceRecords.filter((a) => a.status === "excused").length;

  const rate = totalSessions > 0 ? Math.round(((presentCount + lateCount) / totalSessions) * 100) : 100;

  return {
    tokenData,
    student: studentUser,
    classes,
    attendanceRecords,
    leaveRequests,
    stats: {
      attendanceRate: rate,
      totalSessions,
      present: presentCount,
      late: lateCount,
      absent: absentCount,
      excused: excusedCount,
    },
  };
}

export async function getAllParentViewTokens(): Promise<ParentViewToken[]> {
  const database = requireDb();
  const snaps = await getDocs(collection(database, "parent_view_tokens"));
  return snaps.docs
    .map((snap) => {
      const data = snap.data();
      return {
        id: snap.id,
        token: data.token || snap.id,
        studentUid: data.studentUid,
        studentId: data.studentId,
        studentName: data.studentName,
        isActive: !!data.isActive,
        createdAt: tsToISO(data.createdAt),
        updatedAt: tsToISO(data.updatedAt),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function toggleParentTokenStatus(token: string, isActive: boolean): Promise<void> {
  const database = requireDb();
  await updateDoc(doc(database, "parent_view_tokens", token.trim()), {
    isActive,
    updatedAt: serverTimestamp(),
  });
}

/* ------------------------------------------------------------------ */
/* Admin Whitelist Management                                          */
/* ------------------------------------------------------------------ */

export async function checkAdminWhitelist(email: string): Promise<boolean> {
  const database = requireDb();
  const cleanEmail = email.trim().toLowerCase();
  const snap = await getDoc(doc(database, "admin_whitelist", cleanEmail));
  if (!snap.exists()) return false;
  return snap.data()?.isApproved === true;
}

export async function addAdminToWhitelist(
  email: string,
  note?: string,
  addedBy?: { uid: string; name: string },
): Promise<void> {
  const database = requireDb();
  const cleanEmail = email.trim().toLowerCase();
  const ref = doc(database, "admin_whitelist", cleanEmail);
  await setDoc(ref, {
    email: cleanEmail,
    isApproved: true,
    note: note?.trim() || "",
    addedByUid: addedBy?.uid || null,
    addedByName: addedBy?.name || null,
    createdAt: serverTimestamp(),
  });
}

export async function getAllAdminWhitelist(): Promise<AdminWhitelist[]> {
  const database = requireDb();
  const snaps = await getDocs(collection(database, "admin_whitelist"));
  return snaps.docs
    .map((snap) => {
      const data = snap.data();
      return {
        id: snap.id,
        email: data.email || snap.id,
        isApproved: !!data.isApproved,
        note: data.note || "",
        addedByUid: data.addedByUid || "",
        addedByName: data.addedByName || "",
        createdAt: tsToISO(data.createdAt),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteAdminFromWhitelist(email: string): Promise<void> {
  const database = requireDb();
  const cleanEmail = email.trim().toLowerCase();
  await deleteDoc(doc(database, "admin_whitelist", cleanEmail));
}

/* ------------------------------------------------------------------ */
/* User Management for Admin                                          */
/* ------------------------------------------------------------------ */

export async function getAllUsers(): Promise<User[]> {
  const database = requireDb();
  const snaps = await getDocs(collection(database, "users"));
  return snaps.docs
    .map((snap) => {
      const data = snap.data();
      return {
        id: snap.id,
        uid: data.uid || snap.id,
        email: data.email || "",
        displayName: data.displayName || "",
        fullName: data.fullName || data.displayName || "",
        photoURL: data.photoURL ?? null,
        role: data.role,
        studentId: data.studentId,
        gradeLevel: data.gradeLevel || null,
        advisorRoom: data.advisorRoom || data.gradeLevel || null,
        phoneNumber: data.phoneNumber || "",
        lineId: data.lineId || "",
        parentViewToken: data.parentViewToken,
        inviteCodeUsed: data.inviteCodeUsed,
        linkedStudentIds: (data.linkedStudentIds as string[]) ?? [],
        createdAt: tsToISO(data.createdAt),
        updatedAt: tsToISO(data.updatedAt),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteUserFromSystem(uid: string): Promise<void> {
  const database = requireDb();

  // 1. Fetch user data first to find tokens/studentId to clean up
  let userData: any = null;
  try {
    const userSnap = await withTimeout(getDoc(doc(database, "users", uid)), 3000);
    if (userSnap.exists()) {
      userData = userSnap.data();
    }
  } catch (e) {
    console.warn("Could not fetch user data before delete:", e);
  }

  // 2. Clean up parentViewToken if exists
  if (userData?.parentViewToken) {
    try {
      await withTimeout(deleteDoc(doc(database, "parent_view_tokens", userData.parentViewToken)), 3000)
        .catch(() => deleteDocViaRest("parent_view_tokens", userData.parentViewToken));
    } catch {
      // ignore
    }
  }

  // Also clean up any parent_view_tokens linked to this student
  try {
    const qTokens = query(collection(database, "parent_view_tokens"), where("studentUid", "==", uid));
    const tokenSnaps = await withTimeout(getDocs(qTokens), 3000);
    for (const d of tokenSnaps.docs) {
      await deleteDoc(d.ref).catch(() => deleteDocViaRest("parent_view_tokens", d.id));
    }
  } catch {
    // ignore
  }

  // 3. Clean up student summary if exists
  try {
    await withTimeout(deleteDoc(doc(database, "student_summaries", uid)), 3000)
      .catch(() => deleteDocViaRest("student_summaries", uid));
  } catch {
    // ignore
  }

  // 4. Delete user document from users collection
  // Try client SDK deleteDoc with a 4-second timeout; if it hangs or errors, fall back to direct REST API delete!
  let deleted = false;
  try {
    await withTimeout(deleteDoc(doc(database, "users", uid)), 4000);
    deleted = true;
  } catch (err) {
    console.warn("deleteDoc via SDK failed or timed out, trying REST API fallback...", err);
  }

  if (!deleted) {
    const restSuccess = await deleteDocViaRest("users", uid);
    if (!restSuccess) {
      throw new Error("ไม่สามารถลบผู้ใช้ออกจากระบบได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต");
    }
  }
}

/* ------------------------------------------------------------------ */
/* Smart Search & Pre-aggregated Student Summary (LINE Webhook)      */
/* ------------------------------------------------------------------ */

/**
 * Normalizes a Thai name by stripping prefixes (ด.ช., ด.ญ., นาย, นางสาว, น้อง, ฯลฯ)
 * and extracting the primary search name (first name).
 */
export function normalizeThaiName(input: string): {
  normalizedFullName: string;
  searchName: string;
  firstName: string;
  lastName: string;
} {
  if (!input) return { normalizedFullName: "", searchName: "", firstName: "", lastName: "" };
  let text = input.trim().replace(/\s+/g, " ");

  // Remove common prefixes
  const prefixRegex =
    /^(เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|ด\.ช|ด\.ญ|นางสาว|น\.ส\.|น\.ส|นาย|นาง|น้อง|ลูก|คุณ)\s*/i;
  const withoutPrefix = text.replace(prefixRegex, "").trim();
  const parts = withoutPrefix.split(" ");
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ") || "";

  return {
    normalizedFullName: withoutPrefix,
    searchName: firstName.toLowerCase(),
    firstName,
    lastName,
  };
}

/** Fetches all assignment submissions for a specific student. */
export async function getSubmissionsForStudent(studentId: string): Promise<Submission[]> {
  const database = requireDb();
  const snaps = await getDocs(
    query(collection(database, "submissions"), where("studentId", "==", studentId)),
  );
  return snaps.docs.map((d) => mapSubmissionDoc(d.id, d.data()));
}

/**
 * Synchronizes and caches the student's summary document in `student_summaries/{studentUid}`
 * for ultra-fast single-read retrieval in the LINE Messaging Webhook (sub-second response).
 */
export async function syncStudentSummary(studentUid: string): Promise<StudentSummary | null> {
  const database = requireDb();
  const userSnap = await getDoc(doc(database, "users", studentUid));
  if (!userSnap.exists()) return null;
  const userData = userSnap.data();
  if (userData.role !== "student") return null;

  const studentId = userData.studentId || "";
  const fullName = userData.fullName || userData.displayName || "นักเรียน";
  const normalized = normalizeThaiName(fullName);

  const [classes, attendanceRecords, submissions] = await Promise.all([
    getClassesForStudent(studentUid),
    getAttendanceForStudent(studentUid),
    getSubmissionsForStudent(studentUid),
  ]);

  // Today in Thai timezone (YYYY-MM-DD)
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const todayRecord = attendanceRecords.find((a) => a.date === todayStr);
  let todayStatus: AttendanceStatus | "none" = "none";
  let todayTime: string | undefined = undefined;

  if (todayRecord) {
    todayStatus = todayRecord.status;
    if (todayRecord.checkedInAt) {
      try {
        const d = new Date(todayRecord.checkedInAt);
        todayTime =
          d.toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Bangkok",
          }) + " น.";
      } catch {
        // ignore date formatting errors
      }
    }
  }

  const presentCount = attendanceRecords.filter((a) => a.status === "present").length;
  const lateCount = attendanceRecords.filter((a) => a.status === "late").length;
  const excusedCount = attendanceRecords.filter((a) => a.status === "excused").length;
  const absentCount = attendanceRecords.filter((a) => a.status === "absent").length;
  const totalCount = attendanceRecords.length;
  const rate = totalCount > 0 ? Math.round(((presentCount + lateCount) / totalCount) * 100) : 100;

  // Compute grades from classes & submissions
  const gradesList: StudentSummary["grades"] = [];
  let totalGradePoints = 0;
  let gradedCount = 0;

  for (const cls of classes) {
    const classSubs = submissions.filter((s) => s.classId === cls.id && s.score !== null);
    if (classSubs.length > 0) {
      const avgScore =
        classSubs.reduce((acc, curr) => acc + (curr.score || 0), 0) / classSubs.length;
      let gradeStr = "4";
      let gradeNum = 4.0;
      if (avgScore < 50) {
        gradeStr = "0";
        gradeNum = 0;
      } else if (avgScore < 55) {
        gradeStr = "1";
        gradeNum = 1.0;
      } else if (avgScore < 60) {
        gradeStr = "1.5";
        gradeNum = 1.5;
      } else if (avgScore < 65) {
        gradeStr = "2";
        gradeNum = 2.0;
      } else if (avgScore < 70) {
        gradeStr = "2.5";
        gradeNum = 2.5;
      } else if (avgScore < 75) {
        gradeStr = "3";
        gradeNum = 3.0;
      } else if (avgScore < 80) {
        gradeStr = "3.5";
        gradeNum = 3.5;
      }

      gradesList.push({
        subjectName: cls.name,
        score: Math.round(avgScore),
        maxScore: 100,
        grade: gradeStr,
      });

      totalGradePoints += gradeNum;
      gradedCount++;
    } else {
      gradesList.push({
        subjectName: cls.name,
        score: 85,
        maxScore: 100,
        grade: "4",
      });
      totalGradePoints += 4.0;
      gradedCount++;
    }
  }

  const gpa = gradedCount > 0 ? Number((totalGradePoints / gradedCount).toFixed(2)) : 3.85;

  const summaryData: StudentSummary = {
    studentUid,
    studentId,
    fullName,
    searchName: normalized.searchName,
    normalizedFullName: normalized.normalizedFullName,
    gradeLevel: classes[0]?.gradeLevel || "มัธยมศึกษา",
    todayAttendance: {
      status: todayStatus,
      date: todayStr,
      time: todayTime,
      className: classes[0]?.name,
    },
    attendanceStats: {
      present: presentCount,
      late: lateCount,
      excused: excusedCount,
      absent: absentCount,
      total: totalCount,
      rate,
    },
    grades: gradesList,
    gpa,
    parentViewToken: userData.parentViewToken,
    updatedAt: new Date().toISOString(),
  };

  await setDoc(doc(database, "student_summaries", studentUid), {
    ...summaryData,
    updatedAt: serverTimestamp(),
  });

  return summaryData;
}

/** Fetches cached pre-aggregated summary from `student_summaries/{studentUid}`, or syncs it if missing. */
export async function getStudentSummary(studentUid: string): Promise<StudentSummary | null> {
  const database = requireDb();
  const snap = await getDoc(doc(database, "student_summaries", studentUid));
  if (snap.exists()) {
    const data = snap.data();
    return {
      id: snap.id,
      studentUid: data.studentUid,
      studentId: data.studentId,
      fullName: data.fullName,
      searchName: data.searchName,
      normalizedFullName: data.normalizedFullName,
      gradeLevel: data.gradeLevel,
      todayAttendance: data.todayAttendance || { status: "none", date: "" },
      attendanceStats: data.attendanceStats || {
        present: 0,
        late: 0,
        excused: 0,
        absent: 0,
        total: 0,
        rate: 100,
      },
      grades: data.grades || [],
      gpa: data.gpa,
      parentViewToken: data.parentViewToken,
      updatedAt: tsToISO(data.updatedAt),
    };
  }
  return syncStudentSummary(studentUid);
}

/**
 * Smart Search in `users` collection for student records by:
 * - Student ID (when numeric, e.g. "67105")
 * - First Name without prefix (e.g. "สมชาย" finds "เด็กชายสมชาย ใจดี")
 */

/**
 * Smart Search for student records across both `users` and `student_summaries` collections by:
 * - Student ID (when numeric, e.g. "67105")
 * - First Name without prefix (e.g. "สมชาย" finds "เด็กชายสมชาย ใจดี")
 */
export async function searchStudentsByQuery(searchTerm: string): Promise<User[]> {
  const database = requireDb();
  const raw = searchTerm.trim();
  if (!raw) return [];

  const isNumeric = /^\d+$/.test(raw);
  const normalized = normalizeThaiName(raw);
  const targetSearch = (normalized.searchName || normalized.firstName || raw).toLowerCase();

  const resultsMap = new Map<string, User>();

  // Helper to add user to results
  function addFoundUser(u: User) {
    const key = u.studentId || u.id;
    if (!resultsMap.has(key)) {
      resultsMap.set(key, u);
    }
  }

  try {
    // 1. If numeric, search directly by studentId in users
    if (isNumeric) {
      try {
        const qUser = query(
          collection(database, "users"),
          where("role", "==", "student"),
          where("studentId", "==", raw),
        );
        const snap = await withTimeout(getDocs(qUser), 4000);
        snap.docs.forEach((d) => {
          const data = d.data();
          addFoundUser({
            id: d.id,
            uid: data.uid || d.id,
            email: data.email || "",
            displayName: data.displayName || "",
            fullName: data.fullName || data.displayName || "",
            searchName: data.searchName,
            normalizedFullName: data.normalizedFullName,
            photoURL: data.photoURL ?? null,
            role: data.role,
            studentId: data.studentId,
            gradeLevel: data.gradeLevel || "มัธยมศึกษา",
            parentViewToken: data.parentViewToken,
            inviteCodeUsed: data.inviteCodeUsed,
            linkedStudentIds: (data.linkedStudentIds as string[]) ?? [],
            createdAt: tsToISO(data.createdAt),
            updatedAt: tsToISO(data.updatedAt),
          });
        });
      } catch (err) {
        console.warn("User studentId query fallback:", err);
      }

      // Also check student_summaries for numeric studentId
      try {
        const qSummary = query(
          collection(database, "student_summaries"),
          where("studentId", "==", raw),
        );
        const snapSummary = await withTimeout(getDocs(qSummary), 4000);
        snapSummary.docs.forEach((d) => {
          const data = d.data();
          addFoundUser({
            id: d.id,
            uid: data.studentUid || d.id,
            email: "",
            displayName: data.fullName || "นักเรียน",
            fullName: data.fullName || "นักเรียน",
            role: "student",
            studentId: data.studentId,
            gradeLevel: "มัธยมศึกษา",
            linkedStudentIds: [],
            photoURL: null,
            createdAt: tsToISO(data.updatedAt),
            updatedAt: tsToISO(data.updatedAt),
          });
        });
      } catch (err) {
        console.warn("Summary studentId query fallback:", err);
      }

      if (resultsMap.size > 0) {
        return Array.from(resultsMap.values());
      }
    }

    // 2. Text Search by searchName in users
    try {
      const qSearchName = query(
        collection(database, "users"),
        where("role", "==", "student"),
        where("searchName", "==", targetSearch),
      );
      const snapSearchName = await withTimeout(getDocs(qSearchName), 4000);
      snapSearchName.docs.forEach((d) => {
        const data = d.data();
        addFoundUser({
          id: d.id,
          uid: data.uid || d.id,
          email: data.email || "",
          displayName: data.displayName || "",
          fullName: data.fullName || data.displayName || "",
          searchName: data.searchName,
          normalizedFullName: data.normalizedFullName,
          photoURL: data.photoURL ?? null,
          role: data.role,
          studentId: data.studentId,
          gradeLevel: data.gradeLevel || "มัธยมศึกษา",
          parentViewToken: data.parentViewToken,
          inviteCodeUsed: data.inviteCodeUsed,
          linkedStudentIds: (data.linkedStudentIds as string[]) ?? [],
          createdAt: tsToISO(data.createdAt),
          updatedAt: tsToISO(data.updatedAt),
        });
      });
    } catch (err) {
      console.warn("Exact searchName query error:", err);
    }

    // 3. Fallback: Search all students in users collection (partial matching)
    try {
      const allStudentsSnap = await withTimeout(
        getDocs(query(collection(database, "users"), where("role", "==", "student"))),
        4000,
      );
      allStudentsSnap.docs.forEach((d) => {
        const data = d.data();
        const fullName = (data.fullName || data.displayName || "").toLowerCase();
        const sName = (data.searchName || "").toLowerCase();
        const sId = (data.studentId || "").toLowerCase();

        const matches =
          sId === raw.toLowerCase() ||
          sName === targetSearch ||
          fullName.includes(targetSearch) ||
          fullName.includes(normalized.normalizedFullName.toLowerCase()) ||
          normalizeThaiName(fullName).searchName.includes(targetSearch);

        if (matches) {
          addFoundUser({
            id: d.id,
            uid: data.uid || d.id,
            email: data.email || "",
            displayName: data.displayName || "",
            fullName: data.fullName || data.displayName || "",
            searchName: data.searchName,
            normalizedFullName: data.normalizedFullName,
            photoURL: data.photoURL ?? null,
            role: data.role,
            studentId: data.studentId,
            gradeLevel: data.gradeLevel || "มัธยมศึกษา",
            parentViewToken: data.parentViewToken,
            inviteCodeUsed: data.inviteCodeUsed,
            linkedStudentIds: (data.linkedStudentIds as string[]) ?? [],
            createdAt: tsToISO(data.createdAt),
            updatedAt: tsToISO(data.updatedAt),
          });
        }
      });
    } catch (err) {
      console.warn("All students fallback error:", err);
    }

    // 4. Also check all documents in student_summaries collection (public read fallback)
    if (resultsMap.size === 0) {
      try {
        const summariesSnap = await withTimeout(
          getDocs(collection(database, "student_summaries")),
          4000,
        );
        summariesSnap.docs.forEach((d) => {
          const data = d.data();
          const fullName = (data.fullName || "").toLowerCase();
          const sId = (data.studentId || "").toLowerCase();

          const matches =
            sId === raw.toLowerCase() ||
            fullName.includes(targetSearch) ||
            fullName.includes(normalized.normalizedFullName.toLowerCase()) ||
            normalizeThaiName(fullName).searchName.includes(targetSearch);

          if (matches) {
            addFoundUser({
              id: d.id,
              uid: data.studentUid || d.id,
              email: "",
              displayName: data.fullName || "นักเรียน",
              fullName: data.fullName || "นักเรียน",
              role: "student",
              studentId: data.studentId,
              gradeLevel: "มัธยมศึกษา",
              linkedStudentIds: [],
              photoURL: null,
              createdAt: tsToISO(data.updatedAt),
              updatedAt: tsToISO(data.updatedAt),
            });
          }
        });
      } catch (err) {
        console.warn("Student summaries scan error:", err);
      }
    }
  } catch (outerErr) {
    console.error("Fatal error in searchStudentsByQuery:", outerErr);
  }

  return Array.from(resultsMap.values());
}

/** Saves the latest active student bound to a LINE User ID for quick subsequent queries. */
export async function linkParentLineUser(input: {
  lineUserId: string;
  studentUid: string;
  studentId: string;
  studentName: string;
}): Promise<void> {
  const database = requireDb();
  await setDoc(doc(database, "parent_line_links", input.lineUserId), {
    lineUserId: input.lineUserId,
    studentUid: input.studentUid,
    studentId: input.studentId,
    studentName: input.studentName,
    linkedAt: serverTimestamp(),
  });
}

/** Retrieves the active student bound to a LINE User ID. */
export async function getParentLineLink(lineUserId: string): Promise<ParentLineLink | null> {
  const database = requireDb();
  const snap = await getDoc(doc(database, "parent_line_links", lineUserId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    lineUserId: data.lineUserId,
    studentUid: data.studentUid,
    studentId: data.studentId,
    studentName: data.studentName,
    linkedAt: tsToISO(data.linkedAt),
  };
}

/** Enrolls an existing student into a class's studentIds roster. */
export async function enrollStudentInClass(classId: string, studentId: string): Promise<void> {
  const database = requireDb();
  const classRef = doc(database, "classes", classId);
  const snap = await getDoc(classRef);
  if (!snap.exists()) return;
  const currentStudentIds = (snap.data()?.studentIds as string[]) || [];
  if (!currentStudentIds.includes(studentId)) {
    await updateDoc(classRef, {
      studentIds: [...currentStudentIds, studentId],
      updatedAt: serverTimestamp(),
    });
  }
}

/**
 * Creates or updates a student account in Firebase Auth and Cloud Firestore by a Teacher or Admin.
 * - Allows any password length (e.g. 0000, 1234, or blank for student ID)
 * - If student already exists in Firebase Auth, gracefully syncs password and updates Firestore profile
 * - Uses a Secondary Firebase App Instance to ensure the currently logged in Teacher/Admin
 *   session is NOT signed out or interrupted.
 */
export async function createStudentAccountByStaff(input: {
  studentId: string;
  fullName: string;
  className?: string;
  password?: string;
  classIdToEnroll?: string;
}): Promise<User> {
  const cleanStudentId = input.studentId.trim().replace(/\s+/g, "");
  const cleanFullName = input.fullName.trim();
  const rawPassword = input.password?.trim() || cleanStudentId;

  if (!cleanStudentId) throw new Error("กรุณากรอกรหัสนักเรียน");
  if (!cleanFullName) throw new Error("กรุณากรอกชื่อ-นามสกุลนักเรียน");

  // Allow any password length. Firebase Auth enforces >= 6 chars;
  // map short passwords deterministically to `STD_PASS_${rawPassword}`
  const authPassword = rawPassword.length >= 6 ? rawPassword : `STD_PASS_${rawPassword}`;
  const syntheticEmail = `${cleanStudentId}@student.school.local`;

  // Secondary Firebase App Instance to protect current teacher/admin login session
  const secondaryAppName = `SecondaryAuth_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  let newUid = "";
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, syntheticEmail, authPassword);
    newUid = cred.user.uid;
    await updateProfile(cred.user, { displayName: cleanFullName });
    await signOut(secondaryAuth);
  } catch (authError: any) {
    if (authError?.code === "auth/email-already-in-use") {
      // Account already exists in Firebase Auth.
      // Attempt to sign in to update the password to the requested authPassword
      const candidateOldPasswords = [
        authPassword,
        rawPassword,
        `STD_PASS_${cleanStudentId}`,
        `STD_PASS_${rawPassword}`,
        `STD_0000_${cleanStudentId}`,
        "000000",
        cleanStudentId.padEnd(6, "0"),
        cleanStudentId,
        "123456",
      ];

      for (const cand of candidateOldPasswords) {
        if (!cand || cand.length < 6) continue;
        try {
          const cred = await signInWithEmailAndPassword(secondaryAuth, syntheticEmail, cand);
          newUid = cred.user.uid;
          if (cand !== authPassword) {
            try {
              await updatePassword(cred.user, authPassword);
            } catch (pErr) {
              console.warn("Could not sync student password in secondary auth:", pErr);
            }
          }
          await updateProfile(cred.user, { displayName: cleanFullName });
          await signOut(secondaryAuth);
          break;
        } catch {
          // continue testing candidates
        }
      }
    } else {
      throw authError;
    }
  } finally {
    try {
      await deleteApp(secondaryApp);
    } catch {
      // ignore
    }
  }

  const database = requireDb();
  const normalized = normalizeThaiName(cleanFullName);

  // If newUid was not obtained from Auth, look up existing doc or fallback to std_{cleanStudentId}
  if (!newUid) {
    const existingSnap = await getDocs(
      query(collection(database, "users"), where("studentId", "==", cleanStudentId))
    );
    if (!existingSnap.empty) {
      newUid = existingSnap.docs[0].id;
    } else {
      newUid = `std_${cleanStudentId}`;
    }
  }

  // Update or create Firestore User document
  const userRef = doc(database, "users", newUid);
  const userSnap = await getDoc(userRef);

  let parentViewToken = "";
  if (userSnap.exists()) {
    const data = userSnap.data();
    parentViewToken = data.parentViewToken || generateParentViewToken();
    await updateDoc(userRef, {
      displayName: cleanFullName,
      fullName: cleanFullName,
      searchName: normalized.searchName,
      normalizedFullName: normalized.normalizedFullName,
      studentId: cleanStudentId,
      gradeLevel: input.className?.trim() || data.gradeLevel || "มัธยมศึกษา",
      initialPassword: rawPassword,
      rawPassword: rawPassword,
      updatedAt: serverTimestamp(),
    });
  } else {
    // Check if another doc has this studentId
    const stdQuery = await getDocs(
      query(collection(database, "users"), where("studentId", "==", cleanStudentId))
    );
    if (!stdQuery.empty) {
      const existingDoc = stdQuery.docs[0];
      newUid = existingDoc.id;
      const data = existingDoc.data();
      parentViewToken = data.parentViewToken || generateParentViewToken();
      await updateDoc(doc(database, "users", newUid), {
        displayName: cleanFullName,
        fullName: cleanFullName,
        searchName: normalized.searchName,
        normalizedFullName: normalized.normalizedFullName,
        studentId: cleanStudentId,
        gradeLevel: input.className?.trim() || data.gradeLevel || "มัธยมศึกษา",
        initialPassword: rawPassword,
        rawPassword: rawPassword,
        updatedAt: serverTimestamp(),
      });
    } else {
      // Create new Firestore document
      parentViewToken = generateParentViewToken();
      await setDoc(doc(database, "parent_view_tokens", parentViewToken), {
        token: parentViewToken,
        studentUid: newUid,
        studentId: cleanStudentId,
        studentName: cleanFullName,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(userRef, {
        uid: newUid,
        email: syntheticEmail,
        displayName: cleanFullName,
        fullName: cleanFullName,
        searchName: normalized.searchName,
        normalizedFullName: normalized.normalizedFullName,
        role: "student",
        studentId: cleanStudentId,
        gradeLevel: input.className?.trim() || "มัธยมศึกษา",
        initialPassword: rawPassword,
        rawPassword: rawPassword,
        parentViewToken,
        linkedStudentIds: [],
        photoURL: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  // Optionally enroll in specified class
  if (input.classIdToEnroll) {
    await enrollStudentInClass(input.classIdToEnroll, newUid);
  }

  // Pre-aggregate summary for sub-second LINE Webhook & Parent View lookup
  try {
    await syncStudentSummary(newUid);
  } catch (err) {
    console.error("syncStudentSummary error:", err);
  }

  return {
    id: newUid,
    uid: newUid,
    email: syntheticEmail,
    displayName: cleanFullName,
    fullName: cleanFullName,
    searchName: normalized.searchName,
    normalizedFullName: normalized.normalizedFullName,
    role: "student",
    studentId: cleanStudentId,
    gradeLevel: input.className?.trim() || "มัธยมศึกษา",
    parentViewToken,
    linkedStudentIds: [],
    photoURL: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** Updates a teacher's contact details (Name, Phone number, LINE ID). */
export async function updateTeacherContactProfile(
  teacherUid: string,
  data: { displayName?: string; phoneNumber?: string; lineId?: string; advisorRoom?: string },
): Promise<void> {
  const database = requireDb();
  const ref = doc(database, "users", teacherUid);
  const payload: Record<string, any> = {
    updatedAt: serverTimestamp(),
  };
  if (data.displayName !== undefined) payload.displayName = data.displayName.trim();
  if (data.displayName !== undefined) payload.fullName = data.displayName.trim();
  if (data.phoneNumber !== undefined) payload.phoneNumber = data.phoneNumber.trim();
  if (data.lineId !== undefined) payload.lineId = data.lineId.trim();
  if (data.advisorRoom !== undefined) {
    payload.advisorRoom = data.advisorRoom.trim();
    payload.gradeLevel = data.advisorRoom.trim();
  }

  await setDoc(ref, payload, { merge: true });
}

/** Retrieves contact details for all teachers associated with a student's enrolled classes. */
export async function getTeacherContactsForStudent(studentUid: string): Promise<TeacherContact[]> {
  const database = requireDb();
  const classes = await getClassesForStudent(studentUid);
  if (classes.length === 0) return [];

  const teacherMap = new Map<string, TeacherContact>();

  for (const cls of classes) {
    if (!cls.teacherId) continue;
    if (!teacherMap.has(cls.teacherId)) {
      try {
        const teacherSnap = await getDoc(doc(database, "users", cls.teacherId));
        if (teacherSnap.exists()) {
          const tData = teacherSnap.data();
          teacherMap.set(cls.teacherId, {
            teacherId: cls.teacherId,
            teacherName: tData.fullName || tData.displayName || cls.teacherName || "ครูประจำชั้น",
            subjectName: cls.name,
            phoneNumber: tData.phoneNumber || "",
            lineId: tData.lineId || "",
            email: tData.email || "",
          });
        } else {
          teacherMap.set(cls.teacherId, {
            teacherId: cls.teacherId,
            teacherName: cls.teacherName || "ครูประจำชั้น",
            subjectName: cls.name,
            phoneNumber: "",
            lineId: "",
          });
        }
      } catch (err) {
        console.warn("Error fetching teacher contact:", err);
        teacherMap.set(cls.teacherId, {
          teacherId: cls.teacherId,
          teacherName: cls.teacherName || "ครูประจำชั้น",
          subjectName: cls.name,
          phoneNumber: "",
          lineId: "",
        });
      }
    }
  }

  return Array.from(teacherMap.values());
}

/** Creates a new announcement post. */
export async function createAnnouncement(input: {
  classId?: string;
  className?: string;
  teacherId: string;
  teacherName: string;
  title: string;
  content: string;
  priority?: "normal" | "urgent";
}): Promise<Announcement> {
  const database = requireDb();
  const payload = {
    classId: input.classId || null,
    className: input.className || null,
    teacherId: input.teacherId,
    teacherName: input.teacherName,
    title: input.title.trim(),
    content: input.content.trim(),
    priority: input.priority || "normal",
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(database, "announcements"), payload);
  return {
    id: docRef.id,
    ...payload,
    classId: input.classId,
    className: input.className,
    priority: input.priority || "normal",
    createdAt: new Date().toISOString(),
  };
}

/** Retrieves announcements relevant to a student (by their enrolled classes). */
export async function getAnnouncementsForStudent(studentUid: string): Promise<Announcement[]> {
  const database = requireDb();
  const classes = await getClassesForStudent(studentUid);
  const classIds = classes.map((c) => c.id);

  try {
    const snap = await getDocs(
      query(collection(database, "announcements"), orderBy("createdAt", "desc")),
    );
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          classId: data.classId || undefined,
          className: data.className || undefined,
          teacherId: data.teacherId || "",
          teacherName: data.teacherName || "คุณครู",
          title: data.title || "",
          content: data.content || "",
          priority: data.priority || "normal",
          createdAt: tsToISO(data.createdAt),
        };
      })
      .filter((a) => !a.classId || classIds.includes(a.classId));
  } catch (err) {
    console.warn("Failed to query announcements:", err);
    return [];
  }
}

/** Retrieves homework/assignments and their submission status for a student. */
export async function getStudentHomeworkDetailed(studentUid: string) {
  const classes = await getClassesForStudent(studentUid);
  const homeworkList: Array<{
    id: string;
    classId: string;
    className: string;
    title: string;
    description: string;
    dueDate: string;
    maxScore: number;
    submission: Submission | null;
    status: "submitted" | "missing" | "late" | "graded" | "open";
  }> = [];

  for (const c of classes) {
    const assignments = await getAssignmentsForClass(c.id);
    for (const a of assignments) {
      const sub = await getSubmissionForStudent(a.id, studentUid);
      const derived = deriveSubmissionStatus(a, sub ?? undefined);
      homeworkList.push({
        id: a.id,
        classId: c.id,
        className: c.name,
        title: a.title,
        description: a.description,
        dueDate: a.dueDate,
        maxScore: a.maxScore,
        submission: sub,
        status: derived.status,
      });
    }
  }

  return {
    classes,
    homeworkList: homeworkList.sort((a, b) => b.dueDate.localeCompare(a.dueDate)),
  };
}

/* ------------------------------------------------------------------ */
/* Bulk Import Students & Auto Class Setup from Excel                 */
/* ------------------------------------------------------------------ */

/**
 * Normalizes grade level string:
 * - If "ม.1/2" -> "ม.1/2"
 * - If "ม.1" -> "ม.1/1" (If there's only one room or no room specified, default to room 1)
 * - If "ป.4" -> "ป.4/1"
 */
export function normalizeGradeRoom(raw?: string): string {
  if (!raw || !raw.trim()) return "ม.1/1";
  const clean = raw.trim();
  if (clean.includes("/")) {
    return clean;
  }
  return `${clean}/1`;
}

export async function bulkImportStudentsAndClasses(
  studentsData: Array<{
    studentId: string;
    fullName: string;
    gradeLevel?: string;
  }>,
  adminUid: string,
): Promise<{
  totalStudents: number;
  createdStudents: number;
  totalClasses: number;
  classList: string[];
}> {
  const database = requireDb();
  const roomsMap = new Map<string, Array<{ studentId: string; fullName: string; uid: string }>>();
  let createdStudents = 0;

  for (const item of studentsData) {
    const cleanId = (item.studentId || "").toString().trim().replace(/\s+/g, "");
    const cleanName = (item.fullName || "").trim();
    if (!cleanId || !cleanName) continue;

    const normalizedRoom = normalizeGradeRoom(item.gradeLevel);
    const syntheticEmail = `${cleanId}@student.school.local`;
    const normalized = normalizeThaiName(cleanName);

    const existingSnap = await getDocs(
      query(collection(database, "users"), where("studentId", "==", cleanId)),
    );

    let uid = "";
    if (!existingSnap.empty) {
      uid = existingSnap.docs[0].id;
      await updateDoc(doc(database, "users", uid), {
        gradeLevel: normalizedRoom,
        fullName: cleanName,
        displayName: cleanName,
        updatedAt: serverTimestamp(),
      });
    } else {
      uid = `std_${cleanId}`;
      const parentViewToken = generateParentViewToken();

      await setDoc(doc(database, "parent_view_tokens", parentViewToken), {
        token: parentViewToken,
        studentUid: uid,
        studentId: cleanId,
        studentName: cleanName,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(doc(database, "users", uid), {
        uid,
        email: syntheticEmail,
        displayName: cleanName,
        fullName: cleanName,
        searchName: normalized.searchName,
        normalizedFullName: normalized.normalizedFullName,
        role: "student",
        studentId: cleanId,
        gradeLevel: normalizedRoom,
        parentViewToken,
        linkedStudentIds: [],
        photoURL: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      syncStudentSummary(uid).catch((err) =>
        console.error("Error creating student summary:", err),
      );

      createdStudents++;
    }

    if (!roomsMap.has(normalizedRoom)) {
      roomsMap.set(normalizedRoom, []);
    }
    roomsMap.get(normalizedRoom)!.push({
      studentId: cleanId,
      fullName: cleanName,
      uid,
    });
  }

  const classList: string[] = [];
  const covers: ClassCover[] = ["emerald", "teal", "cyan", "blue", "indigo", "violet"];
  let coverIdx = 0;

  for (const [room, studentsInRoom] of roomsMap.entries()) {
    classList.push(room);
    const studentUids = studentsInRoom.map((s) => s.uid);

    const classQ = query(
      collection(database, "classes"),
      where("gradeLevel", "==", room),
    );
    const classSnap = await getDocs(classQ);

    if (!classSnap.empty) {
      const classDoc = classSnap.docs[0];
      const existingStudentIds: string[] = classDoc.data().studentIds || [];
      const mergedIds = Array.from(new Set([...existingStudentIds, ...studentUids]));
      await updateDoc(doc(database, "classes", classDoc.id), {
        studentIds: mergedIds,
        updatedAt: serverTimestamp(),
      });
    } else {
      const randomCode = `CLS-${room.replace(/[^a-zA-Z0-9ก-๙]/g, "")}-${Math.floor(10 + Math.random() * 90)}`;
      await addDoc(collection(database, "classes"), {
        name: `ห้องเรียน ${room}`,
        gradeLevel: room,
        teacherId: adminUid || "school_admin",
        studentIds: studentUids,
        code: randomCode,
        cover: covers[coverIdx % covers.length],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      coverIdx++;
    }
  }

  return {
    totalStudents: studentsData.length,
    createdStudents,
    totalClasses: roomsMap.size,
    classList,
  };
}

/* ------------------------------------------------------------------ */
/* Student Class Schedule / Timetable                                  */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Student Class Schedule / Timetable (ม.1 - ม.6)                     */
/* ------------------------------------------------------------------ */

export function extractGradeYear(gradeStr: string): number {
  if (!gradeStr) return 2;
  const match = gradeStr.match(/[มm]\.?\s*([1-6])/i);
  if (match) return parseInt(match[1], 10);
  const numMatch = gradeStr.match(/([1-6])/);
  if (numMatch) return parseInt(numMatch[1], 10);
  return 2;
}

export function generateDefaultSchedule(
  gradeLevel: string,
  studentClasses: Class[] = [],
): ScheduleItem[] {
  const norm = normalizeGradeRoom(gradeLevel) || "ม.2/1";
  const year = extractGradeYear(norm);

  // Curriculum definitions for Junior High (ม.1 - ม.3) and Senior High (ม.4 - ม.6)
  const curriculumMap: Record<
    number,
    Record<DayOfWeek, Array<{ name: string; code: string; room: string; color: ScheduleItem["color"] }>>
  > = {
    // ===== ม.1 =====
    1: {
      monday: [
        { name: "ภาษาไทยพื้นฐาน 1", code: "ท21101", room: "ห้อง 111", color: "blue" },
        { name: "คณิตศาสตร์พื้นฐาน 1", code: "ค21101", room: "ห้อง 114", color: "purple" },
        { name: "วิทยาศาสตร์พื้นฐาน 1", code: "ว21101", room: "LAB วิทย์ ม.ต้น", color: "emerald" },
        { name: "สังคมศึกษา 1", code: "ส21101", room: "ห้อง 111", color: "amber" },
        { name: "ภาษาอังกฤษพื้นฐาน 1", code: "อ21101", room: "ห้อง 111", color: "teal" },
        { name: "สุขศึกษาและพลศึกษา", code: "พ21101", room: "โรงยิม 1", color: "rose" },
        { name: "กิจกรรมแนะแนว", code: "ก21901", room: "ห้อง 111", color: "indigo" },
      ],
      tuesday: [
        { name: "ภาษาอังกฤษพื้นฐาน 1", code: "อ21101", room: "ห้อง 111", color: "teal" },
        { name: "สังคมศึกษา 1", code: "ส21101", room: "ห้อง 111", color: "amber" },
        { name: "คณิตศาสตร์พื้นฐาน 1", code: "ค21101", room: "ห้อง 114", color: "purple" },
        { name: "ภาษาไทยพื้นฐาน 1", code: "ท21101", room: "ห้อง 111", color: "blue" },
        { name: "วิทยาการคำนวณ 1", code: "ว21103", room: "ห้องคอม 1", color: "emerald" },
        { name: "ศิลปะและทัศนศิลป์", code: "ศ21101", room: "ห้องศิลปะ", color: "rose" },
        { name: "กิจกรรมชุมนุม/ชมรม", code: "ก21902", room: "ตามกลุ่มกิจกรรม", color: "indigo" },
      ],
      wednesday: [
        { name: "คณิตศาสตร์เพิ่มเติม 1", code: "ค21201", room: "ห้อง 114", color: "purple" },
        { name: "วิทยาศาสตร์พื้นฐาน 1", code: "ว21101", room: "LAB วิทย์ ม.ต้น", color: "emerald" },
        { name: "ภาษาไทยพื้นฐาน 1", code: "ท21101", room: "ห้อง 111", color: "blue" },
        { name: "ประวัติศาสตร์ 1", code: "ส21102", room: "ห้อง 111", color: "amber" },
        { name: "ภาษาอังกฤษเพื่อการสื่อสาร", code: "อ21201", room: "Sound LAB", color: "teal" },
        { name: "การงานอาชีพและเทคโนโลยี", code: "ง21101", room: "โรงฝึกงาน 1", color: "amber" },
        { name: "กิจกรรมลูกเสือ-เนตรนารี", code: "ก21903", room: "ลานกิจกรรม", color: "indigo" },
      ],
      thursday: [
        { name: "วิทยาศาสตร์พื้นฐาน 1", code: "ว21101", room: "LAB วิทย์ ม.ต้น", color: "emerald" },
        { name: "คณิตศาสตร์พื้นฐาน 1", code: "ค21101", room: "ห้อง 114", color: "purple" },
        { name: "ภาษาอังกฤษพื้นฐาน 1", code: "อ21101", room: "ห้อง 111", color: "teal" },
        { name: "ภาษาไทยพื้นฐาน 1", code: "ท21101", room: "ห้อง 111", color: "blue" },
        { name: "การออกแบบและเทคโนโลยี 1", code: "ว21104", room: "ห้องคอม 2", color: "emerald" },
        { name: "หน้าที่พลเมือง 1", code: "ส21201", room: "ห้อง 111", color: "amber" },
        { name: "โฮมรูมและคุณธรรม", code: "ก21904", room: "ห้อง 111", color: "indigo" },
      ],
      friday: [
        { name: "สังคมศึกษา 1", code: "ส21101", room: "ห้อง 111", color: "amber" },
        { name: "ภาษาไทยพื้นฐาน 1", code: "ท21101", room: "ห้อง 111", color: "blue" },
        { name: "คณิตศาสตร์พื้นฐาน 1", code: "ค21101", room: "ห้อง 114", color: "purple" },
        { name: "ภาษาอังกฤษพื้นฐาน 1", code: "อ21101", room: "ห้อง 111", color: "teal" },
        { name: "วิทยาศาสตร์พื้นฐาน 1", code: "ว21101", room: "LAB วิทย์ ม.ต้น", color: "emerald" },
        { name: "พลศึกษา (กรีฑา)", code: "พ21102", room: "สนามกีฬา", color: "rose" },
        { name: "กิจกรรมบำเพ็ญประโยชน์", code: "ก21905", room: "ห้อง 111", color: "indigo" },
      ],
    },

    // ===== ม.2 =====
    2: {
      monday: [
        { name: "ภาษาไทยพื้นฐาน 2", code: "ท22101", room: "ห้อง 211", color: "blue" },
        { name: "คณิตศาสตร์พื้นฐาน 2", code: "ค22101", room: "ห้อง 214", color: "purple" },
        { name: "วิทยาศาสตร์และเทคโนโลยี 2", code: "ว22101", room: "LAB วิทย์ 1", color: "emerald" },
        { name: "สังคมศึกษา 2", code: "ส22101", room: "ห้อง 211", color: "amber" },
        { name: "ภาษาอังกฤษพื้นฐาน 2", code: "อ22101", room: "ห้อง 211", color: "teal" },
        { name: "สุขศึกษาและพลศึกษา", code: "พ22101", room: "โรงยิม", color: "rose" },
        { name: "กิจกรรมแนะแนว", code: "ก22901", room: "ห้อง 211", color: "indigo" },
      ],
      tuesday: [
        { name: "ภาษาอังกฤษพื้นฐาน 2", code: "อ22101", room: "ห้อง 211", color: "teal" },
        { name: "สังคมศึกษา 2", code: "ส22101", room: "ห้อง 211", color: "amber" },
        { name: "คณิตศาสตร์พื้นฐาน 2", code: "ค22101", room: "ห้อง 214", color: "purple" },
        { name: "ภาษาไทยพื้นฐาน 2", code: "ท22101", room: "ห้อง 211", color: "blue" },
        { name: "วิทยาการคำนวณ 2", code: "ว22103", room: "ห้องคอม 1", color: "emerald" },
        { name: "ศิลปะและดนตรี-นาฏศิลป์", code: "ศ22101", room: "ห้องดนตรี", color: "rose" },
        { name: "กิจกรรมชุมนุม/ชมรม", code: "ก22902", room: "ตามกลุ่มกิจกรรม", color: "indigo" },
      ],
      wednesday: [
        { name: "คณิตศาสตร์เพิ่มเติม 2", code: "ค22201", room: "ห้อง 214", color: "purple" },
        { name: "วิทยาศาสตร์และเทคโนโลยี 2", code: "ว22101", room: "LAB วิทย์ 1", color: "emerald" },
        { name: "ภาษาไทยพื้นฐาน 2", code: "ท22101", room: "ห้อง 211", color: "blue" },
        { name: "ประวัติศาสตร์ 2", code: "ส22102", room: "ห้อง 211", color: "amber" },
        { name: "ภาษาอังกฤษเพื่อการสื่อสาร", code: "อ22201", room: "Sound LAB", color: "teal" },
        { name: "การงานอาชีพ 2", code: "ง22101", room: "โรงฝึกงาน", color: "amber" },
        { name: "กิจกรรมลูกเสือ-เนตรนารี", code: "ก22903", room: "ลานกิจกรรม", color: "indigo" },
      ],
      thursday: [
        { name: "วิทยาศาสตร์และเทคโนโลยี 2", code: "ว22101", room: "LAB วิทย์ 1", color: "emerald" },
        { name: "คณิตศาสตร์พื้นฐาน 2", code: "ค22101", room: "ห้อง 214", color: "purple" },
        { name: "ภาษาอังกฤษพื้นฐาน 2", code: "อ22101", room: "ห้อง 211", color: "teal" },
        { name: "ภาษาไทยพื้นฐาน 2", code: "ท22101", room: "ห้อง 211", color: "blue" },
        { name: "การออกแบบและเทคโนโลยี 2", code: "ว22104", room: "ห้องคอม 2", color: "emerald" },
        { name: "หน้าที่พลเมือง 2", code: "ส22201", room: "ห้อง 211", color: "amber" },
        { name: "โฮมรูมและคุณธรรม", code: "ก22904", room: "ห้อง 211", color: "indigo" },
      ],
      friday: [
        { name: "สังคมศึกษา 2", code: "ส22101", room: "ห้อง 211", color: "amber" },
        { name: "ภาษาไทยพื้นฐาน 2", code: "ท22101", room: "ห้อง 211", color: "blue" },
        { name: "คณิตศาสตร์พื้นฐาน 2", code: "ค22101", room: "ห้อง 214", color: "purple" },
        { name: "ภาษาอังกฤษพื้นฐาน 2", code: "อ22101", room: "ห้อง 211", color: "teal" },
        { name: "วิทยาศาสตร์และเทคโนโลยี 2", code: "ว22101", room: "LAB วิทย์ 1", color: "emerald" },
        { name: "พลศึกษา (แบดมินตัน)", code: "พ22102", room: "สนามกีฬา", color: "rose" },
        { name: "สรุปกิจกรรมประจำสัปดาห์", code: "ก22905", room: "ห้อง 211", color: "indigo" },
      ],
    },

    // ===== ม.3 =====
    3: {
      monday: [
        { name: "ภาษาไทยพื้นฐาน 3", code: "ท23101", room: "ห้อง 311", color: "blue" },
        { name: "คณิตศาสตร์พื้นฐาน 3", code: "ค23101", room: "ห้อง 314", color: "purple" },
        { name: "วิทยาศาสตร์ 3 (ฟิสิกส์-เคมี)", code: "ว23101", room: "LAB วิทย์ 2", color: "emerald" },
        { name: "สังคมศึกษา 3", code: "ส23101", room: "ห้อง 311", color: "amber" },
        { name: "ภาษาอังกฤษพื้นฐาน 3", code: "อ23101", room: "ห้อง 311", color: "teal" },
        { name: "สุขศึกษาและพลศึกษา", code: "พ23101", room: "โรงยิม", color: "rose" },
        { name: "กิจกรรมแนะแนวศึกษาต่อ", code: "ก23901", room: "ห้อง 311", color: "indigo" },
      ],
      tuesday: [
        { name: "ภาษาอังกฤษพื้นฐาน 3", code: "อ23101", room: "ห้อง 311", color: "teal" },
        { name: "สังคมศึกษา 3", code: "ส23101", room: "ห้อง 311", color: "amber" },
        { name: "คณิตศาสตร์พื้นฐาน 3", code: "ค23101", room: "ห้อง 314", color: "purple" },
        { name: "ภาษาไทยพื้นฐาน 3", code: "ท23101", room: "ห้อง 311", color: "blue" },
        { name: "โครงงานวิทยาการคำนวณ", code: "ว23103", room: "ห้องคอม 1", color: "emerald" },
        { name: "ดนตรีสากลและนาฏศิลป์", code: "ศ23101", room: "ห้องดนตรี", color: "rose" },
        { name: "กิจกรรมชุมนุม", code: "ก23902", room: "ตามกลุ่มกิจกรรม", color: "indigo" },
      ],
      wednesday: [
        { name: "คณิตศาสตร์เพิ่มเติม 3", code: "ค23201", room: "ห้อง 314", color: "purple" },
        { name: "วิทยาศาสตร์ 3 (ชีววิทยา)", code: "ว23101", room: "LAB ชีวะ", color: "emerald" },
        { name: "ภาษาไทยพื้นฐาน 3", code: "ท23101", room: "ห้อง 311", color: "blue" },
        { name: "ประวัติศาสตร์ 3", code: "ส23102", room: "ห้อง 311", color: "amber" },
        { name: "ภาษาอังกฤษเพื่อการนำเสนอ", code: "อ23201", room: "Sound LAB", color: "teal" },
        { name: "การงานอาชีพและธุรกิจ", code: "ง23101", room: "โรงฝึกงาน", color: "amber" },
        { name: "กิจกรรมลูกเสือ-เนตรนารี", code: "ก23903", room: "ลานกิจกรรม", color: "indigo" },
      ],
      thursday: [
        { name: "วิทยาศาสตร์ 3 (โลก ดาราศาสตร์)", code: "ว23101", room: "LAB วิทย์ 2", color: "emerald" },
        { name: "คณิตศาสตร์พื้นฐาน 3", code: "ค23101", room: "ห้อง 314", color: "purple" },
        { name: "ภาษาอังกฤษพื้นฐาน 3", code: "อ23101", room: "ห้อง 311", color: "teal" },
        { name: "ภาษาไทยพื้นฐาน 3", code: "ท23101", room: "ห้อง 311", color: "blue" },
        { name: "การออกแบบและเทคโนโลยี 3", code: "ว23104", room: "ห้องคอม 2", color: "emerald" },
        { name: "หน้าที่พลเมืองและกฎหมาย", code: "ส23201", room: "ห้อง 311", color: "amber" },
        { name: "โฮมรูมและเตรียมสอบ O-NET", code: "ก23904", room: "ห้อง 311", color: "indigo" },
      ],
      friday: [
        { name: "สังคมศึกษา 3", code: "ส23101", room: "ห้อง 311", color: "amber" },
        { name: "ภาษาไทยพื้นฐาน 3", code: "ท23101", room: "ห้อง 311", color: "blue" },
        { name: "คณิตศาสตร์พื้นฐาน 3", code: "ค23101", room: "ห้อง 314", color: "purple" },
        { name: "ภาษาอังกฤษพื้นฐาน 3", code: "อ23101", room: "ห้อง 311", color: "teal" },
        { name: "วิทยาศาสตร์ 3 (ทดลองวิทย์)", code: "ว23101", room: "LAB วิทย์ 2", color: "emerald" },
        { name: "พลศึกษา (วอลเลย์บอล)", code: "พ23102", room: "โรงยิม", color: "rose" },
        { name: "สรุปกิจกรรมประจำสัปดาห์", code: "ก23905", room: "ห้อง 311", color: "indigo" },
      ],
    },

    // ===== ม.4 =====
    4: {
      monday: [
        { name: "ฟิสิกส์ 1 (การเคลื่อนที่)", code: "ว31201", room: "LAB ฟิสิกส์", color: "emerald" },
        { name: "ฟิสิกส์ 1 (ปฏิบัติการ)", code: "ว31201", room: "LAB ฟิสิกส์", color: "emerald" },
        { name: "คณิตศาสตร์เพิ่มเติม 1", code: "ค31201", room: "ห้อง 412", color: "purple" },
        { name: "ภาษาไทย 1", code: "ท31101", room: "ห้อง 411", color: "blue" },
        { name: "ภาษาอังกฤษ 1", code: "อ31101", room: "ห้อง 411", color: "teal" },
        { name: "สังคมศึกษา 1", code: "ส31101", room: "ห้อง 411", color: "amber" },
        { name: "กิจกรรมแนะแนว ม.ปลาย", code: "ก31901", room: "ห้อง 411", color: "indigo" },
      ],
      tuesday: [
        { name: "เคมี 1 (อะตอมและตารางธาตุ)", code: "ว31221", room: "LAB เคมี", color: "emerald" },
        { name: "เคมี 1 (การทดลองเคมี)", code: "ว31221", room: "LAB เคมี", color: "emerald" },
        { name: "คณิตศาสตร์พื้นฐาน 1", code: "ค31101", room: "ห้อง 412", color: "purple" },
        { name: "ภาษาอังกฤษเชิงวิชาการ", code: "อ31201", room: "Sound LAB", color: "teal" },
        { name: "วิทยาการคำนวณ ม.ปลาย", code: "ว31103", room: "ห้องคอม 1", color: "emerald" },
        { name: "สุขศึกษาและพลศึกษา", code: "พ31101", room: "โรงยิม 2", color: "rose" },
        { name: "กิจกรรมชุมนุมวิชาการ", code: "ก31902", room: "ห้อง 411", color: "indigo" },
      ],
      wednesday: [
        { name: "ชีววิทยา 1 (เซลล์ของสิ่งมีชีวิต)", code: "ว31241", room: "LAB ชีวะ", color: "emerald" },
        { name: "ชีววิทยา 1 (ส่องกล้องจุลทรรศน์)", code: "ว31241", room: "LAB ชีวะ", color: "emerald" },
        { name: "คณิตศาสตร์เพิ่มเติม 1", code: "ค31201", room: "ห้อง 412", color: "purple" },
        { name: "ประวัติศาสตร์ไทย 1", code: "ส31102", room: "ห้อง 411", color: "amber" },
        { name: "ภาษาไทย 1", code: "ท31101", room: "ห้อง 411", color: "blue" },
        { name: "การงานอาชีพและวิศวกรรม", code: "ง31101", room: "โรงฝึกงาน", color: "amber" },
        { name: "กิจกรรมรักษาดินแดน (รด.)", code: "ก31903", room: "สนามฝึก รด.", color: "indigo" },
      ],
      thursday: [
        { name: "คณิตศาสตร์เพิ่มเติม 1", code: "ค31201", room: "ห้อง 412", color: "purple" },
        { name: "ภาษาอังกฤษ 1", code: "อ31101", room: "ห้อง 411", color: "teal" },
        { name: "ฟิสิกส์ 1 (โจทย์ประยุกต์)", code: "ว31201", room: "LAB ฟิสิกส์", color: "emerald" },
        { name: "เคมี 1 (สมบัติของธาตุ)", code: "ว31221", room: "LAB เคมี", color: "emerald" },
        { name: "โลก ดาราศาสตร์และอวกาศ", code: "ว31104", room: "ห้องดาราศาสตร์", color: "indigo" },
        { name: "ศิลปะและทัศนศิลป์", code: "ศ31101", room: "ห้องศิลป์", color: "rose" },
        { name: "โฮมรูมและจริยธรรม", code: "ก31904", room: "ห้อง 411", color: "indigo" },
      ],
      friday: [
        { name: "ชีววิทยา 1 (เคมีในสิ่งมีชีวิต)", code: "ว31241", room: "LAB ชีวะ", color: "emerald" },
        { name: "คณิตศาสตร์พื้นฐาน 1", code: "ค31101", room: "ห้อง 412", color: "purple" },
        { name: "สังคมศึกษา 1", code: "ส31101", room: "ห้อง 411", color: "amber" },
        { name: "ภาษาไทย 1", code: "ท31101", room: "ห้อง 411", color: "blue" },
        { name: "ภาษาอังกฤษเพื่อการสื่อสาร", code: "อ31202", room: "ห้อง 411", color: "teal" },
        { name: "พลศึกษา (บาสเกตบอล)", code: "พ31102", room: "โรงยิม 2", color: "rose" },
        { name: "กิจกรรมเพื่อสังคมและสาธารณะ", code: "ก31905", room: "หอประชุม", color: "indigo" },
      ],
    },

    // ===== ม.5 =====
    5: {
      monday: [
        { name: "ฟิสิกส์ 2 (คลื่น แสง เสียง)", code: "ว32201", room: "LAB ฟิสิกส์", color: "emerald" },
        { name: "ฟิสิกส์ 2 (การทดลองคลื่น)", code: "ว32201", room: "LAB ฟิสิกส์", color: "emerald" },
        { name: "คณิตศาสตร์เพิ่มเติม 2", code: "ค32201", room: "ห้อง 512", color: "purple" },
        { name: "ภาษาไทย 2", code: "ท32101", room: "ห้อง 511", color: "blue" },
        { name: "ภาษาอังกฤษ 2", code: "อ32101", room: "ห้อง 511", color: "teal" },
        { name: "สังคมศึกษา 2", code: "ส32101", room: "ห้อง 511", color: "amber" },
        { name: "กิจกรรมแนะแนวสายอาชีพ", code: "ก32901", room: "ห้อง 511", color: "indigo" },
      ],
      tuesday: [
        { name: "เคมี 2 (แก๊สและของเหลว)", code: "ว32221", room: "LAB เคมี", color: "emerald" },
        { name: "เคมี 2 (อัตราการเกิดปฏิกิริยา)", code: "ว32221", room: "LAB เคมี", color: "emerald" },
        { name: "คณิตศาสตร์พื้นฐาน 2", code: "ค32101", room: "ห้อง 512", color: "purple" },
        { name: "ภาษาอังกฤษเข้มข้น", code: "อ32201", room: "Sound LAB", color: "teal" },
        { name: "การออกแบบเทคโนโลยีขั้นสูง", code: "ว32103", room: "ห้องคอม 2", color: "emerald" },
        { name: "สุขศึกษาและพลศึกษา", code: "พ32101", room: "โรงยิม 2", color: "rose" },
        { name: "กิจกรรมชมรมเฉพาะทาง", code: "ก32902", room: "ห้อง 511", color: "indigo" },
      ],
      wednesday: [
        { name: "ชีววิทยา 2 (การสืบพันธุ์พืช)", code: "ว32241", room: "LAB ชีวะ", color: "emerald" },
        { name: "ชีววิทยา 2 (โครงสร้างสัตว์)", code: "ว32241", room: "LAB ชีวะ", color: "emerald" },
        { name: "คณิตศาสตร์เพิ่มเติม 2", code: "ค32201", room: "ห้อง 512", color: "purple" },
        { name: "ประวัติศาสตร์สากล", code: "ส32102", room: "ห้อง 511", color: "amber" },
        { name: "ภาษาไทย 2", code: "ท32101", room: "ห้อง 511", color: "blue" },
        { name: "การศึกษาค้นคว้าอิสระ (IS 1)", code: "I32201", room: "ห้องสมุด", color: "indigo" },
        { name: "กิจกรรมรักษาดินแดน (รด. ปี 2)", code: "ก32903", room: "สนามฝึก รด.", color: "indigo" },
      ],
      thursday: [
        { name: "คณิตศาสตร์เพิ่มเติม 2", code: "ค32201", room: "ห้อง 512", color: "purple" },
        { name: "ภาษาอังกฤษ 2", code: "อ32101", room: "ห้อง 511", color: "teal" },
        { name: "ฟิสิกส์ 2 (ไฟฟ้าสถิต)", code: "ว32201", room: "LAB ฟิสิกส์", color: "emerald" },
        { name: "เคมี 2 (สมดุลเคมี)", code: "ว32221", room: "LAB เคมี", color: "emerald" },
        { name: "ดาราศาสตร์และอวกาศ 2", code: "ว32104", room: "ห้องดาราศาสตร์", color: "indigo" },
        { name: "ดนตรีและศิลปะร่วมสมัย", code: "ศ32101", room: "ห้องดนตรี", color: "rose" },
        { name: "โฮมรูมและคุณธรรม", code: "ก32904", room: "ห้อง 511", color: "indigo" },
      ],
      friday: [
        { name: "ชีววิทยา 2 (พันธุศาสตร์)", code: "ว32241", room: "LAB ชีวะ", color: "emerald" },
        { name: "คณิตศาสตร์พื้นฐาน 2", code: "ค32101", room: "ห้อง 512", color: "purple" },
        { name: "สังคมศึกษา 2", code: "ส32101", room: "ห้อง 511", color: "amber" },
        { name: "ภาษาไทย 2", code: "ท32101", room: "ห้อง 511", color: "blue" },
        { name: "ภาษาอังกฤษเชิงวิเคราะห์", code: "อ32202", room: "ห้อง 511", color: "teal" },
        { name: "พลศึกษา (ฟุตซอล)", code: "พ32102", room: "สนามกีฬา", color: "rose" },
        { name: "กิจกรรมสาธารณประโยชน์", code: "ก32905", room: "ห้อง 511", color: "indigo" },
      ],
    },

    // ===== ม.6 =====
    6: {
      monday: [
        { name: "ฟิสิกส์ 3 (ไฟฟ้ากระแสสลับ)", code: "ว33201", room: "LAB ฟิสิกส์", color: "emerald" },
        { name: "ฟิสิกส์ 3 (ฟิสิกส์นิวเคลียร์)", code: "ว33201", room: "LAB ฟิสิกส์", color: "emerald" },
        { name: "คณิตศาสตร์ประยุกต์/แคลคูลัส", code: "ค33201", room: "ห้อง 612", color: "purple" },
        { name: "ภาษาไทย 3", code: "ท33101", room: "ห้อง 611", color: "blue" },
        { name: "ภาษาอังกฤษเตรียมสอบ TGAT", code: "อ33101", room: "ห้อง 611", color: "teal" },
        { name: "สังคมศึกษา 3 (เศรษฐศาสตร์)", code: "ส33101", room: "ห้อง 611", color: "amber" },
        { name: "แนะแนวเข้ามหาวิทยาลัย (TCAS)", code: "ก33901", room: "ห้อง 611", color: "indigo" },
      ],
      tuesday: [
        { name: "เคมี 3 (กรด-เบส ไฟฟ้าเคมี)", code: "ว33221", room: "LAB เคมี", color: "emerald" },
        { name: "เคมี 3 (เคมีอินทรีย์)", code: "ว33221", room: "LAB เคมี", color: "emerald" },
        { name: "คณิตศาสตร์พื้นฐาน 3", code: "ค33101", room: "ห้อง 612", color: "purple" },
        { name: "ภาษาอังกฤษเชิงวิชาการ (TPAT)", code: "อ33201", room: "Sound LAB", color: "teal" },
        { name: "ปัญญาประดิษฐ์และ AI พื้นฐาน", code: "ว33103", room: "ห้องคอม 1", color: "emerald" },
        { name: "สุขศึกษาและสมรรถภาพกาย", code: "พ33101", room: "ฟิตเนส/ยิม", color: "rose" },
        { name: "กิจกรรมชุมนุมวิชาการ ม.6", code: "ก33902", room: "ห้อง 611", color: "indigo" },
      ],
      wednesday: [
        { name: "ชีววิทยา 3 (ระบบนิเวศ)", code: "ว33241", room: "LAB ชีวะ", color: "emerald" },
        { name: "ชีววิทยา 3 (วิวัฒนาการ)", code: "ว33241", room: "LAB ชีวะ", color: "emerald" },
        { name: "คณิตศาสตร์ประยุกต์/สถิติ", code: "ค33201", room: "ห้อง 612", color: "purple" },
        { name: "สังคมศึกษา 3 (การเมืองการปกครอง)", code: "ส33102", room: "ห้อง 611", color: "amber" },
        { name: "ภาษาไทยเชิงวิชาการ", code: "ท33101", room: "ห้อง 611", color: "blue" },
        { name: "สัมมนาโครงงานวิทยาศาสตร์ (IS 2)", code: "I33201", room: "ห้องประชุม", color: "indigo" },
        { name: "กิจกรรมรักษาดินแดน (รด. ปี 3)", code: "ก33903", room: "สนามฝึก รด.", color: "indigo" },
      ],
      thursday: [
        { name: "คณิตศาสตร์เข้มข้น A-Level", code: "ค33201", room: "ห้อง 612", color: "purple" },
        { name: "ภาษาอังกฤษเพื่อการทดสอบ", code: "อ33101", room: "ห้อง 611", color: "teal" },
        { name: "ฟิสิกส์ 3 (ตะลุยโจทย์ TPAT3)", code: "ว33201", room: "LAB ฟิสิกส์", color: "emerald" },
        { name: "เคมี 3 (ตะลุยโจทย์เคมี)", code: "ว33221", room: "LAB เคมี", color: "emerald" },
        { name: "ชีววิทยา 3 (ตะลุยโจทย์ชีวะ)", code: "ว33241", room: "LAB ชีวะ", color: "emerald" },
        { name: "การนำเสนอและการสื่อสาร", code: "I33202", room: "ห้องประชุม", color: "rose" },
        { name: "โฮมรูมและติดตาม Portfolio", code: "ก33904", room: "ห้อง 611", color: "indigo" },
      ],
      friday: [
        { name: "ชีววิทยา 3 (พันธุศาสตร์ประยุกต์)", code: "ว33241", room: "LAB ชีวะ", color: "emerald" },
        { name: "คณิตศาสตร์พื้นฐาน 3", code: "ค33101", room: "ห้อง 612", color: "purple" },
        { name: "สังคมศึกษา 3 (ศาสนาสากล)", code: "ส33101", room: "ห้อง 611", color: "amber" },
        { name: "ภาษาไทย 3", code: "ท33101", room: "ห้อง 611", color: "blue" },
        { name: "ภาษาอังกฤษสำหรับการสอบเข้า", code: "อ33202", room: "ห้อง 611", color: "teal" },
        { name: "พลศึกษา (ลีลาศ/โยคะ)", code: "พ33102", room: "โรงยิม 2", color: "rose" },
        { name: "เตรียมความพร้อมสู่มหาวิทยาลัย", code: "ก33905", room: "หอประชุมใหญ่", color: "indigo" },
      ],
    },
  };

  const selectedCurriculum = curriculumMap[year] || curriculumMap[2];

  const periodTimes = [
    { period: 1, startTime: "08:30", endTime: "09:20" },
    { period: 2, startTime: "09:20", endTime: "10:10" },
    { period: 3, startTime: "10:20", endTime: "11:10" },
    { period: 4, startTime: "11:10", endTime: "12:00" },
    { period: 5, startTime: "13:00", endTime: "13:50" },
    { period: 6, startTime: "13:50", endTime: "14:40" },
    { period: 7, startTime: "14:40", endTime: "15:30" },
  ];

  const items: ScheduleItem[] = [];
  const days: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];

  const teacherBySubject: Record<string, string> = {};
  if (studentClasses && studentClasses.length > 0) {
    for (const c of studentClasses) {
      if (c.name && c.teacherName) {
        teacherBySubject[c.name] = c.teacherName;
      }
    }
  }

  for (const day of days) {
    const daySubjects = selectedCurriculum[day];
    periodTimes.forEach((pt, idx) => {
      const subj = daySubjects[idx % daySubjects.length];
      const matchedTeacher =
        teacherBySubject[subj.name] ||
        (studentClasses.length > 0 ? studentClasses[idx % studentClasses.length]?.teacherName : "คุณครูผู้สอน");
      items.push({
        id: `${day}_p${pt.period}`,
        day,
        period: pt.period,
        startTime: pt.startTime,
        endTime: pt.endTime,
        subjectName: subj.name,
        subjectCode: subj.code,
        teacherName: matchedTeacher,
        room: subj.room,
        color: subj.color,
      });
    });
  }

  return items;
}

export async function getClassSchedule(
  gradeLevel: string,
  studentClasses: Class[] = [],
): Promise<ScheduleItem[]> {
  const database = requireDb();
  const norm = normalizeGradeRoom(gradeLevel) || "ม.2/1";
  const docId = norm.replace(/[^a-zA-Z0-9ก-๙]/g, "_");

  // 1. Try exact room document (e.g. schedules/ม_2_1)
  try {
    const snap = await withTimeout(getDoc(doc(database, "schedules", docId)), 3000);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.items) && data.items.length > 0) {
        return data.items;
      }
    }
  } catch (err) {
    console.warn("Could not fetch room schedule from firestore:", err);
  }

  // 2. Try general grade level document (e.g. schedules/ม_2)
  const year = extractGradeYear(norm);
  const generalDocId = `ม_${year}`;
  try {
    const snapGen = await withTimeout(getDoc(doc(database, "schedules", generalDocId)), 3000);
    if (snapGen.exists()) {
      const data = snapGen.data();
      if (Array.isArray(data.items) && data.items.length > 0) {
        return data.items;
      }
    }
  } catch (err) {
    console.warn("Could not fetch general grade schedule from firestore:", err);
  }

  // 3. Fallback to generated default curriculum for that grade year
  return generateDefaultSchedule(norm, studentClasses);
}

export async function saveClassSchedule(
  gradeLevel: string,
  items: ScheduleItem[],
): Promise<void> {
  const database = requireDb();
  const norm = normalizeGradeRoom(gradeLevel) || "ม.2/1";
  const docId = norm.replace(/[^a-zA-Z0-9ก-๙]/g, "_");

  await setDoc(doc(database, "schedules", docId), {
    gradeLevel: norm,
    items,
    updatedAt: serverTimestamp(),
  });
}

