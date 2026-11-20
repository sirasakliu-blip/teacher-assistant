import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { TeacherInvite } from "@/types";
import {
  createTeacherInvite,
  deleteTeacherInvite,
  subscribeTeacherInvites,
  updateUserRole,
} from "@/lib/firestore";

export default function AdminDashboard() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [invites, setInvites] = useState<TeacherInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [latestCode, setLatestCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "unused" | "used">("all");
  const [deletingCode, setDeletingCode] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeTeacherInvites((list) => {
      setInvites(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const newInvite = await createTeacherInvite({
        note: note.trim() || undefined,
        createdByUid: profile?.uid,
        createdByName: profile?.displayName,
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
      setCreating(false);
    }
  }

  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast({
        title: "คัดลอกรหัสแล้ว",
        description: `คัดลอก ${code} ไปยังคลิปบอร์ดแล้ว`,
      });
      setTimeout(() => setCopiedCode(null), 2500);
    } catch {
      toast({
        variant: "destructive",
        title: "ไม่สามารถคัดลอกได้",
        description: "กรุณาคัดลอกรหัสด้วยตนเอง",
      });
    }
  }

  async function handleDelete(code: string) {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบรหัส ${code} นี้?`)) return;
    setDeletingCode(code);
    try {
      await deleteTeacherInvite(code);
      toast({
        title: "ลบรหัสสำเร็จ",
        description: `รหัส ${code} ถูกลบออกจากระบบแล้ว`,
      });
      if (latestCode === code) setLatestCode(null);
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

  async function handleMakeMeAdmin() {
    if (!profile?.uid) return;
    try {
      await updateUserRole(profile.uid, "admin");
      toast({
        title: "ปรับสิทธิ์สำเร็จ",
        description: "บัญชีของคุณได้รับการตั้งค่าเป็น ผู้ดูแลระบบ (Admin) แล้ว",
      });
      window.location.reload();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "ปรับสิทธิ์ไม่สำเร็จ",
        description: err instanceof Error ? err.message : "เกิดข้อผิดพลาด",
      });
    }
  }

  const filteredInvites = invites.filter((inv) => {
    const matchesSearch =
      inv.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.note && inv.note.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (inv.usedByName && inv.usedByName.toLowerCase().includes(searchTerm.toLowerCase()));

    if (filterStatus === "unused") return matchesSearch && !inv.isUsed;
    if (filterStatus === "used") return matchesSearch && inv.isUsed;
    return matchesSearch;
  });

  const unusedCount = invites.filter((i) => !i.isUsed).length;
  const usedCount = invites.filter((i) => i.isUsed).length;

  return (
    <div className="min-h-[100dvh] w-full bg-background relative overflow-hidden flex flex-col font-sans">
      {/* Background ambient lighting */}
      <div className="absolute top-[-10%] right-[-5%] w-[45%] h-[45%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Navbar */}
      <nav className="w-full px-6 md:px-10 py-5 flex items-center justify-between relative z-10 glass-panel border-x-0 border-t-0 rounded-none">
        <div className="flex items-center gap-4">
          <Link
            href="/teacher"
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mr-2"
          >
            <i className="fa-solid fa-arrow-left" /> กลับห้องเรียน
          </Link>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold">
              <i className="fa-solid fa-shield-halved" />
            </div>
            <div>
              <span className="font-bold text-foreground text-sm tracking-tight block">
                ระบบจัดการรหัสเชิญครู
              </span>
              <span className="text-xs text-muted-foreground">Admin Invite Control</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {profile?.role !== "admin" && (
            <button
              onClick={handleMakeMeAdmin}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-all flex items-center gap-1.5"
              title="คลิกเพื่อให้สิทธิ์แอดมินสำหรับทดสอบระบบ"
            >
              <i className="fa-solid fa-user-gear" /> ตั้งฉันเป็น Admin (Setup)
            </button>
          )}
          <span className="text-xs font-medium text-muted-foreground hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-panel">
            <i className="fa-solid fa-user-circle text-primary" /> {profile?.displayName} ({profile?.role})
          </span>
        </div>
      </nav>

      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full relative z-10 space-y-8">
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in-down">
          <div>
            <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl">
                <i className="fa-solid fa-key" />
              </span>
              จัดการรหัสลงทะเบียนบุคลากรครู
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              สร้างรหัสสุ่มความปลอดภัยสูงสำหรับให้ครูนำไปยืนยันตัวตนตอนสมัครสมาชิก (รหัสใช้งานได้ครั้งเดียว)
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 animate-fade-in-up">
          <div className="glass-panel p-6 rounded-2xl border border-white/40 dark:border-white/10 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">รหัสทั้งหมดในระบบ</p>
              <h2 className="text-3xl font-extrabold text-foreground">{invites.length}</h2>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xl">
              <i className="fa-solid fa-ticket" />
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-white/40 dark:border-white/10 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1 font-semibold">
                พร้อมใช้งาน (ยังไม่ใช้)
              </p>
              <h2 className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {unusedCount}
              </h2>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center text-xl">
              <i className="fa-solid fa-circle-check" />
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-white/40 dark:border-white/10 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">ใช้งานแล้ว</p>
              <h2 className="text-3xl font-extrabold text-muted-foreground">{usedCount}</h2>
            </div>
            <div className="w-12 h-12 rounded-xl bg-muted text-muted-foreground flex items-center justify-center text-xl">
              <i className="fa-solid fa-user-check" />
            </div>
          </div>
        </div>

        {/* Section 1: Generator Form & Latest Code Callout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
          <div className="lg:col-span-2 glass-panel p-6 md:p-8 rounded-3xl border border-white/40 dark:border-white/10">
            <h3 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
              <i className="fa-solid fa-plus-circle text-primary" /> ออกรหัสเชิญครูใหม่
            </h3>
            <p className="text-xs text-muted-foreground mb-6">
              ระบบจะสุ่มรหัสรูปแบบ <code className="px-1.5 py-0.5 rounded bg-muted font-mono font-bold text-foreground">TCH-XXXX-XX</code> ที่ตัดอักษรที่สับสนออก ป้องกันการอ่านผิด
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  ระบุชื่อครู หรือหมายเหตุ (Optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                    <i className="fa-solid fa-chalkboard-user text-sm" />
                  </div>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="เช่น ครูสมชาย ใจดี (กลุ่มสาระวิทยาศาสตร์)"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-primary/80 text-foreground text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all duration-300 shadow-md shadow-primary/20 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 flex items-center gap-2"
              >
                {creating ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin" /> กำลังสร้างรหัส...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-key" /> สร้างรหัสเชิญครู
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Latest Generated Code Quick Card */}
          <div className="glass-panel p-6 md:p-8 rounded-3xl border border-white/40 dark:border-white/10 flex flex-col justify-between bg-gradient-to-br from-primary/5 via-transparent to-emerald-500/5">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold tracking-wider uppercase text-primary">
                  รหัสที่เพิ่งสร้างล่าสุด
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              {latestCode ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-background/80 border-2 border-primary/40 text-center shadow-inner">
                    <span className="text-2xl md:text-3xl font-black font-mono tracking-widest text-primary block">
                      {latestCode}
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-1 block">
                      สถานะ: ยังไม่ถูกใช้งาน
                    </span>
                  </div>

                  <button
                    onClick={() => handleCopy(latestCode)}
                    className="w-full py-2.5 rounded-xl bg-primary/15 text-primary hover:bg-primary/25 font-semibold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <i className={copiedCode === latestCode ? "fa-solid fa-check" : "fa-solid fa-copy"} />
                    {copiedCode === latestCode ? "คัดลอกสำเร็จแล้ว!" : "คัดลอกรหัสนี้"}
                  </button>
                </div>
              ) : (
                <div className="h-32 flex flex-col items-center justify-center text-center text-muted-foreground">
                  <i className="fa-solid fa-sparkles text-2xl mb-2 text-primary/40" />
                  <p className="text-xs">กดปุ่ม "สร้างรหัสเชิญครู" ด้านซ้ายเพื่อรับรหัสใหม่</p>
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground/80 mt-4 text-center">
              * ส่งรหัสนี้ให้คุณครูเพื่อนำไปกรอกในช่อง "รหัสลงทะเบียนบุคลากร" ตอนสมัครสมาชิก
            </p>
          </div>
        </div>

        {/* Section 2: Invites Table */}
        <div className="glass-panel p-6 md:p-8 rounded-3xl border border-white/40 dark:border-white/10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <i className="fa-solid fa-list-check text-primary" /> รายการรหัสเชิญครูทั้งหมด
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                ตรวจสอบสถานะการนำรหัสไปใช้ และประวัติผู้ลงทะเบียน
              </p>
            </div>

            {/* Filter and Search */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex p-1 rounded-xl bg-background/60 border border-border text-xs">
                <button
                  onClick={() => setFilterStatus("all")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    filterStatus === "all" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  ทั้งหมด ({invites.length})
                </button>
                <button
                  onClick={() => setFilterStatus("unused")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    filterStatus === "unused" ? "bg-emerald-600 text-white shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  ยังไม่ใช้งาน ({unusedCount})
                </button>
                <button
                  onClick={() => setFilterStatus("used")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    filterStatus === "used" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  ใช้งานแล้ว ({usedCount})
                </button>
              </div>

              <div className="relative min-w-[200px]">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ค้นหารหัส / ชื่อครู..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-background/60 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-border/60">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-muted/40 text-xs font-bold text-muted-foreground border-b border-border">
                  <th className="py-3.5 px-4">รหัสเชิญ (Invite Code)</th>
                  <th className="py-3.5 px-4">หมายเหตุ / ระบุชื่อครู</th>
                  <th className="py-3.5 px-4">สถานะ</th>
                  <th className="py-3.5 px-4">ผู้ใช้งาน (ครูที่สมัคร)</th>
                  <th className="py-3.5 px-4">วันที่สร้าง</th>
                  <th className="py-3.5 px-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      <i className="fa-solid fa-circle-notch fa-spin text-primary text-xl mb-2 block" />
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : filteredInvites.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      <i className="fa-regular fa-folder-open text-2xl mb-2 block opacity-40" />
                      {searchTerm ? "ไม่พบรหัสที่ตรงกับคำค้นหา" : "ยังไม่มีรหัสเชิญในระบบ"}
                    </td>
                  </tr>
                ) : (
                  filteredInvites.map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-muted/20 transition-colors group"
                    >
                      {/* Code + Copy */}
                      <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="tracking-wider bg-background px-2.5 py-1 rounded-lg border border-border/80 shadow-xs">
                            {inv.code}
                          </span>
                          <button
                            onClick={() => handleCopy(inv.code)}
                            title="คัดลอกรหัส"
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          >
                            <i className={copiedCode === inv.code ? "fa-solid fa-check text-emerald-500" : "fa-regular fa-copy"} />
                          </button>
                        </div>
                      </td>

                      {/* Note */}
                      <td className="py-3.5 px-4 text-foreground text-xs font-medium">
                        {inv.note ? (
                          <span>{inv.note}</span>
                        ) : (
                          <span className="text-muted-foreground italic">- ไม่ได้ระบุ -</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        {inv.isUsed ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                            <i className="fa-solid fa-circle text-[8px]" /> ใช้งานแล้ว
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <i className="fa-solid fa-circle-check text-[10px]" /> ยังไม่ใช้งาน
                          </span>
                        )}
                      </td>

                      {/* Used By */}
                      <td className="py-3.5 px-4 text-xs">
                        {inv.isUsed ? (
                          <div>
                            <span className="font-semibold text-foreground block">
                              {inv.usedByName || "ไม่ระบุชื่อ"}
                            </span>
                            {inv.usedAt && (
                              <span className="text-[11px] text-muted-foreground block">
                                {new Date(inv.usedAt).toLocaleDateString("th-TH", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60">-</span>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="py-3.5 px-4 text-xs text-muted-foreground">
                        {new Date(inv.createdAt).toLocaleDateString("th-TH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        {inv.isUsed ? (
                          <span
                            className="text-muted-foreground/40 text-xs cursor-not-allowed"
                            title="รหัสที่ใช้งานแล้วไม่สามารถลบได้"
                          >
                            <i className="fa-solid fa-lock text-xs" />
                          </span>
                        ) : (
                          <button
                            onClick={() => handleDelete(inv.code)}
                            disabled={deletingCode === inv.code}
                            title="ลบรหัสนี้"
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            {deletingCode === inv.code ? (
                              <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                            ) : (
                              <i className="fa-solid fa-trash-can text-xs" />
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
