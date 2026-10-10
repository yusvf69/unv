import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  sharePost: { ar: "مشاركة المنشور", en: "Share post" },
  x: { ar: "إكس", en: "X" },
  facebook: { ar: "فيسبوك", en: "Facebook" },
  nativeShare: { ar: "فتح قائمة المشاركة", en: "Open share sheet" },
} as const;

export default function ShareButtons({ title, url, description, compact, className }: ShareButtonsProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
  const shareText = [title, description].filter(Boolean).join("\n\n");
  const shared = `${shareText}\n\n${shareUrl}`;

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

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const openUrl = (href: string) => window.open(href, "_blank", "noopener,noreferrer");

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
      size="icon"
      className="h-9 w-9 rounded-full"
      title={label}
      aria-label={label}
      onClick={() => {
        if (onClick) onClick();
        else if (href) openUrl(href);
      }}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );

  const hasNative = typeof navigator !== "undefined" && "share" in navigator;

  const row = (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t.share[lang]}>
      {hasNative && (
        <IconButton icon={Share2} label={t.nativeShare[lang]} onClick={nativeShare} />
      )}
      {buttons.map((b) => (
        <IconButton key={b.key} icon={b.icon} label={b.label} href={b.href} />
      ))}
      <IconButton icon={copied ? Check : Link2} label={t.copyLink[lang]} onClick={copy} />
    </div>
  );

  if (compact) {
    return (
      <>
        <Button
          variant="outline"
          size="icon"
          className={`h-8 w-8 rounded-full bg-background/80 backdrop-blur ${className || ""}`}
          title={t.share[lang]}
          aria-label={t.share[lang]}
          onClick={(e) => {
            stop(e);
            setOpen(true);
          }}
        >
          <Share2 className="h-3.5 w-3.5" />
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Share2 className="h-4 w-4 text-primary" /> {t.sharePost[lang]}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm font-medium line-clamp-2">{title}</p>
            <div className="pt-1">{row}</div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className || ""}`} role="group" aria-label={t.share[lang]}>
      {hasNative && (
        <IconButton icon={Share2} label={t.nativeShare[lang]} onClick={nativeShare} />
      )}
      {buttons.map((b) => (
        <IconButton key={b.key} icon={b.icon} label={b.label} href={b.href} />
      ))}
      <IconButton icon={copied ? Check : Link2} label={t.copyLink[lang]} onClick={copy} />
    </div>
  );
}