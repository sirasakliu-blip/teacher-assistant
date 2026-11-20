import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { TeacherInvite, AdminWhitelist, User, ParentViewToken } from "@/types";
import {
  createTeacherInvite,
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
} from "@/lib/firestore";
import { CreateStudentDialog } from "@/components/create-student-dialog";

export default function AdminDashboard() {
  const { profile, firebaseUser } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"invites" | "whitelist" | "users">("invites");

  // Tab 1: Teacher Invites state
  const [invites, setInvites] = useState<TeacherInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [note, setNote] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [latestCode, setLatestCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteFilter, setInviteFilter] = useState<"all" | "unused" | "used">("all");
  const [deletingCode, setDeletingCode] = useState<string | null>(null);

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

  // Subscribe to Teacher Invites
  useEffect(() => {
    const unsubscribe = subscribeTeacherInvites((list) => {
      setInvites(list);
      setLoadingInvites(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Whitelist when switching to tab
  useEffect(() => {
    if (activeTab === "whitelist") {
      loadWhitelist();
    } else if (activeTab === "users") {
      loadUsersAndTokens();
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

  /* ---------------- Tab 2: Admin Whitelist Handlers ---------------- */
  async function handleAddAdmin(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = newAdminEmail.trim().toLowerCase();
    if (!cleanEmail.endsWith(".ac.th")) {
      toast({
        variant: "destructive",
        title: "รูปแบบอีเมลไม่ถูกต้อง",
        description: "อีเมลผู้ดูแลระบบต้องลงท้ายด้วย .ac.th เท่านั้น",
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
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้ "${userName}" ออกจากระบบ?`)) return;
    setDeletingUserId(userId);
    try {
      await deleteUserFromSystem(userId);
      toast({
        title: "ลบผู้ใช้สำเร็จ",
        description: `ลบ "${userName}" ออกจากฐานข้อมูลแล้ว`,
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

  const filteredUsers = users.filter((u) => {
    const nameMatch = (u.fullName || u.displayName || "").toLowerCase().includes(userSearch.toLowerCase());
    const emailMatch = (u.email || "").toLowerCase().includes(userSearch.toLowerCase());
    const studentIdMatch = (u.studentId || "").toLowerCase().includes(userSearch.toLowerCase());
    const matchesSearch = nameMatch || emailMatch || studentIdMatch;

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
            <span>จัดการสิทธิ์แอดมิน (.ac.th)</span>
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
                <form onSubmit={handleCreateInvite} className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto">
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="บันทึกช่วยจำ (เช่น ครูสมชาย / กลุ่มสาระวิทย์)"
                    className="px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 min-w-[260px]"
                  />
                  <button
                    type="submit"
                    disabled={creatingInvite}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition shadow-sm shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {creatingInvite ? (
                      <>
                        <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                        กำลังสร้าง...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-key" />
                        สร้างรหัสใหม่
                      </>
                    )}
                  </button>
                </form>
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
                ระบบจะตรวจสอบว่าอีเมลต้องลงท้ายด้วย <code className="text-emerald-700 font-mono bg-emerald-50 px-1 py-0.5 rounded">.ac.th</code> เท่านั้น เมื่อเพิ่มแล้วเจ้าของอีเมลจะสามารถสมัครบัญชีแอดมินผ่านลิงก์เฉพาะได้
              </p>

              <form onSubmit={handleAddAdmin} className="mt-4 flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  required
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="อีเมลทางการ เช่น admin@school.ac.th"
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
                  <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
                    <button
                      onClick={() => setUserRoleFilter("all")}
                      className={`px-2.5 py-1 rounded-md transition ${userRoleFilter === "all" ? "bg-white font-semibold text-slate-900 shadow-sm" : "text-slate-600"}`}
                    >
                      ทั้งหมด
                    </button>
                    <button
                      onClick={() => setUserRoleFilter("student")}
                      className={`px-2.5 py-1 rounded-md transition ${userRoleFilter === "student" ? "bg-white font-semibold text-emerald-700 shadow-sm" : "text-slate-600"}`}
                    >
                      นักเรียน
                    </button>
                    <button
                      onClick={() => setUserRoleFilter("teacher")}
                      className={`px-2.5 py-1 rounded-md transition ${userRoleFilter === "teacher" ? "bg-white font-semibold text-teal-700 shadow-sm" : "text-slate-600"}`}
                    >
                      ครู
                    </button>
                    <button
                      onClick={() => setUserRoleFilter("admin")}
                      className={`px-2.5 py-1 rounded-md transition ${userRoleFilter === "admin" ? "bg-white font-semibold text-purple-700 shadow-sm" : "text-slate-600"}`}
                    >
                      แอดมิน
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
                        <th className="py-3 px-4">ข้อมูลระบุตัวตน</th>
                        <th className="py-3 px-4">โทเค็นผู้ปกครอง (Magic Link)</th>
                        <th className="py-3 px-4">วันที่ลงทะเบียน</th>
                        <th className="py-3 px-4 text-right">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredUsers.map((u) => {
                        const tokenInfo = parentTokens.find((pt) => pt.studentUid === u.id || pt.token === u.parentViewToken);
                        const isStudent = u.role === "student";

                        return (
                          <tr key={u.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-4">
                              <p className="font-semibold text-slate-900">{u.fullName || u.displayName || "ไม่มีชื่อ"}</p>
                              <p className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">UID: {u.id}</p>
                            </td>
                            <td className="py-3 px-4">
                              {u.role === "student" ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-emerald-700 bg-emerald-50 border border-emerald-200 font-medium">
                                  นักเรียน
                                </span>
                              ) : u.role === "teacher" ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-teal-700 bg-teal-50 border border-teal-200 font-medium">
                                  ครู
                                </span>
                              ) : u.role === "admin" ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-purple-700 bg-purple-50 border border-purple-200 font-medium">
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
                                <div>
                                  <span className="font-mono font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    รหัส: {u.studentId || "-"}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-600">{u.email}</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {isStudent ? (
                                tokenInfo ? (
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
                                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] transition"
                                      >
                                        <i className="fa-solid fa-copy mr-1" /> ลิงก์
                                      </button>
                                      <button
                                        onClick={() => handleToggleToken(tokenInfo.token, tokenInfo.isActive)}
                                        disabled={togglingToken === tokenInfo.token}
                                        title={tokenInfo.isActive ? "ปิดการเข้าถึง" : "เปิดการเข้าถึง"}
                                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] transition"
                                      >
                                        {tokenInfo.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                                      </button>
                                      <button
                                        onClick={() => handleResetToken(u.id, u.fullName || u.displayName || "")}
                                        disabled={resettingTokenForStudent === u.id}
                                        title="สร้างลิงก์ใหม่ (รีเซ็ต)"
                                        className="px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] transition"
                                      >
                                        <i className="fa-solid fa-rotate mr-0.5" /> รีเซ็ต
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleResetToken(u.id, u.fullName || u.displayName || "")}
                                    disabled={resettingTokenForStudent === u.id}
                                    className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-medium transition"
                                  >
                                    + สร้างลิงก์ผู้ปกครอง
                                  </button>
                                )
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-500">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString("th-TH") : "-"}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleDeleteUser(u.id, u.fullName || u.displayName || u.email)}
                                disabled={deletingUserId === u.id}
                                className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 transition disabled:opacity-50 text-xs font-medium"
                              >
                                <i className="fa-solid fa-trash-can mr-1" /> ลบผู้ใช้
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
    </div>
  );
}
