import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { ImageDown, Loader2 } from "lucide-react";

type ShareResultImageProps = {
  quizTitle: string;
  score?: number;
  total?: number;
  percent?: number;
  points?: number;
  passed?: boolean;
  userName?: string | null;
  achievementTitle?: string;
  achievementSubtitle?: string;
  className?: string;
};

const t = {
  share: { ar: "شارك نتيجتك", en: "Share your result" },
  shareAchievement: { ar: "شارك الإنجاز", en: "Share achievement" },
  saved: { ar: "تم حفظ الصورة", en: "Image saved" },
  pass: { ar: "نجحت", en: "Passed" },
  fail: { ar: "للأسف ما نجحتش", en: "Failed" },
  points: { ar: "نقطة", en: "points" },
  made: { ar: "اتعمل من UniVerse", en: "Made on UniVerse" },
  msg: { ar: "شوف نتيجتي على UniVerse", en: "Check my result on UniVerse" },
  unlocked: { ar: "إنجاز جديد", en: "New achievement" },
} as const;

export default function ShareResultImage({ quizTitle, score = 0, total = 0, percent = 0, points = 0, passed = true, userName, achievementTitle, achievementSubtitle, className }: ShareResultImageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const draw = () => {
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const bg = ctx.createLinearGradient(0, 0, 1200, 630);
    bg.addColorStop(0, "#16a34a");
    bg.addColorStop(0.55, "#166534");
    bg.addColorStop(1, "#14532d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1200, 630);

    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 3;
    ctx.strokeRect(36, 36, 1128, 558);
    ctx.strokeRect(48, 48, 1104, 534);

    ctx.textAlign = "center";

    if (achievementTitle) {
      ctx.fillStyle = "#fde68a";
      ctx.font = "900 140px system-ui, sans-serif";
      ctx.fillText("★", 600, 240);
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "600 34px system-ui, sans-serif";
      ctx.fillText(t.unlocked[lang], 600, 305);
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 64px system-ui, sans-serif";
      ctx.fillText(achievementTitle.slice(0, 34), 600, 400);
      if (achievementSubtitle) {
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "500 30px system-ui, sans-serif";
        ctx.fillText(achievementSubtitle.slice(0, 44), 600, 460);
      }
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "800 44px system-ui, sans-serif";
      ctx.fillText("UniVerse", 600, 560);
      return canvas;
    }

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "800 44px system-ui, sans-serif";
    ctx.fillText("UniVerse", 600, 130);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "600 32px system-ui, sans-serif";
    ctx.fillText(quizTitle.slice(0, 48), 600, 190);

    if (userName) {
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "500 28px system-ui, sans-serif";
      ctx.fillText(userName, 600, 240);
    }

    ctx.fillStyle = passed ? "#bbf7d0" : "#fecaca";
    ctx.font = "700 40px system-ui, sans-serif";
    ctx.fillText(passed ? t.pass[lang] : t.fail[lang], 600, 320);

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 130px system-ui, sans-serif";
    ctx.fillText(`${percent}%`, 600, 425);

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "600 44px system-ui, sans-serif";
    ctx.fillText(`${score}/${total}`, 600, 490);

    if (points > 0) {
      ctx.fillStyle = "#fde68a";
      ctx.font = "700 34px system-ui, sans-serif";
      ctx.fillText(`+${points} ${t.points[lang]}`, 600, 545);
    }

    ctx.fillText(t.made[lang], 600, 585);
    return canvas;
  };

  const share = async () => {
    setBusy(true);
    try {
      const canvas = draw();
      if (!canvas) return;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
      if (!blob) throw new Error("no blob");
      const file = new File([blob], "universe-result.png", { type: "image/png" });
      if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `UniVerse - ${achievementTitle || quizTitle}`, text: t.msg[lang] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "universe-result.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast({ title: t.saved[lang] });
      }
    } catch {
      // user cancelled or error — ignore
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <canvas ref={canvasRef} className="hidden" />
      <Button variant="outline" onClick={share} disabled={busy} className={className}>
        {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <ImageDown className="me-2 h-4 w-4" />}
        {achievementTitle ? t.shareAchievement[lang] : t.share[lang]}
      </Button>
    </>
  );
}