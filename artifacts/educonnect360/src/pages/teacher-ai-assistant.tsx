import { useState, type FormEvent } from "react";
import { TeacherNav } from "@/components/teacher-nav";
import { QUICK_PROMPTS, buildFallbackResponse, type AiResponse } from "@/lib/aiAssistantData";

interface HistoryItem {
  id: string;
  prompt: string;
  response: AiResponse;
}

export default function TeacherAiAssistant() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [question, setQuestion] = useState("");
  const [thinking, setThinking] = useState(false);

  function runPrompt(prompt: string, response: AiResponse) {
    setThinking(true);
    setTimeout(() => {
      setHistory((prev) => [{ id: `${Date.now()}`, prompt, response }, ...prev]);
      setThinking(false);
    }, 700);
  }

  function handleQuickPrompt(id: string) {
    const quick = QUICK_PROMPTS.find((q) => q.id === id);
    if (!quick) return;
    runPrompt(quick.label, quick.response);
  }

  function handleCustomSubmit(e: FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    runPrompt(question.trim(), buildFallbackResponse(question.trim()));
    setQuestion("");
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background relative overflow-hidden font-sans">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[55%] h-[55%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      <TeacherNav />

      <main className="relative z-10 max-w-4xl mx-auto px-6 md:px-10 py-10">
        <div className="flex items-center gap-3 mb-2 animate-fade-in-up">
          <h1 className="text-3xl font-extrabold text-foreground">ผู้ช่วยสอน AI</h1>
          <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-wide">
            DEMO
          </span>
        </div>
        <p className="text-muted-foreground mb-8">
          เลือกคำสั่งด่วน หรือพิมพ์สิ่งที่ต้องการให้ AI ช่วยออกแบบการสอน
        </p>

        <div className="glass-panel rounded-3xl p-6 sm:p-8 mb-6 animate-fade-in-up" style={{ animationDelay: "80ms", animationFillMode: "both" }}>
          <p className="text-sm font-semibold text-foreground mb-3">คำสั่งด่วน</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q.id}
                onClick={() => handleQuickPrompt(q.id)}
                disabled={thinking}
                className="text-left px-4 py-3.5 rounded-xl bg-background/50 border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all flex items-start gap-3 disabled:opacity-60"
              >
                <i className={`fa-solid ${q.icon} text-primary mt-0.5`} />
                <span className="text-sm font-medium text-foreground">{q.label}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleCustomSubmit} className="flex items-center gap-3 mt-5">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="พิมพ์คำสั่งของคุณเอง เช่น 'ออกแบบใบงานเรื่องระบบสุริยะ'"
              className="flex-1 px-4 py-3 rounded-xl bg-background/60 border border-border focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground/70"
            />
            <button
              type="submit"
              disabled={thinking || !question.trim()}
              className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-60 flex items-center gap-2"
            >
              <i className="fa-solid fa-paper-plane" /> ส่ง
            </button>
          </form>
        </div>

        {thinking && (
          <div className="glass-panel rounded-2xl p-5 mb-6 flex items-center gap-3 text-muted-foreground animate-fade-in-up">
            <i className="fa-solid fa-circle-notch fa-spin text-primary" /> AI กำลังประมวลผล...
          </div>
        )}

        <div className="space-y-5">
          {history.map((item, idx) => (
            <div
              key={item.id}
              className="glass-panel rounded-3xl p-6 sm:p-8 animate-fade-in-up"
              style={{ animationDelay: idx === 0 ? "0ms" : undefined, animationFillMode: "both" }}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-4">
                <i className="fa-solid fa-comment-dots text-primary" /> {item.prompt}
              </div>
              <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <i className="fa-solid fa-wand-magic-sparkles text-primary" /> {item.response.title}
              </h3>
              <div className="space-y-4">
                {item.response.sections.map((section) => (
                  <div key={section.heading}>
                    <p className="text-sm font-bold text-primary mb-2">{section.heading}</p>
                    <ul className="space-y-1.5">
                      {section.items.map((line) => (
                        <li key={line} className="text-sm text-foreground/90 flex items-start gap-2">
                          <i className="fa-solid fa-circle text-[5px] text-primary mt-2 shrink-0" />
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {history.length === 0 && !thinking && (
          <div className="glass-panel rounded-3xl p-16 text-center">
            <i className="fa-solid fa-robot text-4xl text-primary/40 mb-4" />
            <p className="text-muted-foreground">เลือกคำสั่งด่วนด้านบนเพื่อเริ่มต้น</p>
          </div>
        )}
      </main>
    </div>
  );
}
