import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { createAssignment, getAssignmentsForClass } from "@/lib/firestore";
import type { Assignment, Class } from "@/types";

function formatDueDate(dueDate: string): string {
  return new Date(dueDate + "T00:00:00").toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function TeacherAssignmentsPanel({ cls, teacherId }: { cls: Class; teacherId: string }) {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function refresh() {
    try {
      const list = await getAssignmentsForClass(cls.id);
      setAssignments(list);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "โหลดรายการการบ้านไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls.id]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">การบ้าน / แบบทดสอบ</h3>
          <p className="text-sm text-muted-foreground">สั่งงานและติดตามการส่งงานของนักเรียน</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all shadow-md shadow-primary/20 flex items-center gap-2"
        >
          <i className="fa-solid fa-plus" /> สั่งการบ้าน
        </button>
      </div>

      {assignments === null ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <i className="fa-solid fa-circle-notch fa-spin text-primary" /> กำลังโหลด...
        </div>
      ) : assignments.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center">
          <i className="fa-solid fa-file-pen text-3xl text-primary/50 mb-3" />
          <p className="text-muted-foreground">ยังไม่มีการบ้านในห้องเรียนนี้</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {assignments.map((a) => {
            const overdue = a.dueDate < today;
            return (
              <li key={a.id} className="glass-panel rounded-2xl p-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-bold text-foreground truncate">{a.title}</p>
                  <p className="text-sm text-muted-foreground line-clamp-1">{a.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    กำหนดส่ง {formatDueDate(a.dueDate)} &middot; คะแนนเต็ม {a.maxScore}
                    {overdue && <span className="text-red-500 font-semibold"> &middot; เลยกำหนดแล้ว</span>}
                  </p>
                </div>
                <Link
                  href={`/teacher/classes/${cls.id}/assignments/${a.id}`}
                  className="shrink-0 px-4 py-2 rounded-lg bg-primary/10 text-primary font-semibold text-sm hover:bg-primary/20 transition-all flex items-center gap-2"
                >
                  <i className="fa-solid fa-table-list" /> สมุดคะแนน
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {showCreate && (
        <CreateAssignmentModal
          classId={cls.id}
          teacherId={teacherId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function CreateAssignmentModal({
  classId,
  teacherId,
  onClose,
  onCreated,
}: {
  classId: string;
  teacherId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [maxScore, setMaxScore] = useState(100);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createAssignment({ classId, teacherId, title, description, dueDate, maxScore });
      toast({ title: "สั่งการบ้านสำเร็จ" });
      onCreated();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "สั่งการบ้านไม่สำเร็จ",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-fade-in-up">
      <div className="glass-panel rounded-3xl p-8 w-full max-w-lg bg-card/95">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">สั่งการบ้าน / สร้างแบบทดสอบ</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">หัวข้องาน</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น แบบฝึกหัดบทที่ 5 เรื่องเศษส่วน"
              className="w-full px-4 py-3 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">คำอธิบาย</label>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="รายละเอียดของงาน..."
              className="w-full px-4 py-3 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring text-foreground resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">กำหนดส่ง</label>
              <input
                required
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">คะแนนเต็ม</label>
              <input
                required
                type="number"
                min={1}
                value={maxScore}
                onChange={(e) => setMaxScore(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting ? <i className="fa-solid fa-circle-notch fa-spin" /> : "สั่งการบ้าน"}
          </button>
        </form>
      </div>
    </div>
  );
}
