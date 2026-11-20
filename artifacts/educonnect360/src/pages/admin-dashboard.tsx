import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { TeacherInvite, AdminWhitelist, User, ParentViewToken, Class } from "@/types";
import {
  createTeacherInvite,
  createTeacherInvitesBatch,
  deleteTeacherInvite,
  subscribeTeacherInvites,
  getAllAdminWhitelist,
  addAdminToWhitelist,
  deleteAdminFromWhitelist,
  getAllUsers,
  deleteUserFromSystem,
  getAllParentViewTokens,
  toggleParentTokenStatus,
  resetParentViewToken,
  bulkImportStudentsAndClasses,
  normalizeGradeRoom,
  getAllSchoolClasses,
  assignClassAdvisor,
  deduplicateClasses,
  deleteClass,
} from "@/lib/firestore";
import { parseExcelOrCsv, exportToExcel } from "@/lib/excel-helper";
import { CreateStudentDialog } from "@/components/create-student-dialog";
import { TeacherProfileModal } from "@/components/teacher-profile-modal";
import { AdminScheduleManager } from "@/components/admin-schedule-manager";
import { CreateClassModal } from "@/components/create-class-modal";

export default function AdminDashboard() {
  const { profile, firebaseUser } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<
    "invites" | "whitelist" | "users" | "schedules" | "import-students" | "classes"
  >("invites");

  // Tab 1: Teacher Invites state
  const [invites, setInvites] = useState<TeacherInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [note, setNote] = useState("");
  const [inviteQuantity, setInviteQuantity] = useState(1);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [latestCode, setLatestCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteFilter, setInviteFilter] = useState<"all" | "unused" | "used">("all");
  const [deletingCode, setDeletingCode] = useState<string | null>(null);

  // Excel Teacher Batch State
  const fileInputTeacherRef = useRef<HTMLInputElement>(null);
  const [teacherExcelRows, setTeacherExcelRows] = useState<any[]>([]);
  const [teacherExcelFileName, setTeacherExcelFileName] = useState("");
  const [generatingTeacherCodes, setGeneratingTeacherCodes] = useState(false);

  // Excel Student & Class Setup State
  const fileInputStudentRef = useRef<HTMLInputElement>(null);
  const [studentExcelRows, setStudentExcelRows] = useState<any[]>([]);
  const [studentExcelFileName, setStudentExcelFileName] = useState("");
  const [importingStudents, setImportingStudents] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; percent: number } | null>(null);
  const [studentImportResult, setStudentImportResult] = useState<{
    totalStudents: number;
    createdStudents: number;
    totalClasses: number;
    classList: string[];
  } | null>(null);

  // Tab 2: Admin Whitelist state
  const [whitelist, setWhitelist] = useState<AdminWhitelist[]>([]);
  const [loadingWhitelist, setLoadingWhitelist] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminNote, setNewAdminNote] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [deletingAdminEmail, setDeletingAdminEmail] = useState<string | null>(null);

  // Tab 3: Users & Parent Tokens state
  const [users, setUsers] = useState<User[]>([]);
  const [parentTokens, setParentTokens] = useState<ParentViewToken[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<"all" | "student" | "teacher" | "admin">("all");
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [togglingToken, setTogglingToken] = useState<string | null>(null);
  const [resettingTokenForStudent, setResettingTokenForStudent] = useState<string | null>(null);
  const [showCreateStudent, setShowCreateStudent] = useState(false);
  const [showCreateClassModal, setShowCreateClassModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingTeacherUser, setEditingTeacherUser] = useState<User | null>(null);

  // Tab 6: Classes & Advisors state
  const [schoolClasses, setSchoolClasses] = useState<Class[]>([]);
  const [loadingSchoolClasses, setLoadingSchoolClasses] = useState(false);
  const [deduplicating, setDeduplicating] = useState(false);
  const [assigningAdvisorId, setAssigningAdvisorId] = useState<string | null>(null);
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);

  async function loadSchoolClasses() {
    setLoadingSchoolClasses(true);
    try {
      const list = await getAllSchoolClasses();
      setSchoolClasses(list.sort((a, b) => (a.gradeLevel || "").localeCompare(b.gradeLevel || "")));
    } catch (err) {
      toast({
        variant: "destructive",
        title: "โหลดห้องเรียนไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoadingSchoolClasses(false);
    }
  }

  async function handleDeduplicateClasses() {
    setDeduplicating(true);
    try {
      const res = await deduplicateClasses();
      toast({
        title: "ล้างและรวมห้องเรียนซ้ำสำเร็จ",
        description: `ตรวจสอบ ${res.scanned} ห้อง, รวมห้องซ้ำ ${res.merged} รายการ, ลบห้องว่าง ${res.removed} รายการ`,
      });
      await loadSchoolClasses();
      if (users.length > 0) await loadUsersAndTokens();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "ดำเนินการไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeduplicating(false);
    }
  }

  async function handleAssignAdvisor(classId: string, teacherUser: User | null) {
    setAssigningAdvisorId(classId);
    try {
      const tId = teacherUser ? teacherUser.id || teacherUser.uid : "unassigned";
      const tName = teacherUser
        ? teacherUser.fullName || teacherUser.displayName || "คุณครู"
        : "ยังไม่กำหนดครูที่ปรึกษา";
      await assignClassAdvisor(classId, tId, tName);
      toast({
        title: "กำหนดครูที่ปรึกษาสำเร็จ",
        description: teacherUser
          ? `กำหนดให้ ${tName} เป็นครูที่ปรึกษาห้องเรียนนี้แล้ว`
          : "ยกเลิกครูที่ปรึกษาของห้องนี้แล้ว",
      });
      await loadSchoolClasses();
      if (users.length > 0) await loadUsersAndTokens();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "กำหนดครูที่ปรึกษาไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setAssigningAdvisorId(null);
    }
  }

  async function handleDeleteSchoolClass(classId: string, name: string) {
    if (!confirm(`คุณต้องการลบห้องเรียน "${name}" หรือไม่?`)) return;
    setDeletingClassId(classId);
    try {
      await deleteClass(classId);
      toast({
        title: "ลบห้องเรียนสำเร็จ",
        description: `ลบห้องเรียน "${name}" ออกจากระบบเรียบร้อยแล้ว`,
      });
      await loadSchoolClasses();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "ลบห้องเรียนไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeletingClassId(null);
    }
  }

  // Subscribe to Teacher Invites
  useEffect(() => {
    const unsubscribe = subscribeTeacherInvites((list) => {
      setInvites(list);
      setLoadingInvites(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Whitelist, Users, and Classes when switching tabs
  useEffect(() => {
    if (activeTab === "whitelist" && whitelist.length === 0) {
      loadWhitelist();
    } else if (activeTab === "users" && users.length === 0) {
      loadUsersAndTokens();
    } else if (activeTab === "classes") {
      loadSchoolClasses();
      if (users.length === 0) loadUsersAndTokens();
    }
  }, [activeTab]);

  async function loadWhitelist() {
    setLoadingWhitelist(true);
    try {
      const list = await getAllAdminWhitelist();
      setWhitelist(list);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "โหลดรายชื่อแอดมินไม่สำเร็จ",
        description: err instanceof Error ? err.message : "กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setLoadingWhitelist(false);
    }
  }

  async function loadUsersAndTokens() {
    setLoadingUsers(true);
    try {
      const [userList, tokenList] = await Promise.all([
        getAllUsers(),
        getAllParentViewTokens(),
      ]);
      setUsers(userList);
      setParentTokens(tokenList);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "โหลดข้อมูลผู้ใช้ไม่สำเร็จ",
        description: err instanceof Error ? err.message : "กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setLoadingUsers(false);
    }
  }

  /* ---------------- Tab 1: Teacher Invites Handlers ---------------- */
  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    setCreatingInvite(true);
    try {
      if (inviteQuantity > 1) {
        const batch = await createTeacherInvitesBatch(inviteQuantity, {
          prefixNote: note.trim() || undefined,
          createdByUid: profile?.uid,
          createdByName: profile?.displayName || profile?.fullName,
        });
        setLatestCode(batch[batch.length - 1]?.code || null);
        setNote("");
        setInviteQuantity(1);
        toast({
          title: `สร้างรหัสเชิญครูสำเร็จ ${batch.length} รหัส!`,
          description: `สามารถกดปุ่ม "แม่แบบ Excel ครู (พร้อมรหัส)" เพื่อดาวน์โหลดไฟล์ Excel ส่งต่อให้คุณครูได้ทันที`,
        });
      } else {
        const newInvite = await createTeacherInvite({
          note: note.trim() || undefined,
          createdByUid: profile?.uid,
          createdByName: profile?.displayName || profile?.fullName,
        });
        setLatestCode(newInvite.code);
        setNote("");
        toast({
          title: "สร้างรหัสเชิญครูสำเร็จ",
          description: `รหัส: ${newInvite.code} สามารถคัดลอกและส่งให้ครูได้ทันที`,
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "สร้างรหัสไม่สำเร็จ",
        description: err instanceof Error ? err.message : "กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setCreatingInvite(false);
    }
  }

  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast({
        title: "คัดลอกรหัสแล้ว",
        description: `คัดลอกรหัส ${code} ไปยังคลิปบอร์ดแล้ว`,
      });
      setTimeout(() => setCopiedCode(null), 2500);
    } catch {
      toast({
        variant: "destructive",
        title: "คัดลอกไม่สำเร็จ",
        description: "กรุณาคัดลอกด้วยตนเอง",
      });
    }
  }

  async function handleDeleteInvite(code: string) {
    if (!confirm(`คุณต้องการลบรหัส ${code} ใช่หรือไม่?`)) return;
    setDeletingCode(code);
    try {
      await deleteTeacherInvite(code);
      toast({
        title: "ลบรหัสเชิญแล้ว",
        description: `ลบรหัส ${code} สำเร็จ`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "ลบรหัสไม่สำเร็จ",
        description: err instanceof Error ? err.message : "กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setDeletingCode(null);
    }
  }

  /* ---------------- Teacher Excel Batch Invite Handlers ---------------- */
  async function handleTeacherExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setTeacherExcelFileName(file.name);
    try {
      const rows = await parseExcelOrCsv(file);
      if (!rows || rows.length === 0) {
        throw new Error("ไม่พบข้อมูลในไฟล์ Excel ที่อัปโหลด");
      }
      setTeacherExcelRows(rows);
      toast({
        title: "อ่านไฟล์ Excel สำเร็จ",
        description: `พบรายชื่อครูทั้งหมด ${rows.length} รายการ`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "อ่านไฟล์ไม่สำเร็จ",
        description: err instanceof Error ? err.message : "กรุณาตรวจสอบไฟล์",
      });
    }
  }

  async function handleGenerateTeacherCodesFromExcel() {
    if (!teacherExcelRows || teacherExcelRows.length === 0) return;
    setGeneratingTeacherCodes(true);
    try {
      const updatedRows: any[] = [];
      for (const row of teacherExcelRows) {
        const teacherName =
          row["ชื่อ-นามสกุล"] ||
          row["ชื่อครู"] ||
          row["ชื่อ"] ||
          row["fullName"] ||
          row["name"] ||
          "ครูผู้สอน";
        const subject = row["กลุ่มสาระ"] || row["วิชา"] || row["ตำแหน่ง"] || "";
        const noteStr = subject ? `${teacherName} (${subject})` : teacherName;

        const newInvite = await createTeacherInvite({
          note: noteStr,
          createdByUid: profile?.uid,
          createdByName: profile?.displayName || profile?.fullName,
        });

        updatedRows.push({
          ...row,
          "รหัสลงทะเบียนบุคลากร (Teacher Invite Code)": newInvite.code,
        });
      }

      setTeacherExcelRows(updatedRows);
      const exportName = `รายชื่อครูพร้อมรหัสลงทะเบียน_${new Date().toISOString().slice(0, 10)}`;
      await exportToExcel(updatedRows, exportName, "รายชื่อครู");

      toast({
        title: "สร้างรหัสเชิญครูสำเร็จและดาวน์โหลดแล้ว!",
        description: `สร้างรหัสลงทะเบียนครูและบรรจุลงในไฟล์ Excel ${updatedRows.length} รายการเรียบร้อยแล้ว`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาดในการสร้างรหัส",
        description: err instanceof Error ? err.message : "กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setGeneratingTeacherCodes(false);
    }
  }

  async function handleDownloadTeacherTemplate() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const availableInvites = invites.filter((i) => !i.isUsed);
    const targetInvites = availableInvites.length > 0 ? availableInvites : invites;

    if (targetInvites.length > 0) {
      const rows = targetInvites.map((inv, idx) => ({
        "ลำดับ": idx + 1,
        "รหัสลงทะเบียนครู (Invite Code)": inv.code,
        "สถานะรหัส": inv.isUsed ? "ใช้งานแล้ว" : "พร้อมใช้งาน",
        "ชื่อ-นามสกุลครู": inv.usedByName || inv.note || "",
        "กลุ่มสาระ / วิชาที่สอน": "",
        "เบอร์โทรศัพท์": "",
        "ลิงก์ลงทะเบียนสำหรับครู": `${origin}/register?code=${inv.code}`,
        "วันที่สร้าง": inv.createdAt ? new Date(inv.createdAt).toLocaleDateString("th-TH") : new Date().toLocaleDateString("th-TH"),
        "คำแนะนำสำหรับครู": `เข้าลิงก์ ${origin}/register แล้วกรอกรหัส ${inv.code} เพื่อสร้างบัญชีครู`,
      }));

      const exportName = `แม่แบบรายชื่อครู_พร้อมรหัสลงทะเบียน_${targetInvites.length}รหัส_${new Date().toISOString().slice(0, 10)}`;
      await exportToExcel(rows, exportName, "รหัสลงทะเบียนครู");

      toast({
        title: "ดาวน์โหลดแม่แบบ Excel พร้อมรหัสสำเร็จ!",
        description: `นำรหัสลงทะเบียนครู ${targetInvites.length} รหัส บรรจุลงในไฟล์ Excel เรียบร้อยแล้ว สามารถส่งต่อให้ครูได้ทันที`,
      });
      return;
    }

    // หากยังไม่มีรหัสในระบบเลย ระบบจะสร้างรหัสชุดเริ่มต้น 10 รหัสบรรจุลงใน Excel ให้อัตโนมัติ
    setCreatingInvite(true);
    try {
      toast({
        title: "กำลังเตรียมแม่แบบและสร้างรหัส...",
        description: "ระบบกำลังสร้างรหัสลงทะเบียนครู 10 รหัสบรรจุลงในไฟล์ Excel",
      });

      const newInvites = await createTeacherInvitesBatch(10, {
        prefixNote: "ครูท่านที่",
        createdByUid: profile?.uid,
        createdByName: profile?.displayName || profile?.fullName,
      });

      const rows = newInvites.map((inv, idx) => ({
        "ลำดับ": idx + 1,
        "รหัสลงทะเบียนครู (Invite Code)": inv.code,
        "สถานะรหัส": "พร้อมใช้งาน",
        "ชื่อ-นามสกุลครู": "",
        "กลุ่มสาระ / วิชาที่สอน": "",
        "เบอร์โทรศัพท์": "",
        "ลิงก์ลงทะเบียนสำหรับครู": `${origin}/register?code=${inv.code}`,
        "วันที่สร้าง": new Date().toLocaleDateString("th-TH"),
        "คำแนะนำสำหรับครู": `เข้าลิงก์ ${origin}/register แล้วกรอกรหัส ${inv.code} เพื่อสร้างบัญชีครู`,
      }));

      const exportName = `แม่แบบรายชื่อครู_พร้อมรหัสลงทะเบียน_10รหัส_${new Date().toISOString().slice(0, 10)}`;
      await exportToExcel(rows, exportName, "รหัสลงทะเบียนครู");

      toast({
        title: "ดาวน์โหลดแม่แบบ Excel สำเร็จ!",
        description: "ระบบสร้างรหัสลงทะเบียนครู 10 รหัสพร้อมใช้งานและบรรจุลงในไฟล์เรียบร้อยแล้ว",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "ดาวน์โหลดแม่แบบไม่สำเร็จ",
        description: err instanceof Error ? err.message : "กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setCreatingInvite(false);
    }
  }

  /* ---------------- Student Excel Batch Import & Class Setup Handlers ---------------- */
  async function handleStudentExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStudentExcelFileName(file.name);
    try {
      const rows = await parseExcelOrCsv(file);
      if (!rows || rows.length === 0) {
        throw new Error("ไม่พบข้อมูลในไฟล์ Excel ที่อัปโหลด");
      }
      setStudentExcelRows(rows);
      setStudentImportResult(null);
      toast({
        title: "อ่านไฟล์ Excel สำเร็จ",
        description: `พบข้อมูลนักเรียนทั้งหมด ${rows.length} คน`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "อ่านไฟล์ไม่สำเร็จ",
        description: err instanceof Error ? err.message : "กรุณาตรวจสอบไฟล์",
      });
    }
  }

  async function handleExecuteStudentImport() {
    if (!studentExcelRows || studentExcelRows.length === 0) return;
    setImportingStudents(true);
    setImportProgress({ current: 0, total: studentExcelRows.length, percent: 0 });
    try {
      const mappedStudents: Array<{ studentId: string; fullName: string; gradeLevel: string }> = [];

      for (const row of studentExcelRows) {
        const rawId = (row["รหัสนักเรียน"] || row["studentId"] || row["ID"] || row["รหัส"] || "").toString().trim();
        const rawName = (row["ชื่อ-นามสกุล"] || row["ชื่อ"] || row["fullName"] || row["name"] || "").toString().trim();
        const rawGrade = (row["ระดับชั้น"] || row["ชั้นเรียน"] || row["ห้อง"] || row["grade"] || row["gradeLevel"] || "").toString().trim();

        if (rawId && rawName) {
          mappedStudents.push({
            studentId: rawId,
            fullName: rawName,
            gradeLevel: rawGrade,
          });
        }
      }

      if (mappedStudents.length === 0) {
        throw new Error("ไม่พบข้อมูลรหัสนักเรียนและชื่อ-นามสกุลในไฟล์ กรุณาตรวจสอบหัวตาราง");
      }

      const result = await bulkImportStudentsAndClasses(
        mappedStudents,
        profile?.uid || "admin",
        (current, total) => {
          setImportProgress({
            current,
            total,
            percent: Math.min(100, Math.round((current / total) * 100)),
          });
        },
      );
      setStudentImportResult(result);
      toast({
        title: "นำเข้านักเรียนและจัดห้องเรียนสำเร็จ!",
        description: `สร้างบัญชีนักเรียน ${result.createdStudents} คน และจัดสรร ${result.totalClasses} ห้องเรียนเรียบร้อยแล้ว`,
      });
      loadUsersAndTokens();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "นำเข้าไม่สำเร็จ",
        description: err instanceof Error ? err.message : "เกิดข้อผิดพลาด",
      });
    } finally {
      setImportingStudents(false);
      setImportProgress(null);
    }
  }

  async function handleDownloadStudentTemplate() {
    const template = [
      {
        "รหัสนักเรียน": "67101",
        "ชื่อ-นามสกุล": "เด็กชายกิตติศักดิ์ พัฒนา",
        "ระดับชั้น": "ม.1/1",
      },
      {
        "รหัสนักเรียน": "67102",
        "ชื่อ-นามสกุล": "เด็กหญิงกัญญารัตน์ สดใส",
        "ระดับชั้น": "ม.1/1",
      },
      {
        "รหัสนักเรียน": "67103",
        "ชื่อ-นามสกุล": "เด็กชายธนากร เก่งกล้า",
        "ระดับชั้น": "ม.1/2",
      },
      {
        "รหัสนักเรียน": "67201",
        "ชื่อ-นามสกุล": "เด็กหญิงปาริฉัตร สมบูรณ์",
        "ระดับชั้น": "ป.4",
      },
    ];
    await exportToExcel(template, "แม่แบบรายชื่อนักเรียน_EduConnect360", "รายชื่อนักเรียน");
  }

  /* ---------------- Tab 2: Admin Whitelist Handlers ---------------- */
  async function handleAddAdmin(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = newAdminEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast({
        variant: "destructive",
        title: "รูปแบบอีเมลไม่ถูกต้อง",
        description: "กรุณาระบุอีเมลที่ถูกต้อง",
      });
      return;
    }

    setAddingAdmin(true);
    try {
      await addAdminToWhitelist(cleanEmail, newAdminNote, {
        uid: profile?.uid || "",
        name: profile?.displayName || profile?.fullName || "Admin",
      });
      setNewAdminEmail("");
      setNewAdminNote("");
      toast({
        title: "อนุมัติสิทธิ์แอดมินสำเร็จ",
        description: `เพิ่ม ${cleanEmail} เข้าสู่ระบบเรียบร้อย สามารถลงทะเบียนได้ทันที`,
      });
      loadWhitelist();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "เพิ่มแอดมินไม่สำเร็จ",
        description: err instanceof Error ? err.message : "กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setAddingAdmin(false);
    }
  }

  async function handleDeleteAdmin(email: string) {
    if (!confirm(`ต้องการยกเลิกสิทธิ์แอดมินของ ${email} ใช่หรือไม่?`)) return;
    setDeletingAdminEmail(email);
    try {
      await deleteAdminFromWhitelist(email);
      toast({
        title: "ยกเลิกสิทธิ์สำเร็จ",
        description: `ลบ ${email} ออกจากสิทธิ์แอดมินแล้ว`,
      });
      loadWhitelist();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "ยกเลิกสิทธิ์ไม่สำเร็จ",
        description: err instanceof Error ? err.message : "กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setDeletingAdminEmail(null);
    }
  }

  /* ---------------- Tab 3: Users & Parent Tokens Handlers ---------------- */
  async function handleDeleteUser(userId: string, userName: string) {
    const currentUid = profile?.id || profile?.uid || firebaseUser?.uid;
    if (userId === currentUid) {
      toast({
        variant: "destructive",
        title: "ไม่สามารถลบบัญชีของตนเองได้",
        description: "คุณกำลังเข้าสู่ระบบด้วยบัญชีนี้อยู่ ไม่สามารถลบผู้ดูแลระบบปัจจุบันได้",
      });
      return;
    }

    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้ "${userName}" ออกจากระบบ?`)) return;
    setDeletingUserId(userId);
    try {
      await deleteUserFromSystem(userId);
      toast({
        title: "ลบผู้ใช้สำเร็จ",
        description: `ลบ "${userName}" ออกจากฐานข้อมูลเรียบร้อยแล้ว`,
      });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      toast({
        variant: "destructive",
        title: "ลบผู้ใช้ไม่สำเร็จ",
        description: err instanceof Error ? err.message : "กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setDeletingUserId(null);
    }
  }

  async function handleToggleToken(token: string, currentStatus: boolean) {
    setTogglingToken(token);
    try {
      await toggleParentTokenStatus(token, !currentStatus);
      setParentTokens((prev) =>
        prev.map((t) => (t.token === token ? { ...t, isActive: !currentStatus } : t))
      );
      toast({
        title: "เปลี่ยนสถานะโทเค็นแล้ว",
        description: !currentStatus ? "เปิดใช้งานลิงก์ผู้ปกครองแล้ว" : "ปิดการเข้าถึงผ่านลิงก์แล้ว",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "เปลี่ยนสถานะไม่สำเร็จ",
        description: err instanceof Error ? err.message : "กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setTogglingToken(null);
    }
  }

  async function handleResetToken(studentUid: string, studentName: string) {
    if (!confirm(`คุณต้องการรีเซ็ตและสร้างลิงก์ผู้ปกครองใหม่สำหรับ "${studentName}" หรือไม่? ลิงก์เดิมจะไม่สามารถใช้งานได้อีก`)) return;
    setResettingTokenForStudent(studentUid);
    try {
      const newToken = await resetParentViewToken(studentUid);
      toast({
        title: "รีเซ็ตลิงก์สำเร็จ",
        description: `สร้างลิงก์ผู้ปกครองใหม่เรียบร้อย (${newToken.slice(0, 8)}...)`,
      });
      await loadUsersAndTokens();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "รีเซ็ตลิงก์ไม่สำเร็จ",
        description: err instanceof Error ? err.message : "กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setResettingTokenForStudent(null);
    }
  }

  async function handleCopyParentLink(token: string) {
    const url = `${window.location.origin}/parent-view?token=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "คัดลอกลิงก์ผู้ปกครองแล้ว",
        description: url,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "คัดลอกไม่สำเร็จ",
        description: "กรุณาคัดลอกด้วยตนเอง",
      });
    }
  }

  // Filtered lists
  const filteredInvites = invites.filter((inv) => {
    const matchesSearch =
      inv.code.toLowerCase().includes(inviteSearch.toLowerCase()) ||
      (inv.note && inv.note.toLowerCase().includes(inviteSearch.toLowerCase())) ||
      (inv.usedByName && inv.usedByName.toLowerCase().includes(inviteSearch.toLowerCase()));
    if (!matchesSearch) return false;
    if (inviteFilter === "unused") return !inv.isUsed;
    if (inviteFilter === "used") return inv.isUsed;
    return true;
  });

  const studentCount = users.filter((u) => u.role === "student").length;
  const teacherCount = users.filter((u) => u.role === "teacher").length;
  const adminCount = users.filter((u) => u.role === "admin").length;

  const filteredUsers = users.filter((u) => {
    const query = userSearch.toLowerCase();
    const nameMatch = (u.fullName || u.displayName || "").toLowerCase().includes(query);
    const emailMatch = (u.email || "").toLowerCase().includes(query);
    const studentIdMatch = (u.studentId || "").toLowerCase().includes(query);
    const roomMatch = (u.gradeLevel || "").toLowerCase().includes(query) || (u.advisorRoom || "").toLowerCase().includes(query);
    const matchesSearch = nameMatch || emailMatch || studentIdMatch || roomMatch;

    if (!matchesSearch) return false;
    if (userRoleFilter === "all") return true;
    return u.role === userRoleFilter;
  });

  const unusedCount = invites.filter((i) => !i.isUsed).length;
  const usedCount = invites.filter((i) => i.isUsed).length;

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-800 pb-16">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm shadow-emerald-500/20">
              <i className="fa-solid fa-shield-halved text-lg" />
            </div>
            <div>
              <h1 className="font-semibold text-slate-900 leading-tight">Admin Console</h1>
              <p className="text-xs text-slate-500">ระบบจัดการผู้ดูแลระบบและสิทธิ์การเข้าใช้งาน</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <i className="fa-solid fa-user-shield mr-1" />
              {profile?.email || firebaseUser?.email || "Admin"}
            </span>
            <button
              onClick={() => setShowContactModal(true)}
              className="px-3.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="แก้ไขข้อมูลติดต่อคุณครู (เบอร์โทรศัพท์ / LINE ID สำหรับผู้ปกครอง)"
            >
              <i className="fa-solid fa-address-card text-emerald-600" />
              <span>ข้อมูลติดต่อครู</span>
            </button>
            <Link
              href="/teacher"
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition"
              title="เข้าสู่ระบบการเรียนการสอน (จัดการห้องเรียน, เช็คชื่อ, การบ้าน, ใบลา)"
            >
              <i className="fa-solid fa-chalkboard-user mr-1" />
              <span>โหมดจัดการเรียนการสอน (ครู)</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        {/* Quick Teacher Portal Banner */}
        <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
              <i className="fa-solid fa-graduation-cap text-xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-slate-800 text-sm">ระบบการเรียนการสอน (สำหรับครูและบุคลากร)</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">ใช้งานได้ทันที</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                สามารถสร้างห้องเรียน เช็คชื่อนักเรียน มอบหมายงาน และอนุมัติใบลาเรียนได้ครบวงจร
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/teacher"
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-700 text-slate-700 text-xs font-semibold transition shadow-xs flex items-center gap-1.5"
            >
              <i className="fa-solid fa-chalkboard text-emerald-600" /> ห้องเรียนทั้งหมด
            </Link>
            <Link
              href="/teacher/leave-requests"
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-700 text-slate-700 text-xs font-semibold transition shadow-xs flex items-center gap-1.5"
            >
              <i className="fa-solid fa-file-signature text-emerald-600" /> ตรวจสอบใบลา
            </Link>
            <Link
              href="/teacher/ai-assistant"
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-700 text-slate-700 text-xs font-semibold transition shadow-xs flex items-center gap-1.5"
            >
              <i className="fa-solid fa-wand-magic-sparkles text-emerald-600" /> ผู้ช่วยสอน AI
            </Link>
            <button
              onClick={() => setShowCreateClassModal(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-plus" /> สร้างห้องเรียนใหม่
            </button>
            <button
              onClick={() => setShowContactModal(true)}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-700 text-slate-700 text-xs font-semibold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-address-card text-emerald-600" /> ข้อมูลติดต่อครู
            </button>
          </div>
        </div>
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-2 pt-2">
          <button
            onClick={() => setActiveTab("invites")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === "invites"
                ? "border-emerald-600 text-emerald-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <i className="fa-solid fa-ticket" />
            <span>รหัสลงทะเบียนครู</span>
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
              {invites.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("whitelist")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === "whitelist"
                ? "border-emerald-600 text-emerald-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <i className="fa-solid fa-user-shield" />
            <span>จัดการสิทธิ์แอดมิน (Whitelist)</span>
            {whitelist.length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
                {whitelist.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === "users"
                ? "border-emerald-600 text-emerald-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <i className="fa-solid fa-users" />
            <span>จัดการผู้ใช้งานและโทเค็น</span>
            {users.length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
                {users.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("schedules")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition cursor-pointer ${
              activeTab === "schedules"
                ? "border-emerald-600 text-emerald-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <i className="fa-solid fa-calendar-days" />
            <span>จัดการตารางเรียน (ม.1 - ม.6)</span>
          </button>

          <button
            onClick={() => setActiveTab("classes")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition cursor-pointer ${
              activeTab === "classes"
                ? "border-emerald-600 text-emerald-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <i className="fa-solid fa-chalkboard-user" />
            <span>จัดการห้องเรียน &amp; ครูที่ปรึกษา</span>
            {schoolClasses.length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
                {schoolClasses.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("import-students")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === "import-students"
                ? "border-emerald-600 text-emerald-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <i className="fa-solid fa-file-excel" />
            <span>นำเข้ารายชื่อนักเรียน &amp; จัดห้องเรียน (Excel)</span>
          </button>
        </div>

        {/* TAB 1: TEACHER INVITES */}
        {activeTab === "invites" && (
          <div className="space-y-6">
            {/* Generator Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <i className="fa-solid fa-plus-circle text-emerald-600" />
                    สร้างรหัสลงทะเบียนครูใหม่
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    รหัสจะอยู่ในรูปแบบ <code className="text-emerald-700 font-mono bg-emerald-50 px-1 py-0.5 rounded">TCH-XXXX-XX</code> ใช้งานได้เพียง 1 ครั้งต่อ 1 บัญชี
                  </p>
                </div>
                <form onSubmit={handleCreateInvite} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
                    <span className="text-xs font-semibold text-slate-500 shrink-0">จำนวน:</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={inviteQuantity}
                      onChange={(e) => setInviteQuantity(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                      className="w-14 px-1 py-0.5 text-sm text-center font-bold font-mono rounded bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-xs text-slate-400">รหัส</span>
                  </div>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="บันทึกช่วยจำ (เช่น กลุ่มสาระวิทย์ หรือเว้นว่าง)"
                    className="px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 min-w-[220px]"
                  />
                  <button
                    type="submit"
                    disabled={creatingInvite}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition shadow-sm shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    {creatingInvite ? (
                      <>
                        <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                        กำลังสร้าง...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-key" />
                        {inviteQuantity > 1 ? `สร้าง ${inviteQuantity} รหัส` : "สร้างรหัสใหม่"}
                      </>
                    )}
                  </button>
                </form>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span className="mr-1">เลือกจำนวนด่วน:</span>
                {[1, 5, 10, 20, 50, 100].map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => setInviteQuantity(qty)}
                    className={`px-2.5 py-1 rounded-lg border font-mono transition cursor-pointer ${
                      inviteQuantity === qty
                        ? "bg-emerald-100 border-emerald-300 text-emerald-800 font-bold"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                    }`}
                  >
                    +{qty} รหัส
                  </button>
                ))}
              </div>

              {latestCode && (
                <div className="mt-4 p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                      <i className="fa-solid fa-check" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-emerald-800">รหัสล่าสุดที่สร้างสำเร็จ</p>
                      <p className="text-xl font-bold font-mono tracking-wider text-emerald-950">{latestCode}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopy(latestCode)}
                    className="px-4 py-2 rounded-lg bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-100/50 text-xs font-semibold transition flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-copy" />
                    {copiedCode === latestCode ? "คัดลอกแล้ว!" : "คัดลอกรหัส"}
                  </button>
                </div>
              )}
            </div>

            {/* Teacher Batch Excel Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center text-xs">
                      <i className="fa-solid fa-file-excel" />
                    </span>
                    แนบไฟล์ Excel ครู &amp; เจนรหัสลงทะเบียน (Teacher Invite Code)
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    อัปโหลดรายชื่อครูจาก Excel ระบบจะสร้างรหัสลงทะเบียนบุคลากร และบันทึกรหัสลงในคอลัมน์ของไฟล์ให้ทันที
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadTeacherTemplate}
                    className="px-3.5 py-2 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    title="ดาวน์โหลดแม่แบบ Excel พร้อมรหัสลงทะเบียนครูที่มีอยู่ เพื่อนำไปส่งให้ครูหลายๆ คนได้ทันที"
                  >
                    <i className="fa-solid fa-file-excel text-teal-600" /> แม่แบบ Excel ครู (พร้อมรหัส)
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputTeacherRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
                  >
                    <i className="fa-solid fa-upload" /> แนบไฟล์ Excel ครู
                  </button>
                  <input
                    type="file"
                    ref={fileInputTeacherRef}
                    onChange={handleTeacherExcelUpload}
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                  />
                </div>
              </div>

              {teacherExcelRows.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs text-slate-600">
                      ตรวจพบรายชื่อครู <strong>{teacherExcelRows.length}</strong> ท่าน จากไฟล์ <span className="font-mono text-teal-700 font-semibold">{teacherExcelFileName}</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleGenerateTeacherCodesFromExcel}
                      disabled={generatingTeacherCodes}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition disabled:opacity-50"
                    >
                      {generatingTeacherCodes ? (
                        <>
                          <i className="fa-solid fa-circle-notch fa-spin" /> กำลังเจนรหัสลงทะเบียนและบันทึกลง Excel...
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-wand-magic-sparkles" /> กดเจนรหัสมาใส่ในรายชื่อของครูใน Excel
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* List & Filter Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">รายการรหัสทั้งหมด</span>
                  <span className="text-xs text-slate-400">({invites.length} รายการ)</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <i className="fa-solid fa-search absolute left-3 top-2.5 text-xs text-slate-400" />
                    <input
                      type="text"
                      value={inviteSearch}
                      onChange={(e) => setInviteSearch(e.target.value)}
                      placeholder="ค้นหารหัส / บันทึก..."
                      className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
                    <button
                      onClick={() => setInviteFilter("all")}
                      className={`px-2.5 py-1 rounded-md transition ${inviteFilter === "all" ? "bg-white font-semibold text-slate-900 shadow-sm" : "text-slate-600"}`}
                    >
                      ทั้งหมด ({invites.length})
                    </button>
                    <button
                      onClick={() => setInviteFilter("unused")}
                      className={`px-2.5 py-1 rounded-md transition ${inviteFilter === "unused" ? "bg-white font-semibold text-emerald-700 shadow-sm" : "text-slate-600"}`}
                    >
                      ยังไม่ใช้ ({unusedCount})
                    </button>
                    <button
                      onClick={() => setInviteFilter("used")}
                      className={`px-2.5 py-1 rounded-md transition ${inviteFilter === "used" ? "bg-white font-semibold text-slate-700 shadow-sm" : "text-slate-600"}`}
                    >
                      ใช้แล้ว ({usedCount})
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadTeacherTemplate}
                    className="px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    title="ส่งออกรหัสลงทะเบียนครูทั้งหมดลงไฟล์ Excel"
                  >
                    <i className="fa-solid fa-file-excel text-teal-600" />
                    <span>ส่งออก Excel ({invites.length})</span>
                  </button>
                </div>
              </div>

              {loadingInvites ? (
                <div className="p-12 text-center text-slate-400 text-sm">
                  <i className="fa-solid fa-circle-notch fa-spin mr-2" /> กำลังโหลดข้อมูล...
                </div>
              ) : filteredInvites.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-sm">
                  <i className="fa-solid fa-inbox text-3xl mb-2 text-slate-300 block" />
                  ไม่พบรหัสเชิญตามเงื่อนไข
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="py-3 px-4">รหัส (Invite Code)</th>
                        <th className="py-3 px-4">สถานะ</th>
                        <th className="py-3 px-4">บันทึกช่วยจำ</th>
                        <th className="py-3 px-4">ผู้ใช้งาน</th>
                        <th className="py-3 px-4">วันที่สร้าง</th>
                        <th className="py-3 px-4 text-right">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredInvites.map((inv) => (
                        <tr key={inv.code} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 tracking-wider">
                            <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {inv.code}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {inv.isUsed ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-slate-600 bg-slate-100 border border-slate-200 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> ใช้แล้ว
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-emerald-700 bg-emerald-50 border border-emerald-200 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> พร้อมใช้งาน
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600 max-w-[200px] truncate">
                            {inv.note || "-"}
                          </td>
                          <td className="py-3 px-4">
                            {inv.usedByName ? (
                              <div>
                                <p className="font-medium text-slate-900">{inv.usedByName}</p>
                                <p className="text-[10px] text-slate-400">
                                  {inv.usedAt ? new Date(inv.usedAt).toLocaleDateString("th-TH") : ""}
                                </p>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString("th-TH") : "-"}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1">
                            {!inv.isUsed && (
                              <button
                                onClick={() => handleCopy(inv.code)}
                                title="คัดลอกรหัส"
                                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
                              >
                                <i className="fa-solid fa-copy mr-1" />
                                {copiedCode === inv.code ? "คัดลอกแล้ว" : "คัดลอก"}
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteInvite(inv.code)}
                              disabled={deletingCode === inv.code}
                              title="ลบรหัส"
                              className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 transition disabled:opacity-50"
                            >
                              <i className="fa-solid fa-trash-can" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ADMIN WHITELIST */}
        {activeTab === "whitelist" && (
          <div className="space-y-6">
            {/* Add Admin Form */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <i className="fa-solid fa-user-plus text-emerald-600" />
                เพิ่มอีเมลผู้ดูแลระบบ (Admin Whitelist)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                เพิ่มอีเมลที่ได้รับอนุมัติสิทธิ์ผู้ดูแลระบบ (Admin Whitelist) โดยไม่จำกัดโดเมน เมื่อเพิ่มแล้วเจ้าของอีเมลจะสามารถลงทะเบียนแอดมินหรือเข้าสู่ระบบได้ทันที
              </p>

              <form onSubmit={handleAddAdmin} className="mt-4 flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  required
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="กรอกอีเมล เช่น admin@school.ac.th หรือ admin@gmail.com"
                  className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <input
                  type="text"
                  value={newAdminNote}
                  onChange={(e) => setNewAdminNote(e.target.value)}
                  placeholder="หมายเหตุ (เช่น ฝ่ายวิชาการ)"
                  className="px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 min-w-[200px]"
                />
                <button
                  type="submit"
                  disabled={addingAdmin}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition shadow-sm shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {addingAdmin ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-shield-check" />
                      อนุมัติสิทธิ์
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Whitelist Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">รายชื่ออีเมลที่ได้รับสิทธิ์แอดมิน</span>
                  <span className="text-xs text-slate-400">({whitelist.length} บัญชี)</span>
                </div>
                <button
                  onClick={loadWhitelist}
                  className="text-xs text-slate-500 hover:text-emerald-600 flex items-center gap-1 transition"
                >
                  <i className="fa-solid fa-rotate-right" /> รีเฟรช
                </button>
              </div>

              {loadingWhitelist ? (
                <div className="p-12 text-center text-slate-400 text-sm">
                  <i className="fa-solid fa-circle-notch fa-spin mr-2" /> กำลังโหลดรายชื่อ...
                </div>
              ) : whitelist.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-sm">
                  <i className="fa-solid fa-user-shield text-3xl mb-2 text-slate-300 block" />
                  ยังไม่มีอีเมลในรายการ Whitelist
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="py-3 px-4">อีเมลที่ได้รับอนุญาต</th>
                        <th className="py-3 px-4">สถานะ</th>
                        <th className="py-3 px-4">หมายเหตุ</th>
                        <th className="py-3 px-4">ผู้อนุมัติ</th>
                        <th className="py-3 px-4">วันที่บันทึก</th>
                        <th className="py-3 px-4 text-right">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {whitelist.map((w) => (
                        <tr key={w.email} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4 font-medium text-slate-900">
                            <span className="inline-flex items-center gap-1.5">
                              <i className="fa-solid fa-envelope text-slate-400" />
                              {w.email}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-emerald-700 bg-emerald-50 border border-emerald-200 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> อนุมัติแล้ว
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{w.note || "-"}</td>
                          <td className="py-3 px-4 text-slate-500">{w.addedByName || "-"}</td>
                          <td className="py-3 px-4 text-slate-500">
                            {w.createdAt ? new Date(w.createdAt).toLocaleDateString("th-TH") : "-"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleDeleteAdmin(w.email)}
                              disabled={deletingAdminEmail === w.email}
                              className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 transition disabled:opacity-50 text-xs font-medium"
                            >
                              <i className="fa-solid fa-trash-can mr-1" /> ลบสิทธิ์
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: USERS & PARENT TOKENS */}
        {activeTab === "users" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">รายชื่อผู้ใช้ทั้งหมดในระบบ</span>
                  <span className="text-xs text-slate-400">({users.length} คน)</span>
                  <button
                    onClick={() => setShowCreateStudent(true)}
                    className="ml-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-sm flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-user-plus" />
                    + สร้างบัญชีนักเรียนใหม่
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <i className="fa-solid fa-search absolute left-3 top-2.5 text-xs text-slate-400" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="ค้นหาชื่อ / รหัสนักเรียน / อีเมล..."
                      className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 min-w-[200px]"
                    />
                  </div>
                  <div className="flex rounded-xl border border-slate-200 p-1 bg-slate-100/70 text-xs gap-1">
                    <button
                      onClick={() => setUserRoleFilter("all")}
                      className={`px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 ${
                        userRoleFilter === "all"
                          ? "bg-white font-semibold text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <i className="fa-solid fa-users text-slate-400" />
                      ทั้งหมด ({users.length})
                    </button>
                    <button
                      onClick={() => setUserRoleFilter("student")}
                      className={`px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 ${
                        userRoleFilter === "student"
                          ? "bg-emerald-600 font-semibold text-white shadow-sm"
                          : "text-slate-600 hover:text-emerald-700"
                      }`}
                    >
                      <i className="fa-solid fa-graduation-cap" />
                      นักเรียน ({studentCount})
                    </button>
                    <button
                      onClick={() => setUserRoleFilter("teacher")}
                      className={`px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 ${
                        userRoleFilter === "teacher"
                          ? "bg-teal-600 font-semibold text-white shadow-sm"
                          : "text-slate-600 hover:text-teal-700"
                      }`}
                    >
                      <i className="fa-solid fa-chalkboard-user" />
                      ครูและบุคลากร ({teacherCount})
                    </button>
                    <button
                      onClick={() => setUserRoleFilter("admin")}
                      className={`px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 ${
                        userRoleFilter === "admin"
                          ? "bg-purple-600 font-semibold text-white shadow-sm"
                          : "text-slate-600 hover:text-purple-700"
                      }`}
                    >
                      <i className="fa-solid fa-shield-halved" />
                      แอดมิน ({adminCount})
                    </button>
                  </div>
                </div>
              </div>

              {loadingUsers ? (
                <div className="p-12 text-center text-slate-400 text-sm">
                  <i className="fa-solid fa-circle-notch fa-spin mr-2" /> กำลังโหลดรายชื่อผู้ใช้...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-sm">
                  <i className="fa-solid fa-users text-3xl mb-2 text-slate-300 block" />
                  ไม่พบผู้ใช้ตามที่ค้นหา
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="py-3 px-4">ผู้ใช้งาน</th>
                        <th className="py-3 px-4">บทบาท</th>
                        <th className="py-3 px-4">ชั้นเรียน / ห้องที่ปรึกษา</th>
                        <th className="py-3 px-4">ข้อมูลระบุตัวตน / โทเค็น</th>
                        <th className="py-3 px-4">วันที่ลงทะเบียน</th>
                        <th className="py-3 px-4 text-right">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredUsers.map((u) => {
                        const tokenInfo = parentTokens.find((pt) => pt.studentUid === u.id || pt.token === u.parentViewToken);
                        const isStudent = u.role === "student";
                        const isTeacher = u.role === "teacher";
                        const isAdmin = u.role === "admin";

                        return (
                          <tr key={u.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-4">
                              <p className="font-semibold text-slate-900">{u.fullName || u.displayName || "ไม่มีชื่อ"}</p>
                              <p className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">UID: {u.id}</p>
                            </td>
                            <td className="py-3 px-4">
                              {isStudent ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-emerald-700 bg-emerald-50 border border-emerald-200 font-medium">
                                  <i className="fa-solid fa-graduation-cap mr-1 text-[10px]" />
                                  นักเรียน
                                </span>
                              ) : isTeacher ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-teal-700 bg-teal-50 border border-teal-200 font-medium">
                                  <i className="fa-solid fa-chalkboard-user mr-1 text-[10px]" />
                                  คุณครู
                                </span>
                              ) : isAdmin ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-purple-700 bg-purple-50 border border-purple-200 font-medium">
                                  <i className="fa-solid fa-shield-halved mr-1 text-[10px]" />
                                  ผู้ดูแลระบบ
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-slate-600 bg-slate-100 border border-slate-200 font-medium">
                                  {u.role}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {isStudent ? (
                                u.gradeLevel ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-sm">
                                    <i className="fa-solid fa-door-open mr-1 text-emerald-600" />
                                    ห้อง {u.gradeLevel}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-xs italic">ยังไม่ระบุห้อง</span>
                                )
                              ) : isTeacher ? (
                                (u.advisorRoom || u.gradeLevel) ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200 shadow-sm">
                                      <i className="fa-solid fa-id-badge mr-1.5 text-teal-600" />
                                      ที่ปรึกษา {u.advisorRoom || u.gradeLevel}
                                    </span>
                                    <button
                                      onClick={() => setEditingTeacherUser(u)}
                                      title="แก้ไขห้องที่ปรึกษา"
                                      className="px-1.5 py-0.5 text-xs text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 rounded border border-teal-200 transition cursor-pointer"
                                    >
                                      <i className="fa-solid fa-pen text-[10px]" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setEditingTeacherUser(u)}
                                    className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium text-teal-700 bg-teal-50/80 hover:bg-teal-100 border border-dashed border-teal-300 transition cursor-pointer"
                                  >
                                    <i className="fa-solid fa-plus mr-1" /> กำหนดห้องที่ปรึกษา
                                  </button>
                                )
                              ) : (
                                <span className="text-slate-400 text-xs">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {isStudent ? (
                                <div className="space-y-1.5">
                                  <div>
                                    <span className="font-mono font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs">
                                      รหัส: {u.studentId || "-"}
                                    </span>
                                  </div>
                                  {tokenInfo ? (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className={`inline-block w-2 h-2 rounded-full ${
                                            tokenInfo.isActive ? "bg-emerald-500" : "bg-rose-400"
                                          }`}
                                        />
                                        <span className="font-mono text-[11px] text-slate-600">
                                          {tokenInfo.token.slice(0, 10)}...
                                        </span>
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                          tokenInfo.isActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"
                                        }`}>
                                          {tokenInfo.isActive ? "เปิด" : "ปิด"}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => handleCopyParentLink(tokenInfo.token)}
                                          title="คัดลอกลิงก์ผู้ปกครอง"
                                          className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] transition cursor-pointer"
                                        >
                                          <i className="fa-solid fa-copy mr-1" /> ลิงก์
                                        </button>
                                        <button
                                          onClick={() => handleToggleToken(tokenInfo.token, tokenInfo.isActive)}
                                          disabled={togglingToken === tokenInfo.token}
                                          title={tokenInfo.isActive ? "ปิดการเข้าถึง" : "เปิดการเข้าถึง"}
                                          className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] transition cursor-pointer"
                                        >
                                          {tokenInfo.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                                        </button>
                                        <button
                                          onClick={() => handleResetToken(u.id, u.fullName || u.displayName || "")}
                                          disabled={resettingTokenForStudent === u.id}
                                          title="สร้างลิงก์ใหม่ (รีเซ็ต)"
                                          className="px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] transition cursor-pointer"
                                        >
                                          <i className="fa-solid fa-rotate mr-0.5" /> รีเซ็ต
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleResetToken(u.id, u.fullName || u.displayName || "")}
                                      disabled={resettingTokenForStudent === u.id}
                                      className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-medium transition cursor-pointer"
                                    >
                                      + สร้างลิงก์ผู้ปกครอง
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <div className="text-slate-700 font-medium text-xs flex items-center gap-1.5">
                                    <i className="fa-regular fa-envelope text-slate-400 text-[11px]" />
                                    {u.email || "-"}
                                  </div>
                                  {(u.phoneNumber || u.lineId) && (
                                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                      {u.phoneNumber && (
                                        <span>
                                          <i className="fa-solid fa-phone text-slate-400 mr-0.5" />
                                          {u.phoneNumber}
                                        </span>
                                      )}
                                      {u.lineId && (
                                        <span>
                                          <i className="fa-brands fa-line text-emerald-500 mr-0.5" />
                                          {u.lineId}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-500">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString("th-TH") : "-"}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isTeacher && (
                                  <button
                                    onClick={() => setEditingTeacherUser(u)}
                                    className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 transition text-xs font-semibold flex items-center gap-1 cursor-pointer"
                                    title="แก้ไขข้อมูลคุณครูและห้องที่ปรึกษา"
                                  >
                                    <i className="fa-solid fa-pen-to-square" /> แก้ไขที่ปรึกษา
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteUser(u.id, u.fullName || u.displayName || u.email)}
                                  disabled={deletingUserId === u.id}
                                  className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition disabled:opacity-50 text-xs font-medium cursor-pointer flex items-center gap-1"
                                >
                                  {deletingUserId === u.id ? (
                                    <>
                                      <i className="fa-solid fa-circle-notch fa-spin text-[10px]" /> กำลังลบ...
                                    </>
                                  ) : (
                                    <>
                                      <i className="fa-solid fa-trash-can mr-1" /> ลบ
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "schedules" && (
          <AdminScheduleManager />
        )}

        {activeTab === "import-students" && (
          <div className="space-y-6 animate-in fade-in">
            {/* Header / Intro Card */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                      <i className="fa-solid fa-file-excel" />
                    </span>
                    <h2 className="text-lg font-bold text-slate-800">
                      นำเข้ารายชื่อนักเรียน &amp; จัดห้องเรียนอัตโนมัติ (Excel)
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500">
                    อัปโหลดไฟล์ Excel (.xlsx, .xls, .csv) เพื่อสร้างบัญชีนักเรียน และสร้างห้องเรียนอัตโนมัติตามระดับชั้นของสถานศึกษา
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleDownloadStudentTemplate}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-2 transition"
                  >
                    <i className="fa-solid fa-download text-emerald-600" /> ดาวน์โหลดแม่แบบ Excel
                  </button>
                  <button
                    onClick={() => fileInputStudentRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition"
                  >
                    <i className="fa-solid fa-upload" /> เลือกไฟล์ Excel นักเรียน
                  </button>
                  <input
                    type="file"
                    ref={fileInputStudentRef}
                    onChange={handleStudentExcelUpload}
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                  />
                </div>
              </div>

              {/* Requirement Rule Notice */}
              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-start gap-2.5">
                  <i className="fa-solid fa-layer-group text-emerald-600 mt-0.5 text-sm" />
                  <div className="text-xs text-emerald-900 leading-relaxed">
                    <span className="font-semibold">กฎการจัดห้องเรียนอัตโนมัติ:</span> หากในไฟล์ระบุระดับชั้นแบบไม่มีห้อง เช่น <code className="bg-emerald-100/70 px-1 py-0.5 rounded text-emerald-800 font-mono">ม.1</code> หรือ <code className="bg-emerald-100/70 px-1 py-0.5 rounded text-emerald-800 font-mono">ป.4</code> ระบบจะจัดสรรเข้าเป็น <strong>ห้อง 1</strong> โดยอัตโนมัติ (เช่น <span className="font-semibold">ม.1/1</span> หรือ <span className="font-semibold">ป.4/1</span>)
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-100 flex items-start gap-2.5">
                  <i className="fa-solid fa-key text-teal-600 mt-0.5 text-sm" />
                  <div className="text-xs text-teal-900 leading-relaxed">
                    <span className="font-semibold">รหัสนักเรียน &amp; รหัสผ่าน:</span> นักเรียนสามารถเข้าสู่ระบบด้วย <strong>รหัสนักเรียน</strong> และรหัสผ่านเหมือนกันทุกคนคือ <code className="bg-teal-100/70 px-1 py-0.5 rounded text-teal-800 font-mono font-bold">0000</code> โดยระบบจะสร้างบัญชีและลิงก์ผู้ปกครองให้อัตโนมัติ
                  </div>
                </div>
              </div>
            </div>

            {/* Import Result Notification */}
            {studentImportResult && (
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-sm animate-in fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-circle-check text-lg" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-emerald-900">
                      นำเข้าข้อมูลนักเรียนและสร้างห้องเรียนสำเร็จ!
                    </h3>
                    <p className="text-xs text-emerald-700 mt-1">
                      เพิ่มนักเรียนใหม่จำนวน <span className="font-bold">{studentImportResult.createdStudents}</span> คน และจัดสรรห้องเรียน <span className="font-bold">{studentImportResult.totalClasses}</span> ห้อง
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {studentImportResult.classList.map((cName) => (
                        <span key={cName} className="px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-800 text-xs font-semibold shadow-xs">
                          <i className="fa-solid fa-chalkboard-user mr-1 text-emerald-600" /> {cName}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Preview Table if file loaded */}
            {studentExcelRows.length > 0 && (
              <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4 animate-in fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                      {studentExcelRows.length}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">
                        ตัวอย่างรายชื่อนักเรียนจากไฟล์: <span className="text-emerald-700 font-mono">{studentExcelFileName}</span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        ตรวจสอบความถูกต้องของรหัสและระดับชั้นก่อนกดยืนยันนำเข้า
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleExecuteStudentImport}
                    disabled={importingStudents}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-75"
                  >
                    {importingStudents ? (
                      <>
                        <i className="fa-solid fa-circle-notch fa-spin text-sm" />
                        <span>
                          {importProgress
                            ? `กำลังนำเข้า ${importProgress.current}/${importProgress.total} คน (${importProgress.percent}%)`
                            : "กำลังเริ่มต้นนำเข้า..."}
                        </span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-user-check" /> เริ่มนำเข้าและจัดห้องเรียนอัตโนมัติ
                      </>
                    )}
                  </button>
                </div>

                {importingStudents && importProgress && (
                  <div className="space-y-1.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold">
                      <span>กำลังประมวลผลข้อมูลนักเรียนแบบกลุ่ม (Batch)</span>
                      <span>{importProgress.percent}% ({importProgress.current} จาก {importProgress.total} คน)</span>
                    </div>
                    <div className="w-full bg-emerald-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-2.5 rounded-full transition-all duration-200"
                        style={{ width: `${importProgress.percent}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4 w-12 text-center">#</th>
                        <th className="py-2.5 px-4">รหัสนักเรียน</th>
                        <th className="py-2.5 px-4">ชื่อ-นามสกุล</th>
                        <th className="py-2.5 px-4">ระดับชั้นจากไฟล์</th>
                        <th className="py-2.5 px-4">ห้องเรียนอัตโนมัติ</th>
                        <th className="py-2.5 px-4 text-center">รหัสผ่านเริ่มต้น</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {studentExcelRows.slice(0, 30).map((row, idx) => {
                        const rawId = (row["รหัสนักเรียน"] || row["studentId"] || row["ID"] || row["รหัส"] || "-").toString();
                        const rawName = (row["ชื่อ-นามสกุล"] || row["ชื่อ"] || row["fullName"] || row["name"] || "-").toString();
                        const rawGrade = (row["ระดับชั้น"] || row["ชั้นเรียน"] || row["ห้อง"] || row["grade"] || row["gradeLevel"] || "ห้อง 1").toString();
                        const resolvedRoom = normalizeGradeRoom(rawGrade);

                        return (
                          <tr key={idx} className="hover:bg-slate-50/70 transition">
                            <td className="py-2 px-4 text-center text-slate-400">{idx + 1}</td>
                            <td className="py-2 px-4 font-mono font-bold text-slate-900">{rawId}</td>
                            <td className="py-2 px-4 font-medium text-slate-800">{rawName}</td>
                            <td className="py-2 px-4 text-slate-600">{rawGrade}</td>
                            <td className="py-2 px-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <i className="fa-solid fa-door-open mr-1 text-emerald-600" />
                                {resolvedRoom}
                              </span>
                            </td>
                            <td className="py-2 px-4 text-center">
                              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold text-[11px]">
                                0000
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {studentExcelRows.length > 30 && (
                  <p className="text-center text-xs text-slate-400 py-1">
                    แสดง 30 จากทั้งหมด {studentExcelRows.length} รายการ (ระบบจะนำเข้าข้อมูลครบทุกแถว)
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: CLASSES & HOMEROOM ADVISORS */}
        {activeTab === "classes" && (
          <div className="space-y-6 animate-fade-in">
            {/* Header Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm">
                      <i className="fa-solid fa-chalkboard-user" />
                    </span>
                    จัดการห้องเรียนและครูที่ปรึกษาประจำห้อง ({schoolClasses.length} ห้อง)
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    จัดสรรครูที่ปรึกษาสำหรับแต่ละห้องเรียน และรวมห้องเรียนที่ซ้ำซ้อนเพื่อให้ข้อมูลไม่ซ้ำกัน
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleDeduplicateClasses}
                    disabled={deduplicating}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="ตรวจสอบ รวมห้องเรียนที่ซ้ำซ้อน และลบห้องว่างที่ไม่มีนักเรียน"
                  >
                    {deduplicating ? (
                      <>
                        <i className="fa-solid fa-circle-notch fa-spin text-xs" /> กำลังตรวจสอบ...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-broom text-xs" /> รวมห้อง &amp; ล้างข้อมูลซ้ำซ้อน
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCreateClassModal(true)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fa-solid fa-plus text-xs" /> สร้างห้องเรียนใหม่
                  </button>

                  <button
                    type="button"
                    onClick={loadSchoolClasses}
                    className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition cursor-pointer"
                    title="รีเฟรช"
                  >
                    <i className="fa-solid fa-arrows-rotate" />
                  </button>
                </div>
              </div>
            </div>

            {/* Classes Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              {loadingSchoolClasses ? (
                <div className="text-center py-16 text-slate-400 text-sm">
                  <i className="fa-solid fa-circle-notch fa-spin text-emerald-600 text-xl mb-2" />
                  <p>กำลังโหลดรายชื่อห้องเรียน...</p>
                </div>
              ) : schoolClasses.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <i className="fa-solid fa-chalkboard text-3xl opacity-30 mb-2" />
                  <p className="text-sm">ยังไม่มีห้องเรียนในระบบ</p>
                  <p className="text-xs mt-1">สามารถสร้างห้องเรียนใหม่ หรือนำเข้าไฟล์ Excel นักเรียน</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4 w-12 text-center">#</th>
                        <th className="py-3 px-4">ระดับชั้น</th>
                        <th className="py-3 px-4">ชื่อห้องเรียน</th>
                        <th className="py-3 px-4 text-center">รหัสเข้าห้อง</th>
                        <th className="py-3 px-4 text-center">จำนวนนักเรียน</th>
                        <th className="py-3 px-4">ครูที่ปรึกษา / ครูผู้สอน</th>
                        <th className="py-3 px-4 text-center">มอบหมายครูที่ปรึกษา</th>
                        <th className="py-3 px-4 text-right">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {schoolClasses.map((cls, idx) => {
                        const teacherUsers = users.filter((u) => u.role === "teacher" || u.role === "admin");
                        const currentTeacher = teacherUsers.find((u) => (u.id || u.uid) === cls.teacherId);
                        const isAssigning = assigningAdvisorId === cls.id;

                        return (
                          <tr key={cls.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3.5 px-4 text-center text-xs text-slate-400 font-mono">
                              {idx + 1}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-800">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                {cls.gradeLevel || "-"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-medium text-slate-800">
                              {cls.name}
                            </td>
                            <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-500">
                              {cls.joinCode}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                                <i className="fa-solid fa-users text-[10px]" />
                                {cls.studentIds?.length || 0} คน
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              {cls.teacherId && cls.teacherId !== "unassigned" ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                                  <i className="fa-solid fa-chalkboard-user text-teal-600" />
                                  {cls.teacherName || currentTeacher?.fullName || currentTeacher?.displayName || cls.teacherId}
                                </span>
                              ) : (
                                <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                                  <i className="fa-solid fa-triangle-exclamation" /> ยังไม่ระบุ
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="inline-flex items-center gap-1.5">
                                <select
                                  disabled={isAssigning}
                                  value={cls.teacherId || "unassigned"}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === "unassigned") {
                                      handleAssignAdvisor(cls.id, null);
                                    } else {
                                      const foundTeacher = teacherUsers.find((u) => (u.id || u.uid) === val);
                                      if (foundTeacher) handleAssignAdvisor(cls.id, foundTeacher);
                                    }
                                  }}
                                  className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer disabled:opacity-50"
                                >
                                  <option value="unassigned">-- ยังไม่ระบุ --</option>
                                  {teacherUsers.map((t) => (
                                    <option key={t.id || t.uid} value={t.id || t.uid}>
                                      {t.fullName || t.displayName || t.email} {t.advisorRoom ? `(${t.advisorRoom})` : ""}
                                    </option>
                                  ))}
                                </select>
                                {isAssigning && (
                                  <i className="fa-solid fa-circle-notch fa-spin text-xs text-emerald-600" />
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                disabled={deletingClassId === cls.id}
                                onClick={() => handleDeleteSchoolClass(cls.id, cls.name)}
                                className="px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-semibold transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                                title="ลบห้องเรียนนี้"
                              >
                                {deletingClassId === cls.id ? (
                                  <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                                ) : (
                                  <i className="fa-solid fa-trash-can text-xs" />
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <CreateStudentDialog
        open={showCreateStudent}
        onClose={() => setShowCreateStudent(false)}
        onSuccess={() => loadUsersAndTokens()}
      />

      <CreateClassModal
        open={showCreateClassModal}
        onClose={() => setShowCreateClassModal(false)}
        onSuccess={() => loadUsersAndTokens()}
        defaultGrade="ม.2/1"
      />

      <TeacherProfileModal
        open={showContactModal}
        onClose={() => setShowContactModal(false)}
      />

      <TeacherProfileModal
        open={!!editingTeacherUser}
        targetUser={editingTeacherUser}
        onClose={() => setEditingTeacherUser(null)}
        onSuccess={() => loadUsersAndTokens()}
      />
    </div>
  );
}
