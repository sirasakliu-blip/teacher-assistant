/**
 * Shared domain types for EduConnect360.
 *
 * These mirror the core Firestore collections the LMS uses:
 * `users`, `classes`, `sessions`, and `attendance`.
 */

/** Role a user account can hold within the platform. */
export type UserRole = "teacher" | "student" | "parent" | "admin";

/** A platform account, stored in the `users` Firestore collection (doc id = Firebase Auth uid). */
export interface User {
  id: string;
  uid: string; // Firebase Auth UID
  email: string;
  displayName: string;
  fullName?: string;
  searchName?: string; // Normalized first name without prefixes for smart search
  normalizedFullName?: string; // Full name without prefixes
  phoneNumber?: string; // Teacher or user phone number
  lineId?: string; // Teacher or user LINE ID
  photoURL?: string | null;
  role: UserRole;
  studentId?: string; // e.g. "67105"
  gradeLevel?: string; // e.g. "ม.3/1" (สำหรับนักเรียน: ชั้นเรียน / สำหรับครู: ห้องที่ปรึกษา)
  advisorRoom?: string; // e.g. "ม.2/1" (สำหรับครู: ครูประจำชั้น / ครูที่ปรึกษา)
  schoolName?: string; // e.g. "โรงเรียนเตรียมอุดมศึกษา"
  address?: string; // ที่ตั้งสถานศึกษา เช่น เลขที่ 99 ถ.พญาไท
  moo?: string; // หมู่ที่ เช่น "หมู่ 1" หรือ "-"
  postalCode?: string; // e.g. "10330"
  province?: string; // e.g. "กรุงเทพมหานคร"
  district?: string; // e.g. "เขตปทุมวัน"
  subDistrict?: string; // e.g. "แขวงวังใหม่"
  parentViewToken?: string; // Token for parent access
  inviteCodeUsed?: string; // The teacher invite code used to register
  linkedStudentIds?: string[]; // Student UIDs linked to parent account
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface SchoolLocationInfo {
  schoolName?: string;
  address?: string; // ที่ตั้ง / เลขที่ / ถนน
  moo?: string; // หมู่ที่
  postalCode?: string;
  province?: string;
  district?: string;
  subDistrict?: string;
}

/** Teacher Invite Code record, stored in `teacher_invites` collection (doc id = code). */
export interface TeacherInvite {
  id: string; // Code string, e.g. "TCH-8K4M-9X"
  code: string;
  isUsed: boolean;
  note?: string; // e.g. "ครูสมชาย ใจดี"
  createdByUid?: string;
  createdByName?: string;
  createdAt: string; // ISO timestamp
  usedByUid?: string | null;
  usedByName?: string | null;
  usedAt?: string | null; // ISO timestamp
}

/** Admin Security / Invite Code record, stored in `admin_invites` collection (doc id = code). Starts with ADM- */
export interface AdminInvite {
  id: string; // Code string, e.g. "ADM-8K4M-9X"
  code: string;
  isUsed: boolean;
  note?: string; // e.g. "ผู้บริหาร / หัวหน้าฝ่ายไอที"
  createdByUid?: string;
  createdByName?: string;
  createdAt: string; // ISO timestamp
  usedByUid?: string | null;
  usedByName?: string | null;
  usedAt?: string | null; // ISO timestamp
}

/** Parent magic view token for non-authenticated link-based student monitoring. */
export interface ParentViewToken {
  id: string; // token string (24 chars)
  token: string;
  studentUid: string;
  studentId: string;
  studentName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Pre-approved administrator email whitelist record, stored in `admin_whitelist` collection. */
export interface AdminWhitelist {
  id: string; // Email address, e.g. "admin@school.ac.th"
  email: string;
  isApproved: boolean;
  note?: string;
  addedByUid?: string;
  addedByName?: string;
  createdAt: string;
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

/** Pre-aggregated student summary for instant LINE Webhook & Parent View lookup. */
export interface StudentSummary {
  id?: string;
  studentUid: string;
  studentId: string;
  fullName: string;
  searchName: string;
  normalizedFullName?: string;
  gradeLevel?: string;
  todayAttendance: {
    status: AttendanceStatus | "none";
    date: string; // ISO Date YYYY-MM-DD
    time?: string; // e.g. "08:15 น."
    className?: string;
  };
  attendanceStats: {
    present: number;
    late: number;
    excused: number;
    absent: number;
    total: number;
    rate: number;
  };
  grades: Array<{
    assignmentId?: string;
    subjectName: string;
    score: number;
    maxScore: number;
    grade: string; // e.g. "4", "3.5", "3"
  }>;
  gpa?: number;
  parentViewToken?: string;
  updatedAt: string;
}

/** Link between a LINE User ID and their active student record. */
export interface ParentLineLink {
  id?: string;
  lineUserId: string;
  studentUid: string;
  studentId: string;
  studentName: string;
  linkedAt: string;
}

/** Announcement post created by a teacher. */
export interface Announcement {
  id: string;
  classId?: string;
  className?: string;
  teacherId: string;
  teacherName: string;
  title: string;
  content: string;
  priority?: "normal" | "urgent";
  createdAt: string;
}

/** Contact information for a teacher. */
export interface TeacherContact {
  teacherId: string;
  teacherName: string;
  subjectName?: string;
  phoneNumber?: string;
  lineId?: string;
  email?: string;
}

/** Day of week for student class timetable */
export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";

/** A single timetable slot / period */
export interface ScheduleItem {
  id: string;
  day: DayOfWeek;
  period: number; // 1, 2, 3...
  startTime: string; // e.g. "08:30"
  endTime: string; // e.g. "09:20"
  subjectName: string; // e.g. "คณิตศาสตร์พื้นฐาน"
  subjectCode?: string; // e.g. "ค22101"
  teacherName?: string; // e.g. "ครูสมหมาย"
  room?: string; // e.g. "ห้อง 214"
  color?: "emerald" | "blue" | "purple" | "amber" | "rose" | "teal" | "indigo";
}

/** Class schedule / timetable by grade level or room */
export interface ClassSchedule {
  id?: string;
  gradeLevel: string; // e.g. "ม.2/1"
  items: ScheduleItem[];
  updatedAt?: string;
}


