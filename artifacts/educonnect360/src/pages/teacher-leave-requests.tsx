import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { TeacherNav } from "@/components/teacher-nav";
import { LeaveDocumentModal } from "@/components/leave-document-modal";
import {
  getAllLeaveRequests,
  updateLeaveRequestStatus,
  deleteLeaveRequest,
} from "@/lib/firestore";
import type { LeaveRequest } from "@/types";

export default function TeacherLeaveRequests() {
  const { toast } = useToast();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [viewingLeave, setViewingLeave] = useState<LeaveRequest | null>(null);

  async function load() {
    setLoading(true);
    try {
      const list = await getAllLeaveRequests();
      setLeaves(list);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "โหลดรายการใบลาไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUpdateStatus(id: string, status: "approved" | "rejected") {
    try {
      await updateLeaveRequestStatus(id, status);
      toast({
        title: status === "approved" ? "อนุมัติใบลาเรียบร้อยแล้ว" : "ปฏิเสธคำขอใบลาแล้ว",
      });
      load();
      if (viewingLeave && viewingLeave.id === id) {
        setViewingLeave({ ...viewingLeave, status });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "อัปเดตสถานะไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบใบลานี้?")) return;
    try {
      await deleteLeaveRequest(id);
      toast({ title: "ลบใบลาสำเร็จ" });
      load();
      if (viewingLeave?.id === id) setViewingLeave(null);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "ลบใบลาไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  const filtered = leaves.filter((l) => {
    if (filter === "all") return true;
    return l.status === filter;
  });

  return (
    <div className="min-h-[100dvh] w-full bg-background relative overflow-hidden font-sans">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[55%] h-[55%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      <TeacherNav />

      <main className="relative z-10 max-w-5xl mx-auto px-6 md:px-10 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 animate-fade-in-up">
          <div>
            <h1 className="text-3xl font-extrabold text-foreground">จัดการหนังสือใบลา</h1>
            <p className="text-muted-foreground mt-1">
              พิจารณาคำขอใบลาของนักเรียน และพิมพ์เอกสารแบบฟอร์มครูตามมาตรฐาน TH Sarabun PSK
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-primary/10 text-primary">
              รอพิจารณา {leaves.filter((l) => l.status === "pending").length} ฉบับ
            </span>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 mb-6 glass-panel rounded-xl p-1.5 w-fit">
          {(
            [
              { id: "all", label: "ทั้งหมด" },
              { id: "pending", label: "รอพิจารณา" },
              { id: "approved", label: "อนุมัติแล้ว" },
              { id: "rejected", label: "ไม่อนุมัติ" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === tab.id
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-3">
            <i className="fa-solid fa-circle-notch fa-spin text-primary text-2xl" />
            <span>กำลังโหลดรายการใบลา...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-panel rounded-3xl p-16 text-center animate-fade-in-up">
            <i className="fa-solid fa-envelope-open-text text-4xl text-primary/40 mb-3" />
            <h3 className="text-lg font-bold text-foreground mb-1">ไม่พบรายการใบลา</h3>
            <p className="text-sm text-muted-foreground">ยังไม่มีคำขอใบลาในหมวดนี้</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filtered.map((leave) => {
              const isSick = leave.type === "sick";
              return (
                <div
                  key={leave.id}
                  className="glass-panel rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          isSick
                            ? "bg-amber-500/10 text-amber-600"
                            : "bg-blue-500/10 text-blue-600"
                        }`}
                      >
                        <i className={`fa-solid ${isSick ? "fa-temperature-arrow-up" : "fa-briefcase"}`} />
                        {isSick ? "ลาป่วย" : "ขอลากิจ"}
                      </span>
                      <h4 className="font-bold text-base text-foreground truncate">
                        {leave.prefix} {leave.studentName}
                      </h4>
                      {leave.studentGrade && (
                        <span className="text-xs text-muted-foreground">({leave.studentGrade} เลขที่ {leave.studentNumber})</span>
                      )}
                    </div>
                    <p className="text-sm text-foreground/80 line-clamp-1">
                      <span className="font-medium text-muted-foreground">สาเหตุ:</span> {leave.reason}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        <i className="fa-regular fa-calendar-days mr-1" />
                        {leave.startDate} ถึง {leave.endDate} ({leave.daysCount} วัน)
                      </span>
                      <span>
                        <i className="fa-solid fa-chalkboard-user mr-1" /> ครูที่ปรึกษา: {leave.advisorName}
                      </span>
                      <span>
                        <i className="fa-solid fa-user-shield mr-1" /> ผู้ปกครอง: {leave.parentName}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {/* Status Badge */}
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
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
                        : "รอพิจารณา"}
                    </span>

                    {/* View / Print Document Modal Button */}
                    <button
                      onClick={() => setViewingLeave(leave)}
                      className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-all flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-file-lines" /> ดู/พิมพ์ใบลา (TH Sarabun)
                    </button>

                    {leave.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(leave.id, "approved")}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all"
                          title="อนุมัติ"
                        >
                          <i className="fa-solid fa-check" />
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(leave.id, "rejected")}
                          className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-all"
                          title="ไม่อนุมัติ"
                        >
                          <i className="fa-solid fa-xmark" />
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => handleDelete(leave.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      title="ลบ"
                    >
                      <i className="fa-regular fa-trash-can" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Leave Document Viewer & Print Modal */}
      {viewingLeave && (
        <LeaveDocumentModal
          leave={viewingLeave}
          initialFormat="teacher"
          canManage={true}
          onClose={() => setViewingLeave(null)}
          onApprove={() => handleUpdateStatus(viewingLeave.id, "approved")}
          onReject={() => handleUpdateStatus(viewingLeave.id, "rejected")}
        />
      )}
    </div>
  );
}
