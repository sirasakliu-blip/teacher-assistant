import { useState } from "react";
import { TeacherNav } from "@/components/teacher-nav";
import { useToast } from "@/hooks/use-toast";
import { openAgent, copyToClipboard, type AgentKey } from "@/lib/ai-assistant";

type AssistantTab = "lesson-plan" | "pa-evaluation" | "general-chat";

export default function TeacherAiAssistant() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<AssistantTab>("lesson-plan");

  // =========================================================================
  // STATE: แท็บ 1 - ช่วยคิดแผนการสอน [A]
  // =========================================================================
  const [planSubject, setPlanSubject] = useState("วิทยาศาสตร์และเทคโนโลยี");
  const [planGrade, setPlanGrade] = useState("มัธยมศึกษาปีที่ 3");
  const [planTopic, setPlanTopic] = useState("ระบบสุริยะและการโคจรของดาวเคราะห์");
  const [planModel, setPlanModel] = useState("Active Learning (การจัดการเรียนรู้เชิงรุก)");
  const [planStandard, setPlanStandard] = useState("");
  const [planErrors, setPlanErrors] = useState<{ subject?: string; grade?: string; topic?: string }>({});
  const [planPromptOutput, setPlanPromptOutput] = useState<string | null>(null);

  // =========================================================================
  // STATE: แท็บ 2 - จัดการประเมินวิทยฐานะ (ว.PA) [B]
  // =========================================================================
  const [paCustomPrompt, setPaCustomPrompt] = useState("");
  const [paPromptOutput, setPaPromptOutput] = useState<string | null>(null);

  // =========================================================================
  // STATE: แท็บ 3 - ปรึกษา AI ทั่วไป [C]
  // =========================================================================
  const [selectedChatAgent, setSelectedChatAgent] = useState<AgentKey>("plan");
  const [generalPrompt, setGeneralPrompt] = useState("");
  const [generalPromptOutput, setGeneralPromptOutput] = useState<string | null>(null);

  /**
   * แจ้งเตือน Toast เมื่อคัดลอกสำเร็จ (แสดง 3 วินาที)
   */
  function notifyCopied() {
    toast({
      title: "คัดลอกคำสั่งแล้ว",
      description: "นำไปวาง (Ctrl+V) ในหน้าต่างแชต LangMind ที่เปิดขึ้นได้ทันทีครับ",
      duration: 3000,
    });
  }

  // =========================================================================
  // HANDLERS: แท็บ 1 - แผนการสอน [A]
  // =========================================================================
  async function handleGenerateLessonPlan(e: React.FormEvent) {
    e.preventDefault();
    const errors: { subject?: string; grade?: string; topic?: string } = {};

    if (!planSubject.trim()) {
      errors.subject = "กรุณากรอกหรือเลือกกลุ่มสาระการเรียนรู้";
    }
    if (!planGrade.trim()) {
      errors.grade = "กรุณากรอกหรือเลือกระดับชั้น";
    }
    if (!planTopic.trim()) {
      errors.topic = "กรุณาระบุหน่วยการเรียนรู้ / เรื่องที่สอน";
    }

    setPlanErrors(errors);
    if (Object.keys(errors).length > 0) return;

    // 2. สร้างข้อความคำสั่งภาษาไทยตามรูปแบบที่กำหนด
    const standardText = planStandard.trim() || "ยังไม่ระบุ ให้เลือกตัวชี้วัดที่ตรงจากหลักสูตรแกนกลางฯ";
    const promptText = `ช่วยร่างแผนการจัดการเรียนรู้ฉบับสมบูรณ์
กลุ่มสาระการเรียนรู้: ${planSubject}
ระดับชั้น: ${planGrade}
หน่วยการเรียนรู้/เรื่อง: ${planTopic}
รูปแบบการจัดการเรียนรู้: ${planModel}
มาตรฐาน/ตัวชี้วัด: ${standardText}
ขอแผนแบบเต็ม มีจุดประสงค์ สาระสำคัญ กิจกรรม สื่อ การวัดประเมินผล และออกเป็นไฟล์ Word`;

    // 3. คัดลอกข้อความลงคลิปบอร์ด
    await copyToClipboard(promptText);

    // 4. เปิด Agent "plan"
    openAgent("plan", promptText);

    // 5. บันทึกและแสดงผลกล่องการ์ดเขียวอ่อนใต้ปุ่ม
    setPlanPromptOutput(promptText);

    // 6. แสดง toast
    notifyCopied();
  }

  // =========================================================================
  // HANDLERS: แท็บ 2 - ว.PA [B]
  // =========================================================================
  const PA_PRESET_QUESTIONS = [
    "สรุปเกณฑ์การประเมิน ว.PA สำหรับครูชำนาญการ",
    "ช่วยร่างข้อตกลงในการพัฒนางาน (PA) ประเด็นท้าทาย สำหรับ มัธยมศึกษา/วิชาคณิตศาสตร์",
    "ตัวชี้วัดของ PA มีอะไรบ้าง ต้องเตรียมหลักฐานอะไร",
    "งานไหนถูกยกเลิกตามนโยบาย Work Smart แล้วบ้าง",
    "แนวทางการทำคลิปการสอนตามเกณฑ์ ว9/2564 ไม่ให้ตกเกณฑ์",
    "การเขียนผลลัพธ์การเรียนรู้ของผู้เรียน (ด้านผลงานและร่องรอยการเรียนรู้)",
  ];

  async function handleSendPaQuestion(questionText: string) {
    if (!questionText.trim()) return;
    const promptText = questionText.trim();

    await copyToClipboard(promptText);
    openAgent("pa", promptText);
    setPaPromptOutput(promptText);
    notifyCopied();
  }

  // =========================================================================
  // HANDLERS: แท็บ 3 - ปรึกษา AI ทั่วไป [C]
  // =========================================================================
  const GENERAL_AGENTS: Array<{
    key: AgentKey;
    name: string;
    description: string;
    icon: string;
    color: string;
  }> = [
    {
      key: "pa",
      name: "ธุรการและวิทยฐานะครู (ว.PA)",
      description: "ปรึกษาเกณฑ์ประเมิน PA, เลื่อนวิทยฐานะ, DPA และภาระงานครู",
      icon: "fa-solid fa-award",
      color: "text-emerald-700 bg-emerald-50 border-emerald-200",
    },
    {
      key: "docs",
      name: "เอกสารราชการและใบลา",
      description: "ร่างหนังสือราชการ บันทึกข้อความ ใบลา คำสั่ง และระเบียบราชการ",
      icon: "fa-solid fa-file-signature",
      color: "text-blue-700 bg-blue-50 border-blue-200",
    },
    {
      key: "read",
      name: "อ่านและสรุปหนังสือ",
      description: "สรุปสาระสำคัญจากเอกสารยาว บทความวิชาการ และคู่มือการสอน",
      icon: "fa-solid fa-book-open",
      color: "text-amber-700 bg-amber-50 border-amber-200",
    },
    {
      key: "plan",
      name: "แผนการจัดการเรียนรู้",
      description: "ร่างและตรวจแผนการจัดการเรียนรู้ อ้างอิงตัวชี้วัดหลักสูตรแกนกลางฯ ครบ 8 กลุ่มสาระ ออกไฟล์ Word ได้",
      icon: "fa-solid fa-book-bookmark",
      color: "text-emerald-700 bg-emerald-50 border-emerald-200",
    },
  ];

  async function handleSendGeneralQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!generalPrompt.trim()) return;

    const promptText = generalPrompt.trim();
    await copyToClipboard(promptText);
    openAgent(selectedChatAgent, promptText);
    setGeneralPromptOutput(promptText);
    notifyCopied();
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background relative overflow-hidden font-sans pb-16">
      {/* Background Glows (คงโทนสีเขียวเดิม #1e7a4f) */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#1e7a4f]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[55%] h-[55%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      <TeacherNav />

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 md:px-10 py-8">
        {/* Header (คงฟอนต์ สไตล์ และการ์ดมุมโค้งเดิม) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 animate-fade-in-up">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">ผู้ช่วยสอน AI สำหรับคุณครู</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#1e7a4f]/15 text-[#1e7a4f] border border-[#1e7a4f]/25">
                LangMind Powered
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              เชื่อมต่อ AI Agent ช่วยคุณครูคิดแผนการสอน จัดการวิทยฐานะ ว.PA และร่างเอกสารราชการ
            </p>
          </div>
        </div>

        {/* Tab Navigation (คงแถบเมนูและแท็บทั้ง 3 เดิม) */}
        <div className="flex border-b border-border bg-card/60 backdrop-blur-md rounded-t-2xl p-1.5 gap-1 mb-6">
          <button
            onClick={() => setActiveTab("lesson-plan")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "lesson-plan"
                ? "bg-[#1e7a4f] text-white shadow-sm shadow-[#1e7a4f]/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <i className="fa-solid fa-book-open-reader" />
            <span>ช่วยคิดแผนการสอน</span>
          </button>

          <button
            onClick={() => setActiveTab("pa-evaluation")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "pa-evaluation"
                ? "bg-[#1e7a4f] text-white shadow-sm shadow-[#1e7a4f]/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <i className="fa-solid fa-award" />
            <span>จัดการประเมินวิทยฐานะ (ว.PA)</span>
          </button>

          <button
            onClick={() => setActiveTab("general-chat")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "general-chat"
                ? "bg-[#1e7a4f] text-white shadow-sm shadow-[#1e7a4f]/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <i className="fa-solid fa-comments" />
            <span>ปรึกษา AI ทั่วไป</span>
          </button>
        </div>

        {/* =================================================================== */}
        {/* TAB [A]: ช่วยคิดแผนการสอน                                             */}
        {/* =================================================================== */}
        {activeTab === "lesson-plan" && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="glass-panel rounded-3xl p-6 sm:p-8">
              <div className="flex items-center gap-2.5 mb-4 pb-2 border-b border-border/40">
                <div className="w-8 h-8 rounded-lg bg-[#1e7a4f]/10 text-[#1e7a4f] flex items-center justify-center text-sm">
                  <i className="fa-solid fa-wand-magic-sparkles" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground text-sm sm:text-base">ตั้งค่าแผนการจัดการเรียนรู้</h2>
                  <p className="text-xs text-muted-foreground">กำหนดเป้าหมายการสอนเพื่อให้ AI ร่างแผนการจัดการเรียนรู้ฉบับสมบูรณ์</p>
                </div>
              </div>

              <form onSubmit={handleGenerateLessonPlan} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      กลุ่มสาระการเรียนรู้ <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={planSubject}
                      onChange={(e) => {
                        setPlanSubject(e.target.value);
                        setPlanErrors((prev) => ({ ...prev, subject: undefined }));
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-background/80 border text-foreground text-sm ${
                        planErrors.subject ? "border-rose-500 ring-1 ring-rose-500" : "border-border"
                      }`}
                    >
                      <option value="">-- กรุณาเลือกกลุ่มสาระ --</option>
                      <option value="วิทยาศาสตร์และเทคโนโลยี">วิทยาศาสตร์และเทคโนโลยี</option>
                      <option value="คณิตศาสตร์">คณิตศาสตร์</option>
                      <option value="ภาษาไทย">ภาษาไทย</option>
                      <option value="ภาษาต่างประเทศ (ภาษาอังกฤษ)">ภาษาต่างประเทศ (ภาษาอังกฤษ)</option>
                      <option value="สังคมศึกษา ศาสนา และวัฒนธรรม">สังคมศึกษา ศาสนา และวัฒนธรรม</option>
                      <option value="สุขศึกษาและพลศึกษา">สุขศึกษาและพลศึกษา</option>
                      <option value="ศิลปะ (ทัศนศิลป์/ดนตรี/นาฏศิลป์)">ศิลปะ (ทัศนศิลป์/ดนตรี/นาฏศิลป์)</option>
                      <option value="การงานอาชีพ">การงานอาชีพ</option>
                    </select>
                    {planErrors.subject && (
                      <p className="text-xs text-rose-500 mt-1 font-medium">{planErrors.subject}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      ระดับชั้น <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={planGrade}
                      onChange={(e) => {
                        setPlanGrade(e.target.value);
                        setPlanErrors((prev) => ({ ...prev, grade: undefined }));
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-background/80 border text-foreground text-sm ${
                        planErrors.grade ? "border-rose-500 ring-1 ring-rose-500" : "border-border"
                      }`}
                    >
                      <option value="">-- กรุณาเลือกระดับชั้น --</option>
                      <option value="ประถมศึกษาปีที่ 1 - 3 (ปฐมวัย/ประถมต้น)">ประถมศึกษาปีที่ 1 - 3 (ปฐมวัย/ประถมต้น)</option>
                      <option value="ประถมศึกษาปีที่ 4 - 6 (ประถมปลาย)">ประถมศึกษาปีที่ 4 - 6 (ประถมปลาย)</option>
                      <option value="มัธยมศึกษาปีที่ 1">มัธยมศึกษาปีที่ 1</option>
                      <option value="มัธยมศึกษาปีที่ 2">มัธยมศึกษาปีที่ 2</option>
                      <option value="มัธยมศึกษาปีที่ 3">มัธยมศึกษาปีที่ 3</option>
                      <option value="มัธยมศึกษาปีที่ 4">มัธยมศึกษาปีที่ 4</option>
                      <option value="มัธยมศึกษาปีที่ 5">มัธยมศึกษาปีที่ 5</option>
                      <option value="มัธยมศึกษาปีที่ 6">มัธยมศึกษาปีที่ 6</option>
                    </select>
                    {planErrors.grade && (
                      <p className="text-xs text-rose-500 mt-1 font-medium">{planErrors.grade}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      หน่วยการเรียนรู้ / เรื่องที่สอน <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={planTopic}
                      onChange={(e) => {
                        setPlanTopic(e.target.value);
                        setPlanErrors((prev) => ({ ...prev, topic: undefined }));
                      }}
                      placeholder="เช่น ระบบสุริยะ, การบวกเศษส่วน, การเขียนจดหมาย..."
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-background/80 border text-foreground text-sm ${
                        planErrors.topic ? "border-rose-500 ring-1 ring-rose-500" : "border-border"
                      }`}
                    />
                    {planErrors.topic && (
                      <p className="text-xs text-rose-500 mt-1 font-medium">{planErrors.topic}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">รูปแบบการจัดการเรียนรู้</label>
                    <select
                      value={planModel}
                      onChange={(e) => setPlanModel(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background/80 border border-border text-foreground text-sm"
                    >
                      <option value="Active Learning (การจัดการเรียนรู้เชิงรุก)">Active Learning (การจัดการเรียนรู้เชิงรุก)</option>
                      <option value="5E Instructional Model (กระบวนการสืบเสาะหาความรู้ 5 ขั้น)">5E Instructional Model (กระบวนการสืบเสาะหาความรู้ 5 ขั้น)</option>
                      <option value="Problem-Based Learning (PBL - ใช้ปัญหาเป็นฐาน)">Problem-Based Learning (PBL - ใช้ปัญหาเป็นฐาน)</option>
                      <option value="Game-Based Learning (การเรียนรู้โดยใช้เกม)">Game-Based Learning (การเรียนรู้โดยใช้เกม)</option>
                      <option value="CIPPA Model (กระบวนการเรียนรู้เน้นผู้เรียนเป็นสำคัญ)">CIPPA Model (กระบวนการเรียนรู้เน้นผู้เรียนเป็นสำคัญ)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    มาตรฐานการเรียนรู้ / ตัวชี้วัด (ระบุหรือไม่ระบุก็ได้)
                  </label>
                  <input
                    type="text"
                    value={planStandard}
                    onChange={(e) => setPlanStandard(e.target.value)}
                    placeholder="เช่น ว 3.1 ม.3/1 หรือ ท 1.1 ป.4/2 (หากเว้นว่าง ระบบจะให้ AI คัดเลือกให้ตรงหลักสูตร)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background/80 border border-border text-foreground text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-[#1e7a4f] text-white font-semibold text-sm hover:bg-[#17633f] transition shadow-md shadow-[#1e7a4f]/25 cursor-pointer flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-wand-magic-sparkles text-sm" /> สร้างแผนการสอนฉบับสมบูรณ์
                </button>
              </form>
            </div>

            {/* กล่องผลลัพธ์ใต้ปุ่ม (การ์ดสีเขียวอ่อน พร้อมข้อความแนะนำ Ctrl+V, กล่องข้อความ และปุ่มคัดลอก/เปิดซ้ำ) */}
            {planPromptOutput && (
              <div className="bg-[#f0fdf4] border border-[#bbf7d0] dark:bg-emerald-950/20 dark:border-emerald-500/30 rounded-3xl p-6 sm:p-7 space-y-4 animate-fade-in-up shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs shrink-0">
                      <i className="fa-solid fa-check" />
                    </span>
                    <span>✅ คัดลอกคำสั่งแล้ว — กด Ctrl+V ในช่องแชต แล้วกด Enter</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        copyToClipboard(planPromptOutput);
                        notifyCopied();
                      }}
                      className="px-3.5 py-1.5 rounded-xl border border-[#1e7a4f] text-[#1e7a4f] dark:text-emerald-400 dark:border-emerald-500 bg-white dark:bg-slate-900 text-xs font-semibold hover:bg-[#1e7a4f]/10 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <i className="fa-solid fa-copy" /> คัดลอกอีกครั้ง
                    </button>
                    <button
                      type="button"
                      onClick={() => openAgent("plan", planPromptOutput)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#1e7a4f] text-white text-xs font-semibold hover:bg-[#17633f] transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square" /> เปิดหน้าต่างแชตอีกครั้ง
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-900 dark:text-emerald-300 mb-1.5">
                    ข้อความคำสั่งที่สร้างขึ้น (สามารถดูหรือแก้ไขเพิ่มเติมได้):
                  </label>
                  <textarea
                    readOnly
                    rows={6}
                    value={planPromptOutput}
                    className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-emerald-200 dark:border-emerald-800 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-sans leading-relaxed focus:outline-none resize-y"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB [B]: จัดการประเมินวิทยฐานะ (ว.PA)                                */}
        {/* =================================================================== */}
        {activeTab === "pa-evaluation" && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="glass-panel rounded-3xl p-6 sm:p-8">
              <div className="flex items-center gap-2.5 mb-4 pb-2 border-b border-border/40">
                <div className="w-8 h-8 rounded-lg bg-[#1e7a4f]/10 text-[#1e7a4f] flex items-center justify-center text-sm">
                  <i className="fa-solid fa-award" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground text-sm sm:text-base">ระบบผู้ช่วยประเมินวิทยฐานะและธุรการ (ว.PA)</h2>
                  <p className="text-xs text-muted-foreground">
                    เชื่อมต่อ AI Agent เฉพาะทางสำหรับเกณฑ์ ก.ค.ศ., ข้อตกลง PA, ประเด็นท้าทาย และระบบ DPA
                  </p>
                </div>
              </div>

              {/* การ์ดคำถามสำเร็จรูป 6 ปุ่ม */}
              <div className="space-y-3 mb-6">
                <label className="block text-xs font-bold text-foreground flex items-center gap-1.5">
                  <i className="fa-solid fa-bolt text-amber-500" />
                  <span>เลือกคำถามสำเร็จรูปยอดนิยม (คลิกแล้วเปิด AI ทันที):</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PA_PRESET_QUESTIONS.map((question, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendPaQuestion(question)}
                      className="text-left p-3.5 rounded-2xl border border-border bg-card/80 hover:border-[#1e7a4f] hover:bg-[#1e7a4f]/5 text-xs sm:text-sm font-medium text-foreground transition-all flex items-start gap-2.5 cursor-pointer shadow-xs group"
                    >
                      <span className="w-6 h-6 rounded-lg bg-emerald-100 text-[#1e7a4f] dark:bg-emerald-950 dark:text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 group-hover:bg-[#1e7a4f] group-hover:text-white transition">
                        {idx + 1}
                      </span>
                      <span className="flex-1 leading-snug">{question}</span>
                      <i className="fa-solid fa-arrow-up-right-from-square text-xs text-muted-foreground group-hover:text-[#1e7a4f] transition shrink-0 mt-1" />
                    </button>
                  ))}
                </div>
              </div>

              {/* ช่องพิมพ์คำถามเอง */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendPaQuestion(paCustomPrompt);
                }}
                className="space-y-3 pt-4 border-t border-border/60"
              >
                <label className="block text-xs font-bold text-foreground">
                  หรือพิมพ์ประเด็นคำถาม ว.PA ที่ต้องการปรึกษาด้วยตนเอง:
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={paCustomPrompt}
                    onChange={(e) => setPaCustomPrompt(e.target.value)}
                    placeholder="เช่น ช่วยร่างประเด็นท้าทายวิชาภาษาไทย ม.1 เรื่องการอ่านจับใจความสำคัญ..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-background/80 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#1e7a4f]"
                  />
                  <button
                    type="submit"
                    disabled={!paCustomPrompt.trim()}
                    className="px-6 py-2.5 rounded-xl bg-[#1e7a4f] text-white font-semibold text-sm hover:bg-[#17633f] transition shadow-md shadow-[#1e7a4f]/25 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-paper-plane text-xs" />
                    <span>ถาม AI</span>
                  </button>
                </div>
              </form>
            </div>

            {/* กล่องผลลัพธ์คำถามที่คัดลอกแล้ว */}
            {paPromptOutput && (
              <div className="bg-[#f0fdf4] border border-[#bbf7d0] dark:bg-emerald-950/20 dark:border-emerald-500/30 rounded-3xl p-6 sm:p-7 space-y-4 animate-fade-in-up shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs shrink-0">
                      <i className="fa-solid fa-check" />
                    </span>
                    <span>✅ คัดลอกคำสั่งแล้ว — กด Ctrl+V ในช่องแชต แล้วกด Enter</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        copyToClipboard(paPromptOutput);
                        notifyCopied();
                      }}
                      className="px-3.5 py-1.5 rounded-xl border border-[#1e7a4f] text-[#1e7a4f] dark:text-emerald-400 dark:border-emerald-500 bg-white dark:bg-slate-900 text-xs font-semibold hover:bg-[#1e7a4f]/10 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <i className="fa-solid fa-copy" /> คัดลอกอีกครั้ง
                    </button>
                    <button
                      type="button"
                      onClick={() => openAgent("pa", paPromptOutput)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#1e7a4f] text-white text-xs font-semibold hover:bg-[#17633f] transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square" /> เปิดหน้าต่างแชตอีกครั้ง
                    </button>
                  </div>
                </div>

                <div>
                  <textarea
                    readOnly
                    rows={3}
                    value={paPromptOutput}
                    className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-emerald-200 dark:border-emerald-800 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-sans leading-relaxed focus:outline-none resize-y"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB [C]: ปรึกษา AI ทั่วไป (การ์ด 4 ใบ + กล่องคำถามเลือก Agent)            */}
        {/* =================================================================== */}
        {activeTab === "general-chat" && (
          <div className="space-y-6 animate-fade-in-up">
            {/* ตารางการ์ด 4 ใบสำหรับ Agent ทั้ง 4 ด้าน (pa, docs, read, plan) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {GENERAL_AGENTS.map((agent) => (
                <div
                  key={agent.key}
                  className="bg-card rounded-3xl p-5 border border-border hover:border-[#1e7a4f] hover:shadow-md transition-all flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg border ${agent.color}`}>
                        <i className={agent.icon} />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-sm sm:text-base leading-tight">{agent.name}</h3>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
                          AGENT: {agent.key.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed pl-1">{agent.description}</p>
                  </div>

                  <div className="pt-2 border-t border-border/50">
                    <button
                      type="button"
                      onClick={() => openAgent(agent.key)}
                      className="w-full py-2 px-3 rounded-xl border border-[#1e7a4f] text-[#1e7a4f] hover:bg-[#1e7a4f] hover:text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
                      <span>เปิดแชต</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ช่องพิมพ์คำถามเองพร้อม Dropdown เลือก Agent (plan, pa, docs, read) */}
            <div className="glass-panel rounded-3xl p-6 sm:p-7">
              <div className="flex items-center gap-2.5 mb-4 pb-2 border-b border-border/40">
                <i className="fa-solid fa-comments text-[#1e7a4f] text-base" />
                <h3 className="font-bold text-foreground text-sm sm:text-base">พิมพ์คำถามตรงไปยัง AI Agent</h3>
              </div>

              <form onSubmit={handleSendGeneralQuestion} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-semibold text-foreground mb-1.5">เลือก Agent ผู้ช่วย</label>
                    <select
                      value={selectedChatAgent}
                      onChange={(e) => setSelectedChatAgent(e.target.value as AgentKey)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background/80 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#1e7a4f]"
                    >
                      <option value="plan">แผนการสอน (plan)</option>
                      <option value="pa">ธุรการและวิทยฐานะครู (pa)</option>
                      <option value="docs">เอกสารราชการ/ใบลา (docs)</option>
                      <option value="read">อ่านและสรุปหนังสือ (read)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-foreground mb-1.5">คำถามหรือข้อความที่ต้องการปรึกษา</label>
                    <input
                      type="text"
                      value={generalPrompt}
                      onChange={(e) => setGeneralPrompt(e.target.value)}
                      placeholder="เช่น ช่วยร่างบันทึกข้อความขออนุมัติจัดโครงการทัศนศึกษา..."
                      className="w-full px-4 py-2.5 rounded-xl bg-background/80 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#1e7a4f]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!generalPrompt.trim()}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#1e7a4f] text-white font-semibold text-sm hover:bg-[#17633f] transition shadow-md shadow-[#1e7a4f]/25 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-paper-plane text-xs" />
                  <span>ส่งคำถาม &amp; เปิดแชต</span>
                </button>
              </form>
            </div>

            {/* กล่องผลลัพธ์การคัดลอกของแท็บทั่วไป */}
            {generalPromptOutput && (
              <div className="bg-[#f0fdf4] border border-[#bbf7d0] dark:bg-emerald-950/20 dark:border-emerald-500/30 rounded-3xl p-6 sm:p-7 space-y-4 animate-fade-in-up shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs shrink-0">
                      <i className="fa-solid fa-check" />
                    </span>
                    <span>✅ คัดลอกคำสั่งแล้ว — กด Ctrl+V ในช่องแชต แล้วกด Enter</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        copyToClipboard(generalPromptOutput);
                        notifyCopied();
                      }}
                      className="px-3.5 py-1.5 rounded-xl border border-[#1e7a4f] text-[#1e7a4f] dark:text-emerald-400 dark:border-emerald-500 bg-white dark:bg-slate-900 text-xs font-semibold hover:bg-[#1e7a4f]/10 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <i className="fa-solid fa-copy" /> คัดลอกอีกครั้ง
                    </button>
                    <button
                      type="button"
                      onClick={() => openAgent(selectedChatAgent, generalPromptOutput)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#1e7a4f] text-white text-xs font-semibold hover:bg-[#17633f] transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square" /> เปิดหน้าต่างแชตอีกครั้ง
                    </button>
                  </div>
                </div>

                <div>
                  <textarea
                    readOnly
                    rows={3}
                    value={generalPromptOutput}
                    className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-emerald-200 dark:border-emerald-800 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-sans leading-relaxed focus:outline-none resize-y"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
