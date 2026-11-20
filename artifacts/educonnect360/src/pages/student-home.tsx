import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  getClassesForStudent,
  joinClassByCode,
  getLeaveRequestsForStudent,
  resetParentViewToken,
  createParentViewTokenDoc,
} from "@/lib/firestore";
import { coverGradient } from "@/lib/covers";
import type { Class, LeaveRequest } from "@/types";
import { LeaveRequestModal } from "@/components/leave-request-modal";
import { LeaveDocumentModal } from "@/components/leave-document-modal";

export default function StudentHome() {
  const { profile, logout } = useAuth();
  const { toast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showJoin, setShowJoin] = useState(false);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);

  // Leave Requests state
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [showLeaveList, setShowLeaveList] = useState(false);
  const [showCreateLeave, setShowCreateLeave] = useState(false);
  const [viewingLeave, setViewingLeave] = useState<LeaveRequest | null>(null);

  // Parent Magic Link state
  const [currentToken, setCurrentToken] = useState<string>(profile?.parentViewToken || "");
  const [resettingToken, setResettingToken] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (profile?.parentViewToken) {
      setCurrentToken(profile.parentViewToken);
    } else if (profile && !profile.parentViewToken && profile.role === "student") {
      createParentViewTokenDoc(
        profile.id,
        profile.studentId || "",
        profile.displayName || "นักเรียน",
      ).then((newToken) => setCurrentToken(newToken));
    }
  }, [profile]);

  function getParentViewUrl() {
    return `${window.location.origin}/parent-view?token=${currentToken}`;
  }

  function handleShareLine() {
    const url = getParentViewUrl();
    const text = `ติดตามผลการเรียนและการเข้าเรียนของ ${profile?.displayName || "นักเรียน"} ได้ที่นี่: ${url}`;
    window.open(`https://line.me/R/msg/text/?${encodeURIComponent(text)}`, "_blank");
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(getParentViewUrl());
      setCopiedLink(true);
      toast({
        title: "คัดลอกลิงก์สำเร็จ",
        description: "สามารถส่งลิงก์ให้ผู้ปกครองทางแชทหรือ LINE ได้ทันที",
      });
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast({ variant: "destructive", title: "ไม่สามารถคัดลอกได้" });
    }
  }

  async function handleResetToken() {
    if (!profile) return;
    if (
      !confirm(
        "ต้องการยกเลิกลิงก์เดิมและสร้างลิงก์ใหม่หรือไม่? ผู้ปกครองที่ใช้ลิงก์เดิมจะไม่สามารถเปิดดูได้อีกต่อไป",
      )
    )
      return;

    setResettingToken(true);
    try {
      const newToken = await resetParentViewToken(profile.id);
      setCurrentToken(newToken);
      toast({
        title: "สร้างลิงก์ใหม่สำเร็จ",
        description: "ระบบได้ยกเลิกลิงก์เดิมและสร้างลิงก์ใหม่ให้เรียบร้อยแล้ว",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "สร้างลิงก์ใหม่ไม่สำเร็จ",
        description: err instanceof Error ? err.message : "เกิดข้อผิดพลาด",
      });
    } finally {
      setResettingToken(false);
    }
  }

  async function loadLeaves() {
    if (!profile) return;
    try {
      const list = await getLeaveRequestsForStudent(profile.id);
      setLeaveRequests(list);
    } catch (err) {
      console.error("Failed to load leaves:", err);
    }
  }

  async function refresh() {
    if (!profile) return;
    setLoading(true);
    try {
      const list = await getClassesForStudent(profile.id);
      setClasses(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      await loadLeaves();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "โหลดข้อมูลห้องเรียนไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setJoining(true);
    try {
      await joinClassByCode(code, profile.id);
      toast({ title: "เข้าร่วมห้องเรียนสำเร็จ" });
      setCode("");
      setShowJoin(false);
      refresh();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "เข้าร่วมห้องเรียนไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background relative overflow-hidden font-sans">
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[55%] h-[55%] bg-teal-500/5 rounded-full blur-[120px] pointer-events-none" />

      <nav className="w-full px-6 md:px-10 py-5 flex items-center justify-between relative z-10 glass-panel border-x-0 border-t-0 rounded-none">
        <Link href="/student" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
            <i className="fa-solid fa-graduation-cap text-lg" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">
            EduConnect<span className="text-primary font-extrabold">360</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2.5 text-sm font-medium text-muted-foreground glass-panel px-3.5 py-1.5 rounded-xl border border-border/60">
            <i className="fa-solid fa-user-graduate text-primary" />
            <span className="font-semibold text-foreground">{profile?.displayName}</span>
            {profile?.studentId && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono font-bold border border-primary/20">
                รหัส: {profile.studentId}
              </span>
            )}
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 rounded-lg glass-panel text-sm font-semibold text-foreground hover:bg-white/60 dark:hover:bg-black/20 transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-right-from-bracket" /> ออกจากระบบ
          </button>
        </div>
      </nav>

      <main className="relative z-10 max-w-6xl mx-auto px-6 md:px-10 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 animate-fade-in-up">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold text-foreground">ห้องเรียนของฉัน</h1>
              {profile?.studentId && (
                <span className="text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-mono font-bold border border-primary/20">
                  รหัสนักเรียน: {profile.studentId}
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              ยินดีต้อนรับ {profile?.displayName} &middot; เข้าร่วมห้องเรียน เช็คชื่อเข้าเรียน และส่งหนังสือใบลา
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowLeaveList(true)}
              className="px-4 py-3 rounded-xl glass-panel text-foreground font-semibold text-sm hover:bg-white/60 dark:hover:bg-black/20 transition-all flex items-center gap-2 border border-border"
            >
              <i className="fa-solid fa-file-signature text-primary" />
              <span>หนังสือใบลา</span>
              {leaveRequests.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                  {leaveRequests.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowJoin(true)}
              className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all duration-300 shadow-lg shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
            >
              <i className="fa-solid fa-key" /> เข้าร่วมด้วยรหัส
            </button>
          </div>
        </div>

        {/* Parent Magic Link Card */}
        <div className="glass-panel p-6 rounded-3xl border border-white/40 dark:border-white/10 mb-8 animate-fade-in-up bg-gradient-to-r from-emerald-500/5 via-primary/5 to-teal-500/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl shrink-0">
                <i className="fa-solid fa-people-roof" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  ลิงก์ติดตามผลสำหรับผู้ปกครอง (Parent Magic Link)
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                    ไม่ต้องล็อกอิน
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  แชร์ลิงก์นี้ให้ผู้ปกครอง เพื่อดูสถิติการเข้าเรียนและสถานะใบลาแบบเรียลไทม์ผ่านมือถือได้ทันที
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleShareLine}
                className="px-3.5 py-2 rounded-xl bg-[#06C755] text-white hover:bg-[#05b34c] transition-all text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <i className="fa-brands fa-line text-base" /> แชร์ผ่าน LINE
              </button>

              <button
                onClick={handleCopyLink}
                className="px-3.5 py-2 rounded-xl bg-primary/15 text-primary hover:bg-primary/25 transition-all text-xs font-semibold flex items-center gap-1.5"
              >
                <i className={copiedLink ? "fa-solid fa-check text-emerald-500" : "fa-regular fa-copy"} />
                {copiedLink ? "คัดลอกแล้ว!" : "คัดลอกลิงก์"}
              </button>

              <button
                onClick={handleResetToken}
                disabled={resettingToken}
                className="px-3.5 py-2 rounded-xl glass-panel text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all text-xs font-semibold flex items-center gap-1.5 border border-border"
                title="ยกเลิกลิงก์เดิมและสร้างลิงก์ใหม่"
              >
                <i className={`fa-solid fa-arrows-rotate ${resettingToken ? "fa-spin" : ""}`} />
                สร้างลิงก์ใหม่ (รีเซ็ต)
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <i className="fa-solid fa-circle-notch fa-spin text-primary" /> กำลังโหลด...
          </div>
        ) : classes.length === 0 ? (
          <div className="glass-panel rounded-3xl p-16 text-center animate-fade-in-up">
            <i className="fa-solid fa-door-open text-4xl text-primary/50 mb-4" />
            <h3 className="text-xl font-bold text-foreground mb-2">ยังไม่ได้เข้าร่วมห้องเรียน</h3>
            <p className="text-muted-foreground mb-6">
              ขอรหัสห้องเรียน 6 หลักจากครูผู้สอนเพื่อเข้าร่วม
            </p>
            <button
              onClick={() => setShowJoin(true)}
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all"
            >
              เข้าร่วมห้องเรียน
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((cls, idx) => (
              <Link
                key={cls.id}
                href={`/student/classes/${cls.id}`}
                className="glass-panel rounded-3xl overflow-hidden group hover:-translate-y-1.5 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 animate-fade-in-up"
                style={{ animationDelay: `${idx * 80}ms`, animationFillMode: "both" } as React.CSSProperties}
              >
                <div className={`h-24 w-full bg-gradient-to-br ${coverGradient(cls.cover)} relative`}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <i className="fa-solid fa-book text-3xl text-white/90" />
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-bold text-foreground mb-1">{cls.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{cls.gradeLevel}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <i className="fa-solid fa-chalkboard-user text-primary/70" /> {cls.teacherName}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-fade-in-up">
          <div className="glass-panel rounded-3xl p-8 w-full max-w-md bg-card/95">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">เข้าร่วมห้องเรียน</h2>
              <button
                onClick={() => setShowJoin(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <form onSubmit={handleJoin} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  รหัสเข้าห้อง 6 หลัก
                </label>
                <input
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="w-full px-4 py-3 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring text-foreground text-center text-2xl tracking-[0.5em] font-mono font-bold"
                />
              </div>
              <button
                type="submit"
                disabled={joining || code.length !== 6}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {joining ? <i className="fa-solid fa-circle-notch fa-spin" /> : "เข้าร่วมห้องเรียน"}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Modal ยื่นใบลา / รายการใบลาของนักเรียน */}
      {showLeaveList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm animate-fade-in-up">
          <div className="bg-card w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-border max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-lg">
                  <i className="fa-solid fa-file-signature" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">หนังสือใบลาของฉัน</h2>
                  <p className="text-xs text-muted-foreground">แบบฟอร์มใบลามาตรฐาน TH Sarabun PSK</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCreateLeave(true)}
                  className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <i className="fa-solid fa-plus" /> ยื่นใบลาใหม่
                </button>
                <button
                  onClick={() => setShowLeaveList(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {leaveRequests.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <i className="fa-solid fa-folder-open text-4xl text-primary/30 mb-3 block" />
                  <p className="font-semibold text-foreground">ยังไม่มีประวัติการยื่นใบลา</p>
                  <p className="text-xs mt-1">สามารถกดปุ่ม "ยื่นใบลาใหม่" เพื่อส่งหนังสือลาให้ครูที่ปรึกษาและครูผู้สอน</p>
                </div>
              ) : (
                leaveRequests.map((leave) => {
                  const isSick = leave.type === "sick";
                  return (
                    <div
                      key={leave.id}
                      className="p-4 rounded-2xl bg-background/60 border border-border hover:border-primary/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              isSick ? "bg-amber-500/10 text-amber-700" : "bg-blue-500/10 text-blue-700"
                            }`}
                          >
                            {isSick ? "ลาป่วย" : "ลากิจ"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {leave.startDate} ถึง {leave.endDate} ({leave.daysCount} วัน)
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-foreground truncate">{leave.reason}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          เรียน ครูที่ปรึกษา: {leave.advisorName || "-"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            leave.status === "approved"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : leave.status === "rejected"
                              ? "bg-red-500/10 text-red-600"
                              : "bg-amber-500/10 text-amber-600"
                          }`}
                        >
                          {leave.status === "approved"
                            ? "อนุมัติแล้ว"
                            : leave.status === "rejected"
                            ? "ไม่อนุมัติ"
                            : "รอการอนุมัติ"}
                        </span>
                        <button
                          onClick={() => setViewingLeave(leave)}
                          className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-all flex items-center gap-1"
                        >
                          <i className="fa-solid fa-print" /> ดู/พิมพ์ใบลา
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal สร้างใบลาใหม่ */}
      {showCreateLeave && profile && (
        <LeaveRequestModal
          user={profile}
          submittedByRole="student"
          onClose={() => setShowCreateLeave(false)}
          onCreated={(newLeave) => {
            setLeaveRequests((prev) => [newLeave, ...prev]);
            setShowCreateLeave(false);
            setViewingLeave(newLeave);
          }}
        />
      )}

      {/* Modal ดู/พิมพ์เอกสาร TH Sarabun PSK */}
      {viewingLeave && (
        <LeaveDocumentModal
          leave={viewingLeave}
          initialFormat="student"
          onClose={() => setViewingLeave(null)}
          canManage={false}
        />
      )}
    </div>
  );
}
