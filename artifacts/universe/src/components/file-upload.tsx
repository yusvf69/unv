import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileMeta { name: string; type: string; size: number }
interface Props {
  value: string | null;
  onChange: (dataUrl: string | null, meta?: FileMeta) => void;
  accept?: string;
  maxSizeKb?: number;
  label?: string;
  imageOnly?: boolean;
  className?: string;
}

export default function FileUpload({
  value,
  onChange,
  accept = "image/*",
  maxSizeKb = 800,
  label = "اختر ملف من جهازك",
  imageOnly = true,
  className = "",
}: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handle(file: File) {
    setErr(null);
    setBusy(true);
    try {
      const meta: FileMeta = { name: file.name, type: file.type, size: file.size };
      // For images, attempt to compress via canvas for size
      if (imageOnly && file.type.startsWith("image/")) {
        const dataUrl = await compressImage(file, 1200, 1200, 0.82);
        const sizeKb = Math.ceil((dataUrl.length * 3) / 4 / 1024);
        if (sizeKb > maxSizeKb) {
          // try harder
          const smaller = await compressImage(file, 800, 800, 0.7);
          onChange(smaller, meta);
        } else {
          onChange(dataUrl, meta);
        }
      } else {
        const dataUrl = await readAsDataUrl(file);
        const sizeKb = Math.ceil((dataUrl.length * 3) / 4 / 1024);
        if (sizeKb > maxSizeKb) {
          setErr(`الملف كبير (${sizeKb} كيلوبايت). الحد الأقصى ${maxSizeKb}.`);
          return;
        }
        onChange(dataUrl, meta);
      }
    } catch (e: any) {
      setErr(e?.message || "فشل تحميل الملف");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handle(f);
        }}
      />
      {value ? (
        <div className="relative">
          {imageOnly ? (
            <img src={value} alt="uploaded" className="rounded-xl w-full max-h-64 object-cover border" />
          ) : (
            <div className="rounded-xl border p-4 text-sm bg-muted/30">ملف محمّل</div>
          )}
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 end-2 h-8 w-8 rounded-full"
            onClick={() => onChange(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full h-32 border-2 border-dashed flex flex-col items-center justify-center gap-2"
          onClick={() => ref.current?.click()}
          disabled={busy}
        >
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
          <span className="text-sm">{label}</span>
          <span className="text-xs text-muted-foreground">حد أقصى {maxSizeKb} كيلوبايت</span>
        </Button>
      )}
      {err && <p className="text-xs text-destructive mt-2">{err}</p>}
    </div>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("فشل قراءة الملف"));
    r.readAsDataURL(file);
  });
}

async function compressImage(file: File, maxW: number, maxH: number, quality: number): Promise<string> {
  const dataUrl = await readAsDataUrl(file);
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("صورة غير صالحة"));
    img.src = dataUrl;
  });
  let { width, height } = img;
  const ratio = Math.min(maxW / width, maxH / height, 1);
  width = Math.round(width * ratio);
  height = Math.round(height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}
