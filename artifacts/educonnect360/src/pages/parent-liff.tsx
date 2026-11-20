import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { signInAnonymously } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import {
  initLiff,
  isLiffInClient,
  isLiffLoggedIn,
  getLiffProfile,
  liffLogin,
  type LiffProfile,
} from "@/lib/liff";
import {
  getParentLineLink,
  linkParentLineUser,
  getStudentSummary,
  searchStudentsByQuery,
} from "@/lib/firestore";
import type { StudentSummary, User } from "@/types";

export default function ParentLiff() {
  const { toast } = useToast();

  // Guard & Initialization states
  const [initializing, setInitializing] = useState(true);
  const [isInClient, setIsInClient] = useState(false);
  const [isRichMenuSource, setIsRichMenuSource] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [lineProfile, setLineProfile] = useState<LiffProfile | null>(null);

  // App content states
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [currentSummary, setCurrentSummary] = useState<StudentSummary | null>(null);
  const [isChangingStudent, setIsChangingStudent] = useState(false);

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [linkingStudentId, setLinkingStudentId] = useState<string | null>(null);

  useEffect(() => {
    async function setup() {
      setInitializing(true);
      try {
        const params = new URLSearchParams(window.location.search);
        const sourceParam = params.get("source");
        const devParam = params.get("dev") === "true";
        setDevMode(devParam);

        const fromRichMenu = sourceParam === "richmenu" || devParam;
        setIsRichMenuSource(fromRichMenu);

        // Ensure Firebase Auth session exists so Firestore rules allow reads
        if (auth && !auth.currentUser) {
          signInAnonymously(auth).catch((e) => console.warn("Anonymous auth for LIFF:", e));
        }

        // Initialize LIFF
        await initLiff();

        const inClient = isLiffInClient() || devParam;
        setIsInClient(inClient);

        // If in client and not logged in (e.g. external browser fallback), trigger login
        if (inClient && !devParam) {
          if (!isLiffLoggedIn()) {
            liffLogin();
            return;
          }
          const profile = await getLiffProfile();
          setLineProfile(profile);

          if (profile?.userId) {
            await checkExistingLink(profile.userId);
          }
        } else if (devParam) {
          // Dev mock profile for local testing
          const mockProfile: LiffProfile = {
            userId: "DEV_PARENT_USER_123",
            displayName: "ผู้ปกครอง (ทดสอบ Dev Mode)",
            pictureUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120",
          };
          setLineProfile(mockProfile);
          await checkExistingLink(mockProfile.userId);
        }
      } catch (err) {
        console.error("LIFF setup error:", err);
      } finally {
        setInitializing(false);
      }
    }

    setup();
  }, []);

  async function checkExistingLink(lineUserId: string) {
    setLoadingStudent(true);
    try {
      const link = await getParentLineLink(lineUserId);
      if (link && link.studentUid) {
        const summary = await getStudentSummary(link.studentUid);
        if (summary) {
          setCurrentSummary(summary);
          setIsChangingStudent(false);
        } else {
          setIsChangingStudent(true);
        }
      } else {
        setIsChangingStudent(true);
      }
    } catch (err) {
      console.error("Error loading linked student:", err);
      setIsChangingStudent(true);
    } finally {
      setLoadingStudent(false);
    }
  }

  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      toast({
        variant: "destructive",
        title: "กรุณากรอกคำค้นหา",
        description: "พิมพ์ชื่อจริง (ไม่ต้องใส่นามสกุล) หรือ รหัสนักเรียน",
      });
      return;
    }

    setSearching(true);
    try {
      const results = await searchStudentsByQuery(query);
      setSearchResults(results);
      setHasSearched(true);
    } catch (err) {
      console.error("Search error:", err);
      toast({
        variant: "destructive",
        title: "ค้นหาไม่สำเร็จ",
        description: err instanceof Error ? err.message : "กรุณาลองใหม่อีกครั้ง",
      });
      setSearchResults([]);
      setHasSearched(true);
    } finally {
      setSearching(false);
    }
  }

  async function handleSelectStudent(student: User) {
    if (!lineProfile?.userId) {
      toast({
        variant: "destructive",
        title: "ไม่พบบัญชี LINE",
        description: "กรุณาเปิดใช้งานผ่านแอปพลิเคชัน LINE",
      });
      return;
    }

    setLinkingStudentId(student.id);
    try {
      // 1. Link parent LINE user ID with student
      await linkParentLineUser({
        lineUserId: lineProfile.userId,
        studentUid: student.id,
        studentId: student.studentId || "",
        studentName: student.fullName || student.displayName,
      });

      // 2. Fetch full pre-aggregated summary
      const summary = await getStudentSummary(student.id);
      setCurrentSummary(summary);
      setIsChangingStudent(false);
      setSearchQuery("");
      setSearchResults([]);
      setHasSearched(false);

      toast({
        title: "ผูกบัญชีสำเร็จ",
        description: `เข้าดูข้อมูลของ ${student.fullName || student.displayName} เรียบร้อยแล้ว`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "บันทึกไม่สำเร็จ",
        description: err instanceof Error ? err.message : "กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setLinkingStudentId(null);
    }
  }

  // Loading Screen
  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-600/10 text-emerald-700 flex items-center justify-center mb-4">
          <i className="fa-solid fa-circle-notch fa-spin text-2xl" />
        </div>
        <p className="text-base font-semibold text-slate-800">กำลังเชื่อมต่อ LINE Official Account...</p>
        <p className="text-xs text-slate-500 mt-1">กรุณารอสักครู่</p>
      </div>
    );
  }

  // =========================================================================
  // GUARD SCREEN: Blocked if opened outside LINE In-App / Rich Menu
  // =========================================================================
  if (!isInClient && !devMode) {
    const lineOaUrl = "https://line.me/R/ti/p/@school-educonnect";

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-slate-200/80 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 mx-auto flex items-center justify-center shadow-inner">
            <i className="fa-solid fa-shield-xmark text-3xl" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              <i className="fa-solid fa-lock mr-1" /> ป้องกันการเข้าถึงจากภายนอก
            </span>
            <h1 className="text-xl font-bold text-slate-900 mt-3">
              ไม่สามารถเข้าถึงจากภายนอกได้
            </h1>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              หน้านี้สงวนสิทธิ์สำหรับผู้ปกครอง โดยกรุณากดเข้าใช้งานผ่านเมนู{" "}
              <strong className="text-emerald-700">(Rich Menu)</strong> ภายในแอปพลิเคชัน LINE เท่านั้น
            </p>
          </div>

          {/* QR Code Section */}
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center space-y-3">
            <p className="text-xs font-semibold text-slate-700">สแกน QR Code เพื่อเปิดผ่าน LINE</p>
            <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200">
              <QRCodeSVG value={lineOaUrl} size={160} />
            </div>
            <p className="text-[11px] text-slate-500">LINE Official Account โรงเรียน</p>
          </div>

          <div className="space-y-2">
            <a
              href="https://line.me/R/"
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2"
            >
              <i className="fa-brands fa-line text-lg" /> เปิดแอปพลิเคชัน LINE
            </a>
            <a
              href="/parent-liff?source=richmenu&dev=true"
              className="text-xs text-slate-400 hover:text-slate-600 block py-1"
            >
              [โหมดทดสอบสำหรับผู้ดูแลระบบ / Dev Preview]
            </a>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MAIN PARENT PORTAL (Mobile-First & Elderly-Friendly)
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 pb-16 font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-lg mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {lineProfile?.pictureUrl ? (
              <img
                src={lineProfile.pictureUrl}
                alt={lineProfile.displayName}
                className="w-10 h-10 rounded-full border-2 border-emerald-500 object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                <i className="fa-solid fa-user" />
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500 leading-tight">สมุดพกออนไลน์ผู้ปกครอง</p>
              <h2 className="text-sm font-bold text-slate-900 truncate max-w-[180px]">
                {lineProfile?.displayName || "ท่านผู้ปกครอง"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <i className="fa-brands fa-line text-sm" /> LINE
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {loadingStudent ? (
          <div className="p-16 text-center text-slate-400 space-y-3">
            <i className="fa-solid fa-circle-notch fa-spin text-3xl text-emerald-600 block mx-auto" />
            <p className="text-sm font-medium">กำลังโหลดข้อมูลนักเรียน...</p>
          </div>
        ) : isChangingStudent || !currentSummary ? (
          /* ========================================================================= */
          /* SEARCH & LINK STUDENT VIEW                                                */
          /* ========================================================================= */
          <div className="space-y-4 animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-2 text-xl shadow-inner">
                  <i className="fa-solid fa-magnifying-glass" />
                </div>
                <h1 className="text-xl font-bold text-slate-900">ค้นหาบุตรหลานของท่าน</h1>
                <p className="text-xs text-slate-500 leading-relaxed">
                  พิมพ์เฉพาะ <strong className="text-emerald-700">ชื่อจริง (ไม่ต้องใส่นามสกุล)</strong> หรือ{" "}
                  <strong className="text-emerald-700">รหัสนักเรียน</strong>
                </p>
              </div>

              {/* Big Search Input */}
              <form onSubmit={handleSearch} className="space-y-3 pt-2">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="เช่น สมชาย หรือ 67105"
                    className="w-full px-4 py-3.5 text-base rounded-2xl border-2 border-slate-200 focus:border-emerald-600 focus:outline-none bg-slate-50 font-medium placeholder:text-slate-400 text-slate-900"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 p-1"
                    >
                      <i className="fa-solid fa-circle-xmark text-lg" />
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={searching}
                  className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base transition shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {searching ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin" />
                      กำลังค้นหา...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-search" />
                      ค้นหานักเรียน
                    </>
                  )}
                </button>
              </form>

              {/* If previously linked student exists, allow cancel */}
              {currentSummary && (
                <button
                  type="button"
                  onClick={() => setIsChangingStudent(false)}
                  className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-800 font-semibold text-center block transition"
                >
                  <i className="fa-solid fa-arrow-left mr-1" /> กลับไปดู {currentSummary.fullName}
                </button>
              )}
            </div>

            {/* Searching Indicator */}
            {searching && (
              <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-2 animate-pulse">
                <i className="fa-solid fa-circle-notch fa-spin text-3xl text-emerald-600 block mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-800">กำลังค้นหาข้อมูลนักเรียน...</p>
                <p className="text-xs text-slate-500">โปรดรอสักครู่ ระบบกำลังดึงข้อมูล</p>
              </div>
            )}

            {/* Search Results */}
            {!searching && hasSearched && (
              <div className="space-y-3 animate-in fade-in">
                <p className="text-xs font-semibold text-slate-500 px-1">
                  ผลการค้นหา ({searchResults.length} คน)
                </p>

                {searchResults.length === 0 ? (
                  <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-2">
                    <i className="fa-solid fa-user-xmark text-3xl text-slate-300 block mx-auto" />
                    <p className="text-sm font-semibold text-slate-800">ไม่พบข้อมูลนักเรียน</p>
                    <p className="text-xs text-slate-500">
                      กรุณาตรวจสอบชื่อจริง หรือลองค้นหาด้วยรหัสนักเรียน 5 หลัก
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {searchResults.map((std) => (
                      <div
                        key={std.id}
                        className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center justify-between gap-3 hover:border-emerald-500 transition"
                      >
                        <div className="space-y-1">
                          <p className="text-base font-bold text-slate-900 leading-tight">
                            {std.fullName || std.displayName}
                          </p>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              รหัส: {std.studentId}
                            </span>
                            <span className="text-slate-500">
                              {std.gradeLevel || "มัธยมศึกษา"}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={linkingStudentId === std.id}
                          onClick={() => handleSelectStudent(std)}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm flex items-center gap-1.5 shrink-0 disabled:opacity-60"
                        >
                          {linkingStudentId === std.id ? (
                            <i className="fa-solid fa-circle-notch fa-spin" />
                          ) : (
                            <>
                              <i className="fa-solid fa-check" />
                              เลือกคนนี้
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* STUDENT OVERVIEW & ALL-IN-ONE REPORT VIEW                                 */
          /* ========================================================================= */
          <div className="space-y-4 animate-in fade-in">
            {/* Student Info Card */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    นักเรียนที่ผูกไว้
                  </span>
                  <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">
                    {currentSummary.fullName}
                  </h1>
                </div>

                <button
                  onClick={() => setIsChangingStudent(true)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-600 transition flex items-center gap-1 shrink-0"
                >
                  <i className="fa-solid fa-repeat" /> เปลี่ยนคน
                </button>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
                  รหัสนักเรียน: {currentSummary.studentId}
                </span>
                <span className="text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                  ชั้น: {currentSummary.gradeLevel || "มัธยมศึกษา"}
                </span>
                {currentSummary.gpa !== undefined && (
                  <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    GPA: {Number(currentSummary.gpa).toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            {/* Today's Status Box (High Prominence) */}
            <div
              className={`rounded-3xl p-5 border-2 shadow-sm space-y-1 ${
                currentSummary.todayAttendance.status === "present"
                  ? "bg-emerald-50/80 border-emerald-400 text-emerald-950"
                  : currentSummary.todayAttendance.status === "late"
                  ? "bg-amber-50/80 border-amber-400 text-amber-950"
                  : currentSummary.todayAttendance.status === "excused"
                  ? "bg-sky-50/80 border-sky-400 text-sky-950"
                  : currentSummary.todayAttendance.status === "absent"
                  ? "bg-rose-50/80 border-rose-400 text-rose-950"
                  : "bg-slate-50 border-slate-300 text-slate-800"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider opacity-70">
                  สถานะการเข้าเรียนวันนี้
                </p>
                <span className="text-xs opacity-70 font-mono">
                  {new Date().toLocaleDateString("th-TH", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>

              <p className="text-2xl font-black tracking-tight pt-1">
                {currentSummary.todayAttendance.status === "present" && "🟢 วันนี้: มาเรียนปกติ"}
                {currentSummary.todayAttendance.status === "late" && "🟡 วันนี้: มาสาย"}
                {currentSummary.todayAttendance.status === "excused" && "🔵 วันนี้: ลา (มีใบลา)"}
                {currentSummary.todayAttendance.status === "absent" && "🔴 วันนี้: ขาดเรียน"}
                {currentSummary.todayAttendance.status === "none" && "⚪ ยังไม่มีบันทึกการเช็กชื่อวันนี้"}
              </p>

              <p className="text-xs opacity-80 pt-0.5">
                {currentSummary.todayAttendance.time
                  ? `เช็กชื่อเวลา: ${currentSummary.todayAttendance.time}`
                  : currentSummary.todayAttendance.status === "none"
                  ? "รอคุณครูประจำวิชาบันทึกข้อมูล"
                  : "บันทึกในระบบเรียบร้อย"}
              </p>
            </div>

            {/* Attendance Accumulation Statistics */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <i className="fa-solid fa-chart-pie text-emerald-600" />
                  สถิติการเข้าเรียนสะสม
                </h3>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  รวม {currentSummary.attendanceStats.rate}%
                </span>
              </div>

              {/* 4 Large Number Cards */}
              <div className="grid grid-cols-4 gap-2 text-center pt-1">
                <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                  <p className="text-2xl font-black text-emerald-700">
                    {currentSummary.attendanceStats.present}
                  </p>
                  <p className="text-xs font-semibold text-emerald-900 mt-0.5">มาเรียน</p>
                </div>

                <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-100">
                  <p className="text-2xl font-black text-amber-600">
                    {currentSummary.attendanceStats.late}
                  </p>
                  <p className="text-xs font-semibold text-amber-900 mt-0.5">มาสาย</p>
                </div>

                <div className="p-3 rounded-2xl bg-sky-50/70 border border-sky-100">
                  <p className="text-2xl font-black text-sky-600">
                    {currentSummary.attendanceStats.excused}
                  </p>
                  <p className="text-xs font-semibold text-sky-900 mt-0.5">ลา</p>
                </div>

                <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-100">
                  <p className="text-2xl font-black text-rose-600">
                    {currentSummary.attendanceStats.absent}
                  </p>
                  <p className="text-xs font-semibold text-rose-900 mt-0.5">ขาด</p>
                </div>
              </div>
            </div>

            {/* Academic Grades Section */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <i className="fa-solid fa-graduation-cap text-emerald-600" />
                  ผลการเรียนรายวิชา
                </h3>
                {currentSummary.gpa !== undefined && (
                  <span className="text-xs font-bold text-slate-700 font-mono">
                    เกรดเฉลี่ย: {Number(currentSummary.gpa).toFixed(2)}
                  </span>
                )}
              </div>

              {currentSummary.grades.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">ยังไม่มีข้อมูลเกรด</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {currentSummary.grades.map((g, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="flex-1 pr-2">
                        <p className="font-bold text-slate-900 text-sm">{g.subjectName}</p>
                        <p className="text-slate-400 text-[11px]">คะแนน: {g.score}/{g.maxScore}</p>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-sm border border-emerald-200">
                          เกรด {g.grade}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Change Student or Web View Action */}
            <div className="pt-2 space-y-2">
              {currentSummary.parentViewToken && (
                <a
                  href={`/parent-view?token=${currentSummary.parentViewToken}`}
                  className="w-full py-3.5 px-4 rounded-2xl bg-white border border-slate-300 text-slate-800 font-bold text-sm hover:bg-slate-50 transition flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-globe text-emerald-600" /> เปิดดูสมุดพกออนไลน์เต็มรูปแบบ
                </a>
              )}

              <button
                type="button"
                onClick={() => setIsChangingStudent(true)}
                className="w-full py-3 px-4 rounded-2xl text-slate-500 hover:text-slate-800 font-semibold text-xs transition text-center"
              >
                <i className="fa-solid fa-magnifying-glass mr-1" /> ค้นหาหรือเปลี่ยนไปดูบุตรหลานคนอื่น
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
