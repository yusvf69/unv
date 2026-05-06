import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import { PDFDocument } from "pdf-lib";

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
      
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const compressedUrl = await compressPdf(file, maxSizeKb);
        onChange(compressedUrl, { ...meta, size: Math.ceil((compressedUrl.length * 3) / 4) });
        return;
      }

      if (imageOnly && file.type.startsWith("image/")) {
        const dataUrl = await compressImage(file, 1200, 1200, 0.82);
        const sizeKb = Math.ceil((dataUrl.length * 3) / 4 / 1024);
        if (sizeKb > maxSizeKb) {
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
          <span className="text-xs text-muted-foreground">يتم ضغط PDF تلقائياً</span>
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

async function compressPdf(file: File, targetMaxKb: number): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;
  const pdfDoc = await getDocument({ data: arrayBuffer }).promise;
  const numPages = pdfDoc.numPages;

  const newPdf = await PDFDocument.create();
  
  let quality = 0.5;
  let scale = 1.5;
  let result: Uint8Array | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const tempPdf = await PDFDocument.create();
    
    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale });
      
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      
      await page.render({ canvasContext: ctx, viewport }).promise;
      
      const jpegDataUrl = canvas.toDataURL("image/jpeg", quality);
      const jpegBase64 = jpegDataUrl.split(",")[1];
      const jpegBytes = Uint8Array.from(atob(jpegBase64), c => c.charCodeAt(0));
      
      const jpegImage = await tempPdf.embedJpg(jpegBytes);
      const newPage = tempPdf.addPage([viewport.width, viewport.height]);
      newPage.drawImage(jpegImage, {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
      });
    }

    result = await tempPdf.save();
    const sizeKb = result.length / 1024;
    
    if (sizeKb <= targetMaxKb) break;
    
    quality = Math.max(0.2, quality - 0.15);
    scale = Math.max(0.8, scale - 0.4);
  }

  if (!result) throw new Error("فشل ضغط الملف");

  const base64 = btoa(String.fromCharCode(...result));
  return `data:application/pdf;base64,${base64}`;
}
