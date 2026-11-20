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
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  Assignment,
  Attendance,
  Class,
  ClassCover,
  ClassSession,
  LeaveRequest,
  StudentRiskEntry,
  Submission,
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

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export async function createUserProfile(
  uid: string,
  email: string,
  displayName: string,
  role: UserRole,
): Promise<User> {
  const database = requireDb();
  const ref = doc(database, "users", uid);
  await setDoc(ref, {
    uid,
    email,
    displayName,
    role,
    linkedStudentIds: [],
    photoURL: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return {
    id: uid,
    uid,
    email,
    displayName,
    role,
    linkedStudentIds: [],
    photoURL: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function getUserProfile(uid: string): Promise<User | null> {
  const database = requireDb();
  const snap = await getDoc(doc(database, "users", uid));
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
  const snaps = await getDocs(
    query(collection(database, "classes"), where("teacherId", "==", teacherId)),
  );
  return snaps.docs.map((d) => mapClassDoc(d.id, d.data()));
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
  const trimmed = queryStr.trim().toLowerCase();
  if (!trimmed) throw new Error("กรุณากรอกอีเมลของนักเรียน");

  // Look up student by email
  const studentSnap = await getDocs(
    query(
      collection(database, "users"),
      where("email", "==", trimmed),
      where("role", "==", "student"),
    ),
  );

  let studentDoc = studentSnap.empty ? null : studentSnap.docs[0];

  if (!studentDoc) {
    // Try lookup by user UID
    const directDoc = await getDoc(doc(database, "users", queryStr.trim()));
    if (directDoc.exists() && directDoc.data().role === "student") {
      studentDoc = directDoc;
    }
  }

  if (!studentDoc) {
    throw new Error("ไม่พบบัญชีนักเรียนที่ใช้อีเมลนี้ กรุณาตรวจสอบอีเมลของบุตรหลาน");
  }

  const sData = studentDoc.data();
  const studentUser: User = {
    id: studentDoc.id,
    uid: sData.uid,
    email: sData.email,
    displayName: sData.displayName,
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
