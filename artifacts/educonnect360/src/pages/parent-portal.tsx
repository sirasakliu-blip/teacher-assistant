import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  getParentStudentData,
  linkStudentToParent,
  getLeaveRequestsForStudent,
} from "@/lib/firestore";
import type { SubmissionStatus, User, LeaveRequest } from "@/types";
import { LeaveRequestModal } from "@/components/leave-request-modal";
import { LeaveDocumentModal } from "@/components/leave-document-modal";

const STATUS_META: Record<SubmissionStatus, { label: string; className: string; icon: string }> = {
  submitted: { label: "ส่งแล้ว", className: "bg-emerald-500/10 text-emerald-600", icon: "fa-circle-check" },
  late: { label: "ส่งช้า", className: "bg-amber-500/10 text-amber-600", icon: "fa-triangle-exclamation" },
  missing: { label: "ยังไม่ส่ง", className: "bg-red-500/10 text-red-600", icon: "fa-circle-xmark" },
  pending: { label: "รอส่ง", className: "bg-muted text-muted-foreground", icon: "fa-hourglass-half" },
};

export default function ParentPortal() {
  const { profile, logout } = useAuth();
  const { toast } = useToast();

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentData, setStudentData] = useState<Awaited<ReturnType<typeof getParentStudentData>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [studentEmailInput, setStudentEmailInput] = useState("");
  const [linking, setLinking] = useState(false);

  // Leave Requests state
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [showCreateLeave, setShowCreateLeave] = useState(false);
  const [viewingLeave, setViewingLeave] = useState<LeaveRequest | null>(null);

  const linkedIds = profile?.linkedStudentIds ?? [];

  useEffect(() => {
    if (linkedIds.length > 0 && !selectedStudentId) {
      setSelectedStudentId(linkedIds[0]);
    } else if (linkedIds.length === 0) {
      setLoading(false);
    }
  }, [linkedIds, selectedStudentId]);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      if (!selectedStudentId) {
        setStudentData(null);
        setLeaveRequests([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [data, leaves] = await Promise.all([
          getParentStudentData(selectedStudentId),
          getLeaveRequestsForStudent(selectedStudentId),
        ]);
        if (!cancelled) {
          setStudentData(data);
          setLeaveRequests(leaves);
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            variant: "destructive",
            title: "โหลดข้อมูลบุตรหลานไม่สำเร็จ",
            description: err instanceof Error ? err.message : undefined,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [selectedStudentId, toast]);

  async function handleLinkStudent(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setLinking(true);
    try {
      const student = await linkStudentToParent(profile.id, studentEmailInput);
      toast({
        title: "เชื่อมโยงบุตรหลานสำเร็จ",
        description: `เชื่อมโยงกับ ${student.displayName} เรียบร้อยแล้ว`,
      });
      setShowLinkModal(false);
      setStudentEmailInput("");
      setSelectedStudentId(student.id);
      window.location.reload();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "เชื่อมโยงไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background relative overflow-hidden font-sans">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[55%] h-[55%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Navigation */}
      <nav className="w-full px-6 md:px-10 py-5 flex items-center justify-between relative z-10 glass-panel border-x-0 border-t-0 rounded-none">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
            <i className="fa-solid fa-graduation-cap text-lg" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">
            EduConnect<span className="text-primary font-extrabold">360</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden sm:flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <i className="fa-solid fa-people-roof text-primary" /> ผู้ปกครอง: {profile?.displayName}
          </span>
          <button
            onClick={() => setShowLinkModal(true)}
            className="px-3.5 py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-all flex items-center gap-1.5"
          >
            <i className="fa-solid fa-user-plus" /> เชื่อมต่อบุตรหลาน
          </button>
          <button
            onClick={logout}
            className="px-4 py-2 rounded-lg glass-panel text-sm font-semibold text-foreground hover:bg-white/60 dark:hover:bg-black/20 transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-right-from-bracket" /> ออกจากระบบ
          </button>
        </div>
      </nav>

      <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Child Selector Tabs if multiple linked */}
        {linkedIds.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <span className="text-xs font-semibold text-muted-foreground mr-1">เลือกบุตรหลาน:</span>
            {linkedIds.map((id, index) => (
              <button
                key={id}
                onClick={() => setSelectedStudentId(id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedStudentId === id
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "glass-panel text-muted-foreground hover:text-foreground"
                }`}
              >
                นักเรียนคนที่ {index + 1}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-3">
            <i className="fa-solid fa-circle-notch fa-spin text-primary text-2xl" />
            <span>กำลังโหลดข้อมูลบุตรหลาน...</span>
          </div>
        ) : !selectedStudentId || !studentData ? (
          /* Empty state: No child linked yet */
          <div className="glass-panel rounded-3xl p-10 text-center animate-fade-in-up">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-3xl mb-4">
              <i className="fa-solid fa-child" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">ยังไม่ได้เชื่อมต่อข้อมูลบุตรหลาน</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              กรอกอีเมลที่บุตรหลานใช้ลงทะเบียนในระบบเพื่อเริ่มติดตามการเข้าเรียนและการบ้านแบบเรียลไทม์
            </p>
            <button
              onClick={() => setShowLinkModal(true)}
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/25"
            >
              <i className="fa-solid fa-plus mr-2" /> เชื่อมต่อบัญชีบุตรหลาน
            </button>
          </div>
        ) : (
          <>
            {/* Child profile card */}
            <section className="glass-panel rounded-3xl p-6 sm:p-8 animate-fade-in-up">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl sm:text-3xl font-extrabold shadow-lg shadow-primary/20">
                  {studentData.student?.displayName ? studentData.student.displayName.slice(0, 1) : "น"}
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-extrabold text-foreground truncate">
                    {studentData.student?.displayName}
                  </h1>
                  <p className="text-sm text-muted-foreground">{studentData.student?.email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ลงทะเบียนเรียน {studentData.classes.length} วิชา
                  </p>
                </div>
              </div>

              {/* Today Attendance Banner */}
              {studentData.todayAttendance ? (
                <div className="mt-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 text-emerald-700">
                  <i className="fa-solid fa-circle-check text-lg" />
                  <p className="text-sm font-semibold">
                    เข้าเรียนเรียบร้อยวันนี้ &middot; บันทึกเวลา{" "}
                    {new Date(studentData.todayAttendance.checkedInAt).toLocaleTimeString("th-TH", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    น.
                  </p>
                </div>
              ) : (
                <div className="mt-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 text-amber-700">
                  <i className="fa-solid fa-hourglass-half text-lg" />
                  <p className="text-sm font-semibold">
                    ยังไม่มีการบันทึกการเข้าเรียนในวันนี้
                  </p>
                </div>
              )}
            </section>

            {/* Overview stats */}
            <section className="grid grid-cols-2 gap-4 animate-fade-in-up" style={{ animationDelay: "80ms" }}>
              <div className="glass-panel rounded-2xl p-5 sm:p-6 text-center">
                <div className="w-11 h-11 mx-auto rounded-xl bg-primary/10 flex items-center justify-center text-primary text-lg mb-3">
                  <i className="fa-solid fa-calendar-check" />
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-foreground">
                  {studentData.attendanceRate}%
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  อัตราการเข้าเรียนรวม
                </p>
              </div>
              <div className="glass-panel rounded-2xl p-5 sm:p-6 text-center">
                <div className="w-11 h-11 mx-auto rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600 text-lg mb-3">
                  <i className="fa-solid fa-book-open" />
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-foreground">
                  {studentData.classes.length}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  วิชาที่กำลังศึกษา
                </p>
              </div>
            </section>

            {/* Real AI Early Warning */}
            <section
              className="rounded-3xl p-6 sm:p-8 relative overflow-hidden animate-fade-in-up bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-xl shadow-primary/20"
              style={{ animationDelay: "160ms" }}
            >
              <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
              <div className="relative flex items-start gap-4">
                <div className="w-11 h-11 shrink-0 rounded-xl bg-white/15 flex items-center justify-center text-lg">
                  <i className="fa-solid fa-wand-magic-sparkles" />
                </div>
                <div>
                  <h3 className="font-bold mb-1.5 flex items-center gap-2">
                    สรุปวิเคราะห์โดย AI
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 tracking-wide">
                      INSIGHT
                    </span>
                  </h3>
                  <p className="text-sm leading-relaxed text-white/95">{studentData.aiInsight}</p>
                </div>
              </div>
            </section>

            {/* Real Homework tracker */}
            <section className="glass-panel rounded-3xl p-6 sm:p-8 animate-fade-in-up" style={{ animationDelay: "240ms" }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">ติดตามการบ้าน</h3>
                  <p className="text-sm text-muted-foreground">รายการงานจากทุกวิชาที่ครูผู้สอนมอบหมาย</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                  {studentData.homeworkList.length} งาน
                </span>
              </div>

              {studentData.homeworkList.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  <i className="fa-solid fa-file-circle-check text-2xl text-primary/40 mb-2 block" />
                  ยังไม่มีการบ้านที่ได้รับมอบหมาย
                </div>
              ) : (
                <ul className="space-y-3">
                  {studentData.homeworkList.map((hw) => {
                    const meta = STATUS_META[hw.status];
                    return (
                      <li
                        key={hw.id}
                        className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl bg-background/50 border border-border/60"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{hw.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {hw.className} &middot; กำหนดส่ง {hw.dueDate}
                            {hw.submission?.score !== null && hw.submission?.score !== undefined && (
                              <span className="text-primary font-bold ml-1">
                                &middot; ได้ {hw.submission.score}/{hw.maxScore} คะแนน
                              </span>
                            )}
                          </p>
                        </div>
                        <span className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${meta.className}`}>
                          <i className={`fa-solid ${meta.icon}`} /> {meta.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Leave Requests section (หนังสือใบลา) */}
            <section className="glass-panel rounded-3xl p-6 sm:p-8 animate-fade-in-up" style={{ animationDelay: "280ms" }}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <i className="fa-solid fa-file-signature text-primary" />
                    หนังสือใบลาของบุตรหลาน
                  </h3>
                  <p className="text-sm text-muted-foreground">ยื่นหนังสือลา (TH Sarabun PSK) แจ้งครูประจำชั้นและครูผู้สอน</p>
                </div>
                <button
                  onClick={() => setShowCreateLeave(true)}
                  className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-md shadow-primary/20 shrink-0 self-start sm:self-auto"
                >
                  <i className="fa-solid fa-plus" /> ยื่นใบลาให้บุตรหลาน
                </button>
              </div>

              {leaveRequests.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  <i className="fa-solid fa-folder-open text-2xl text-primary/40 mb-2 block" />
                  ยังไม่มีประวัติการยื่นใบลาสำหรับบุตรหลานคนนี้
                </div>
              ) : (
                <div className="space-y-3">
                  {leaveRequests.map((leave) => {
                    const isSick = leave.type === "sick";
                    return (
                      <div
                        key={leave.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 rounded-xl bg-background/50 border border-border/60"
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
                            เรียน ครูที่ปรึกษา: {leave.advisorName || "-"} &middot; ยื่นโดย: {leave.parentName || "ผู้ปกครอง"}
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
                  })}
                </div>
              )}
            </section>

            {/* Classes enrolled */}
            <section className="glass-panel rounded-3xl p-6 sm:p-8 animate-fade-in-up" style={{ animationDelay: "320ms" }}>
              <h3 className="text-lg font-bold text-foreground mb-4">ห้องเรียนของบุตรหลาน</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {studentData.classes.map((c) => (
                  <div key={c.id} className="p-4 rounded-xl bg-background/50 border border-border/60 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.gradeLevel} &middot; ครู{c.teacherName}</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-primary px-2 py-1 rounded bg-primary/10">
                      {c.joinCode}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {/* Link Child Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-fade-in-up">
          <div className="rounded-3xl p-6 sm:p-8 w-full max-w-md bg-card text-card-foreground border border-border shadow-2xl relative z-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">เชื่อมต่อบัญชีบุตรหลาน</h2>
              <button
                onClick={() => setShowLinkModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <form onSubmit={handleLinkStudent} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  อีเมลของนักเรียน
                </label>
                <input
                  type="email"
                  required
                  value={studentEmailInput}
                  onChange={(e) => setStudentEmailInput(e.target.value)}
                  placeholder="student@school.ac.th"
                  className="w-full px-4 py-3 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring text-foreground text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  ระบุอีเมลที่บุตรหลานใช้สมัครสมาชิกในระบบ EduConnect360
                </p>
              </div>
              <button
                type="submit"
                disabled={linking || !studentEmailInput.trim()}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
              >
                {linking ? <i className="fa-solid fa-circle-notch fa-spin" /> : "ยืนยันการเชื่อมต่อ"}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Leave Request modal for Parent */}
      {showCreateLeave && profile && studentData?.student && (
        <LeaveRequestModal
          user={profile}
          submittedByRole="parent"
          defaultStudentName={studentData.student.displayName}
          defaultStudentId={studentData.student.id}
          onClose={() => setShowCreateLeave(false)}
          onCreated={(newLeave) => {
            setLeaveRequests((prev) => [newLeave, ...prev]);
            setShowCreateLeave(false);
            setViewingLeave(newLeave);
          }}
        />
      )}

      {/* Leave Document modal (TH Sarabun PSK) */}
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
