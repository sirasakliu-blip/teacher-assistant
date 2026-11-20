/**
 * Shared domain types for EduConnect360.
 *
 * These mirror the core Firestore collections the LMS uses:
 * `users`, `classes`, `sessions`, and `attendance`.
 */

/** Role a user account can hold within the platform. */
export type UserRole = "teacher" | "student" | "parent";

/** A platform account, stored in the `users` Firestore collection (doc id = Firebase Auth uid). */
export interface User {
  id: string;
  uid: string; // Firebase Auth UID
  email: string;
  displayName: string;
  photoURL?: string | null;
  role: UserRole;
  linkedStudentIds?: string[]; // Student UIDs linked to parent account
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

/** Preset accent covers for classes -- avoids requiring a real file upload for the MVP. */
export type ClassCover =
  | "emerald"
  | "teal"
  | "lime"
  | "forest"
  | "mint"
  | "moss";

/** A class/course, stored in the `classes` Firestore collection. */
export interface Class {
  id: string;
  name: string; // subject name, e.g. "Algebra II"
  gradeLevel: string; // e.g. "Grade 10"
  cover: ClassCover;
  teacherId: string; // References User.id / uid
  teacherName: string;
  joinCode: string; // 6-digit code students use to join
  studentIds: string[]; // References User.id (students)
  createdAt: string;
  updatedAt: string;
}

/** An attendance-taking session for a class on a given day. */
export interface ClassSession {
  id: string;
  classId: string;
  teacherId: string;
  date: string; // ISO date, e.g. "2026-07-14"
  createdAt: string;
  active: boolean;
}

/** Attendance status for a single student check-in. */
export type AttendanceStatus = "present" | "absent" | "late" | "excused";

/** An attendance record, stored in the `attendance` Firestore collection. */
export interface Attendance {
  id: string;
  classId: string;
  sessionId: string;
  studentId: string; // References User.id
  studentName: string;
  date: string; // ISO date, matches the session's date
  status: AttendanceStatus;
  checkedInAt: string; // ISO timestamp
}

/** An assignment/homework item, stored in the `assignments` Firestore collection. */
export interface Assignment {
  id: string;
  classId: string;
  teacherId: string;
  title: string;
  description: string;
  dueDate: string; // ISO date, e.g. "2026-07-20"
  maxScore: number;
  createdAt: string;
}

/** Status of a single student's submission relative to an assignment's due date. */
export type SubmissionStatus = "submitted" | "late" | "missing" | "pending";

/** A student's submission for an assignment, stored in the `submissions` Firestore collection. */
export interface Submission {
  id: string;
  assignmentId: string;
  classId: string;
  studentId: string;
  studentName: string;
  content?: string | null; // typed answer text
  fileName?: string | null; // mocked "uploaded" file name
  status: "submitted" | "late"; // "missing"/"pending" are derived, never stored
  score: number | null;
  submittedAt: string; // ISO timestamp
  gradedAt: string | null;
}

/** AI-computed risk level for a student, surfaced on the teacher's class dashboard. */
export interface StudentRiskEntry {
  studentId: string;
  studentName: string;
  attendanceRate: number; // 0-100, based on real session/attendance data
  lateOrMissingCount: number; // based on real assignment/submission data
  riskLevel: "high" | "medium";
  message: string;
}

/** A leave request letter record, stored in `leave_requests` collection. */
export interface LeaveRequest {
  id: string;
  studentId: string;
  studentName: string;
  prefix: string; // "เด็กชาย" | "เด็กหญิง" | "นาย" | "นางสาว"
  studentGrade: string; // e.g. "ม.3/1"
  studentNumber: string; // e.g. "12"
  writtenAt: string; // e.g. "โรงเรียน..." or "บ้านเลขที่..."
  date: string; // e.g. "2026-11-20"
  type: "sick" | "business"; // "sick" = ลาป่วย, "business" = ขอลากิจ
  reason: string; // สาเหตุการลา (หากป่วยระบุอาการ)
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  daysCount: number; // จำนวนวัน
  advisorName: string; // ครูที่ปรึกษา
  subjectTeacherName?: string; // ครูผู้สอนวิชา (สำหรับแบบฟอร์มครู)
  parentName: string; // ชื่อผู้ปกครองรับรอง
  status: "pending" | "approved" | "rejected";
  submittedByRole: "student" | "parent";
  classId?: string;
  className?: string;
  createdAt: string;
  reviewedAt?: string | null;
}
