/**
 * ai-assistant.ts
 * โมดูลเชื่อมต่อ AI Agent ของ LangMind ผ่านลิงก์แชตสาธารณะ (Public Chat)
 * สำหรับระบบ EduConnect360 (ไม่ใช้ API / ไม่ใช้ iframe)
 */

export type AgentKey = "plan" | "pa" | "docs" | "read" | "parent";

export const AGENT_LINKS: Record<AgentKey, string> = {
  plan: "https://langmind.in.th/public/agents/8cf30138-5ec2-4ea2-93ce-2d13b9f688df/chat",
  pa: "https://langmind.in.th/public/agents/24dbc471-50f6-4f16-903c-4b308caf5324/chat",
  docs: "https://langmind.in.th/public/agents/6ad34cd6-4679-4cd2-8621-190f42b1eb27/chat",
  read: "https://langmind.in.th/public/agents/0104e3b5-bf8b-4415-b1b0-4be7db3e249c/chat",
  parent: "https://langmind.in.th/public/agents/9c20dbb2-3577-4bb4-845a-8531a1270830/chat",
};

/**
 * คัดลอกข้อความลงคลิปบอร์ด (Clipboard API พร้อม Fallback ด้วย textarea + execCommand)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. ลองใช้ Modern Clipboard API
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("navigator.clipboard.writeText failed, using fallback:", err);
    }
  }

  // 2. Fallback: สร้าง textarea ชั่วคราวแล้ว document.execCommand('copy')
  if (typeof document !== "undefined") {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "-9999px";
      textarea.style.left = "-9999px";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);
      return successful;
    } catch (fallbackErr) {
      console.error("execCommand fallback copy failed:", fallbackErr);
      return false;
    }
  }

  return false;
}

/**
 * เปิดหน้าต่างแชต LangMind Agent
 * บน Desktop: เปิดเป็น Popup ด้านขวา กว้าง 460px สูงเกือบเต็มจอ
 * บนมือถือหรือกรณี Popup โดนบล็อก: fallback เปิดในแท็บใหม่ด้วย noopener
 */
export async function openAgent(key: AgentKey, promptText?: string): Promise<void> {
  const url = AGENT_LINKS[key] || AGENT_LINKS.plan;

  // คัดลอกข้อความคำสั่งลงคลิปบอร์ดก่อนเปิดหน้าต่างแชต
  if (promptText) {
    await copyToClipboard(promptText);
  }

  if (typeof window === "undefined") return;

  const isMobile =
    window.innerWidth < 768 ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  if (isMobile) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  // คำนวณขนาดและตำแหน่ง Popup ด้านขวาของจอ (กว้าง 460px สูงเกือบเต็มจอ)
  const width = 460;
  const availHeight = window.screen ? window.screen.availHeight : window.innerHeight;
  const height = Math.max(600, availHeight - 80);
  const availWidth = window.screen ? window.screen.availWidth : window.innerWidth;
  const left = Math.max(0, availWidth - width - 20);
  const top = 40;

  const windowFeatures = [
    `width=${width}`,
    `height=${height}`,
    `top=${top}`,
    `left=${left}`,
    "resizable=yes",
    "scrollbars=yes",
    "status=no",
    "toolbar=no",
    "menubar=no",
  ].join(",");

  try {
    const popup = window.open(url, `langmind_agent_${key}`, windowFeatures);
    if (!popup || popup.closed || typeof popup.closed === "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      popup.focus();
    }
  } catch (err) {
    console.warn("Popup blocked, fallback to new tab:", err);
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
