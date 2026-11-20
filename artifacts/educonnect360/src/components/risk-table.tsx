import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getClassRiskAnalysis } from "@/lib/firestore";
import type { Class, StudentRiskEntry } from "@/types";

const RISK_META: Record<StudentRiskEntry["riskLevel"], { label: string; className: string; dot: string }> = {
  high: { label: "เสี่ยงสูง", className: "bg-red-500/10 text-red-600", dot: "bg-red-500" },
  medium: { label: "เฝ้าระวัง", className: "bg-amber-500/10 text-amber-600", dot: "bg-amber-500" },
};

export function RiskTable({ cls }: { cls: Class }) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<StudentRiskEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getClassRiskAnalysis(cls);
        if (!cancelled) setEntries(result);
      } catch (err) {
        if (!cancelled) {
          setEntries([]);
          toast({
            variant: "destructive",
            title: "วิเคราะห์นักเรียนกลุ่มเสี่ยงไม่สำเร็จ",
            description: err instanceof Error ? err.message : undefined,
          });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls.id, cls.studentIds.length]);

  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <i className="fa-solid fa-shield-halved" />
        </div>
        <h3 className="text-lg font-bold text-foreground">นักเรียนกลุ่มเสี่ยงโดย AI</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-5 ml-12 -mt-1">
        วิเคราะห์จากข้อมูลการเข้าเรียนและการส่งงานจริงของห้องนี้
      </p>

      {entries === null ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground gap-2 text-sm">
          <i className="fa-solid fa-circle-notch fa-spin text-primary" /> กำลังวิเคราะห์...
        </div>
      ) : entries.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-6 rounded-xl bg-emerald-500/5 text-emerald-700 text-sm justify-center">
          <i className="fa-solid fa-circle-check text-lg" />
          ยังไม่พบนักเรียนกลุ่มเสี่ยงในห้องนี้
        </div>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => {
            const meta = RISK_META[entry.riskLevel];
            return (
              <li
                key={entry.studentId}
                className="p-4 rounded-xl bg-background/50 border border-border/60"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="font-semibold text-foreground flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                    {entry.studentName}
                  </span>
                  <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold ${meta.className}`}>
                    {meta.label}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-2">
                  <span>
                    <i className="fa-solid fa-calendar-check mr-1" /> เข้าเรียน {entry.attendanceRate}%
                  </span>
                  <span>
                    <i className="fa-solid fa-file-circle-exclamation mr-1" /> ส่งงานช้า/ขาดส่ง{" "}
                    {entry.lateOrMissingCount} ชิ้น
                  </span>
                </div>
                <p className="text-xs bg-primary/5 text-primary/90 rounded-lg px-3 py-2 flex items-start gap-2">
                  <i className="fa-solid fa-wand-magic-sparkles mt-0.5" />
                  {entry.message}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
