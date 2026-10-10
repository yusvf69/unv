import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Share2,
  Link2,
  Check,
  Facebook,
  X,
  Send,
  MessageCircle,
} from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

type ShareButtonsProps = {
  title: string;
  url?: string;
  description?: string;
  compact?: boolean;
  className?: string;
};

const t = {
  whatsapp: { ar: "واتساب", en: "WhatsApp" },
  telegram: { ar: "تيليجرام", en: "Telegram" },
  copyLink: { ar: "نسخ الرابط", en: "Copy link" },
  copied: { ar: "تم نسخ الرابط", en: "Link copied" },
  share: { ar: "مشاركة", en: "Share" },
  x: { ar: "إكس", en: "X" },
  facebook: { ar: "فيسبوك", en: "Facebook" },
  nativeShare: { ar: "النسخة العالمية للمشاركة", en: "Use native share sheet" },
} as const;

export default function ShareButtons({ title, url, description, compact, className }: ShareButtonsProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
  const shareText = [title, description].filter(Boolean).join("\n\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: t.copied[lang] });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.open(shareUrl, "_blank", "noopener,noreferrer");
    }
  };

  const nativeShare = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({ title, text: shareText, url: shareUrl });
    } catch {
      // user cancelled — ignore
    }
  };

  const open = (href: string) => window.open(href, "_blank", "noopener,noreferrer");

  const shared = `${shareText}\n\n${shareUrl}`;

  const buttons = [
    { key: "wa", icon: MessageCircle, label: t.whatsapp[lang], href: `https://wa.me/?text=${encodeURIComponent(shared)}` },
    { key: "tg", icon: Send, label: t.telegram[lang], href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shared)}` },
    { key: "x", icon: X, label: t.x[lang], href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shared)}` },
    { key: "fb", icon: Facebook, label: t.facebook[lang], href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` },
  ];

  const IconButton = ({ icon: Icon, label, href, onClick }: {
    icon: typeof Share2;
    label: string;
    href?: string;
    onClick?: () => void;
  }) => (
    <Button
      variant="outline"
      size={compact ? "icon" : "icon"}
      className="h-9 w-9 rounded-full"
      title={label}
      aria-label={label}
      onClick={() => {
        if (onClick) onClick();
        else if (href) open(href);
      }}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );

  return (
    <div className={`flex items-center gap-2 ${className || ""}`} role="group" aria-label={t.share[lang]}>
      {typeof navigator !== "undefined" && "share" in navigator && (
        <IconButton icon={Share2} label={t.nativeShare[lang]} onClick={nativeShare} />
      )}
      {buttons.map((b) => (
        <IconButton key={b.key} icon={b.icon} label={b.label} href={b.href} />
      ))}
      <IconButton
        icon={copied ? Check : Link2}
        label={t.copyLink[lang]}
        onClick={copy}
      />
    </div>
  );
}