import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Brain, Wheat, Timer, Star, RotateCcw, Play, Sprout, Beaker } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, useGameLeaderboard } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const ICONS_FULL = ["🌱","🌾","🌻","🌽","🍅","🥕","🍇","🌿","🍎","🌶️","🥒","🥦","🍓","🍑","🌳","🍃"];

function MemoryMatch({ onScore }: { onScore: (s: number) => void }) {
  const [size, setSize] = useState(8);
  const [cards, setCards] = useState<{ id: number; icon: string; flipped: boolean; matched: boolean }[]>([]);
  const [first, setFirst] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [start, setStart] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const init = (n: number = size) => {
    const pool = [...ICONS_FULL].sort(() => Math.random() - 0.5).slice(0, n);
    const deck = [...pool, ...pool].sort(() => Math.random() - 0.5).map((icon, i) => ({ id: i, icon, flipped: false, matched: false }));
    setCards(deck); setFirst(null); setMoves(0); setStart(Date.now()); setDone(false);
  };

  useEffect(() => { init(size); }, [size]);

  const flip = (id: number) => {
    if (done) return;
    const c = cards[id];
    if (c.flipped || c.matched) return;
    const next = cards.map((x) => (x.id === id ? { ...x, flipped: true } : x));
    setCards(next);
    if (first === null) setFirst(id);
    else {
      setMoves((m) => m + 1);
      const a = next[first], b = next[id];
      if (a.icon === b.icon) {
        setTimeout(() => { setCards((cur) => cur.map((x) => (x.id === a.id || x.id === b.id ? { ...x, matched: true } : x))); setFirst(null); }, 300);
      } else {
        setTimeout(() => { setCards((cur) => cur.map((x) => (x.id === a.id || x.id === b.id ? { ...x, flipped: false } : x))); setFirst(null); }, 700);
      }
    }
  };

  useEffect(() => {
    if (cards.length && cards.every((c) => c.matched) && !done) {
      setDone(true);
      const dur = Date.now() - (start ?? 0);
      const score = Math.max(50, size * 100 - moves * 15 - Math.floor(dur / 1000) * 2);
      onScore(score);
    }
  }, [cards, done]);

  const cols = size <= 6 ? 4 : size <= 10 ? 4 : 5;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2 text-sm">
          <span className="bg-primary/10 px-3 py-1 rounded-full font-bold">حركات: {moves}</span>
          <span className="bg-accent/30 px-3 py-1 rounded-full font-bold">{cards.filter((c) => c.matched).length / 2}/{size}</span>
        </div>
        <div className="flex gap-1">
          {[6, 8, 12].map((s) => (
            <Button key={s} size="sm" variant={size === s ? "default" : "outline"} onClick={() => setSize(s)}>{s}</Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => init()}><RotateCcw className="h-3 w-3" /></Button>
        </div>
      </div>
      <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {cards.map((c) => (
          <motion.button
            key={c.id}
            onClick={() => flip(c.id)}
            whileTap={{ scale: 0.95 }}
            className={`aspect-square rounded-2xl text-3xl md:text-4xl flex items-center justify-center font-bold transition-all ${
              c.matched ? "bg-emerald-200 text-emerald-900 border-2 border-emerald-400"
              : c.flipped ? "bg-primary/15 border-2 border-primary"
              : "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md"}`}
          >{c.flipped || c.matched ? c.icon : "?"}</motion.button>
        ))}
      </div>
      {done && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-6">
          <Trophy className="h-12 w-12 mx-auto text-amber-500" />
          <div className="text-2xl font-bold mt-2">ممتاز!</div>
          <div className="text-sm">{moves} حركة · اضغط الحجم لإعادة اللعب</div>
        </motion.div>
      )}
    </div>
  );
}

// ===== Huge non-repeating question pool =====
const QUIZ_POOL = [
  { q: "ما الوحدة الأساسية لقوام التربة؟", options: ["الرمل", "الجسيمات الأولية", "الحصى", "المياه"], a: 1 },
  { q: "ما العنصر الأساسي للنمو الخضري؟", options: ["الحديد", "النيتروجين", "الزنك", "البورون"], a: 1 },
  { q: "أي حساس يقيس رطوبة التربة؟", options: ["LDR", "Soil moisture", "MQ-2", "Ultrasonic"], a: 1 },
  { q: "أعلى استفادة من الري بالتنقيط:", options: ["تبخير عالي", "كفاءة 90%", "جفاف", "تربة ملحية"], a: 1 },
  { q: "أكبر منتج للقمح في العالم؟", options: ["مصر", "الصين", "أمريكا", "روسيا"], a: 1 },
  { q: "أهم مرض فطري للأرز:", options: ["لفحة الأرز", "صدأ القمح", "البياض الزغبي", "تبقع"], a: 0 },
  { q: "ما هو تركيز ملوحة التربة المرتفعة (dS/m)؟", options: ["< 2", "2 - 4", "4 - 8", "> 8"], a: 3 },
  { q: "العنصر الأساسي لتكوين البروتينات في النبات:", options: ["الكربون", "النيتروجين", "البوتاسيوم", "الكالسيوم"], a: 1 },
  { q: "أي مما يلي يستخدم لمكافحة الحشائش بيولوجياً؟", options: ["بكتيريا", "حشرات نافعة", "نباتات منافسة", "كل ما سبق"], a: 3 },
  { q: "نسبة الرطوبة في التربة الحقلية المثالية:", options: ["10-15%", "20-30%", "40-50%", "60-70%"], a: 1 },
  { q: "أي مبيد يستخدم ضد الحشائش؟", options: ["مبيد فطري", "مبيد عشبي", "مبيد حشري", "مبيد قارض"], a: 1 },
  { q: "أهم مصدر للماء في الزراعة المصرية:", options: ["الأمطار", "النيل", "الآبار الجوفية", "تحلية المياه"], a: 1 },
  { q: "ما الفصيلة التي ينتمي لها فول الصويا؟", options: ["النجيلية", "البقولية", "العلفية", "الزيتية"], a: 1 },
  { q: "ماذا يحدث للنبات عند نقص الحديد؟", options: ["إصفرار حديث الأوراق", "ذبول", "تساقط الأزهار", "تشقق الثمار"], a: 0 },
  { q: "كم رتبة تصنيفية تتبعها فصيلة المحاصيل النباتية؟", options: ["3", "5", "7", "9"], a: 2 },
  { q: "أي طريقة الري تقلل التبخر بشكل كبير؟", options: ["السطحي", "الرش", "التنقيط", "الغمر"], a: 2 },
  { q: "ما المحصول الذي يحتاج تربة طينية؟", options: ["الأرز", "البطاطس", "الفول السوداني", "البطيخ"], a: 0 },
  { q: "أي عنصر مسؤول عن نضج الثمار؟", options: ["النيتروجين", "البوتاسيوم", "الفوسفور", "المغنيسيوم"], a: 1 },
  { q: "أكثر آفة تصيب القمح؟", options: ["المن", "الجراد", "الفئران", "الديدان"], a: 0 },
  { q: "ما هو pH التربة المثالي لمعظم المحاصيل؟", options: ["3.0-4.0", "5.5-7.0", "8.0-9.0", "10-11"], a: 1 },
  { q: "ما الجزء النباتي المستهلك في الجزر؟", options: ["الجذر", "الساق", "الورقة", "الزهرة"], a: 0 },
  { q: "أي تقنية حديثة تستخدم لتحسين المحاصيل؟", options: ["CRISPR", "Photoshop", "AutoCAD", "Word"], a: 0 },
  { q: "ما المشتقات الزراعية للذرة؟", options: ["زيت + نشا + علف", "أرز + قمح", "خضروات", "زهور"], a: 0 },
  { q: "أي حشرة تنقل مرض اللفحة المتأخرة؟", options: ["المن", "الذبابة البيضاء", "البق الدقيقي", "العنكبوت"], a: 1 },
  { q: "ما لون الأوراق عند نقص الفوسفور؟", options: ["أصفر", "أرجواني", "بني", "أبيض"], a: 1 },
  { q: "ما اسم العملية التي تثبت النيتروجين في التربة؟", options: ["النترتة", "الأمونتة", "التثبيت الحيوي", "كل ما سبق"], a: 3 },
  { q: "أي محصول يستخدم في إنتاج السكر؟", options: ["البنجر", "البصل", "الفول", "اللوبيا"], a: 0 },
  { q: "ما هو هدف عملية التقليم في الأشجار؟", options: ["زيادة الإنتاج", "تشكيل الشجرة", "تحسين الإضاءة", "كل ما سبق"], a: 3 },
  { q: "أين تُخزّن الحبوب بأفضل طريقة؟", options: ["مكان رطب دافئ", "مكان جاف بارد", "في الشمس", "تحت الأرض"], a: 1 },
  { q: "كم سنة تحتاج شجرة الزيتون لتثمر؟", options: ["1-2", "3-5", "7-10", "15"], a: 1 },
];

function PlantQuiz({ onScore }: { onScore: (s: number) => void }) {
  const N = 10;
  const [pool, setPool] = useState<typeof QUIZ_POOL>(() => [...QUIZ_POOL].sort(() => Math.random() - 0.5).slice(0, N));
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const choose = (idx: number) => {
    if (picked !== null) return;
    setPicked(idx);
    if (idx === pool[i].a) setScore((s) => s + 100);
    setTimeout(() => {
      if (i + 1 < pool.length) { setI(i + 1); setPicked(null); }
      else { setDone(true); onScore(score + (idx === pool[i].a ? 100 : 0)); }
    }, 800);
  };

  const reset = () => {
    setPool([...QUIZ_POOL].sort(() => Math.random() - 0.5).slice(0, N));
    setI(0); setPicked(null); setScore(0); setDone(false);
  };

  if (done) {
    return (
      <div className="text-center py-12">
        <Trophy className="h-16 w-16 mx-auto text-amber-500" />
        <div className="text-3xl font-bold mt-3">{score} نقطة</div>
        <p className="text-sm text-muted-foreground mt-1">{score / 100} إجابة صحيحة من {N}</p>
        <Button onClick={reset} className="mt-4"><RotateCcw className="me-2 h-4 w-4" /> أسئلة جديدة</Button>
      </div>
    );
  }

  const q = pool[i];
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-sm">
        <span className="bg-primary/10 px-3 py-1 rounded-full font-bold">سؤال {i + 1}/{N}</span>
        <span className="bg-accent/30 px-3 py-1 rounded-full font-bold">{score} نقطة</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div className="h-full bg-gradient-to-r from-primary to-secondary" initial={{ width: 0 }} animate={{ width: `${((i + 1) / N) * 100}%` }} />
      </div>
      <motion.div key={i} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} className="bg-card border-2 border-primary/15 rounded-2xl p-6">
        <h3 className="text-xl font-bold mb-4">{q.q}</h3>
        <div className="space-y-2">
          {q.options.map((opt, idx) => {
            const isCorrect = picked !== null && idx === q.a;
            const isWrong = picked === idx && idx !== q.a;
            return (
              <button key={idx} onClick={() => choose(idx)} disabled={picked !== null}
                className={`w-full text-start p-3 rounded-xl border-2 transition-all ${
                  isCorrect ? "bg-emerald-100 border-emerald-400 text-emerald-900"
                  : isWrong ? "bg-rose-100 border-rose-400 text-rose-900"
                  : "border-border hover:border-primary/40 hover:bg-primary/5"}`}>
                {opt}
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

function HarvestRun({ onScore }: { onScore: (s: number) => void }) {
  const [pos, setPos] = useState(50);
  const [crops, setCrops] = useState<{ id: number; x: number; y: number; type: "good" | "bad" }[]>([]);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(30);
  const [running, setRunning] = useState(false);
  const posRef = useRef(50);
  posRef.current = pos;

  useEffect(() => { if (!running) return; const id = setInterval(() => setTime((t) => t - 1), 1000); return () => clearInterval(id); }, [running]);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setCrops((c) => {
        const moved = c.map((x) => ({ ...x, y: x.y + 8 })).filter((x) => x.y < 100);
        const collected: typeof c = [];
        for (const cr of moved) {
          if (cr.y > 80 && Math.abs(cr.x - posRef.current) < 15) {
            setScore((s) => s + (cr.type === "good" ? 50 : -30));
          } else collected.push(cr);
        }
        if (Math.random() < 0.4) collected.push({ id: Date.now() + Math.random(), x: Math.random() * 90 + 5, y: 0, type: Math.random() < 0.75 ? "good" : "bad" });
        return collected;
      });
    }, 200);
    return () => clearInterval(id);
  }, [running]);
  useEffect(() => { if (time <= 0 && running) { setRunning(false); onScore(Math.max(score, 0)); } }, [time, running, score]);

  const start = () => { setScore(0); setTime(30); setCrops([]); setPos(50); setRunning(true); };

  return (
    <div>
      <div className="flex items-center justify-between mb-3 text-sm">
        <span className="bg-primary/10 px-3 py-1 rounded-full font-bold flex items-center gap-1.5"><Star className="h-4 w-4" /> {score}</span>
        <span className="bg-accent/30 px-3 py-1 rounded-full font-bold flex items-center gap-1.5"><Timer className="h-4 w-4" /> {Math.max(time, 0)}s</span>
      </div>
      <div className="relative w-full h-96 bg-gradient-to-b from-sky-100 via-amber-50 to-amber-200 rounded-2xl overflow-hidden border-2 border-amber-300"
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPos(((e.clientX - r.left) / r.width) * 100); }}
        onTouchMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPos(((e.touches[0].clientX - r.left) / r.width) * 100); }}>
        {crops.map((c) => (
          <div key={c.id} className="absolute text-3xl" style={{ left: `${c.x}%`, top: `${c.y}%`, transform: "translate(-50%, -50%)" }}>{c.type === "good" ? "🌾" : "🦗"}</div>
        ))}
        <div className="absolute bottom-2 text-4xl" style={{ left: `${pos}%`, transform: "translateX(-50%)" }}>🧺</div>
        {!running && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Button size="lg" onClick={start} className="bg-gradient-to-r from-primary to-secondary"><Play className="me-2 h-5 w-5" /> {time === 0 ? "أعد" : "ابدأ"}</Button>
          </div>
        )}
      </div>
      <div className="text-xs text-muted-foreground mt-2 text-center">حرّك بالماوس/الأصبع — اجمع 🌾 وتجنّب 🦗</div>
    </div>
  );
}

// New game: Plant Identification (image-emoji based)
const PLANTS = [
  { emoji: "🌽", name: "الذرة", options: ["الذرة", "القمح", "الأرز", "الشعير"] },
  { emoji: "🌾", name: "القمح", options: ["البرسيم", "القمح", "الفول", "العنب"] },
  { emoji: "🍅", name: "الطماطم", options: ["الفلفل", "الطماطم", "الباذنجان", "الكوسة"] },
  { emoji: "🥕", name: "الجزر", options: ["البصل", "البطاطس", "الجزر", "الفجل"] },
  { emoji: "🌻", name: "عباد الشمس", options: ["الياسمين", "الورد", "عباد الشمس", "النرجس"] },
  { emoji: "🍇", name: "العنب", options: ["العنب", "التوت", "الفراولة", "الكرز"] },
  { emoji: "🌶️", name: "الفلفل الحار", options: ["الفلفل الرومي", "الفلفل الحار", "الكوسة", "الباذنجان"] },
  { emoji: "🍓", name: "الفراولة", options: ["التوت", "العنب", "الفراولة", "التفاح"] },
  { emoji: "🥦", name: "البروكلي", options: ["الكرنب", "البروكلي", "الخس", "السبانخ"] },
  { emoji: "🥒", name: "الخيار", options: ["الكوسة", "الخيار", "الباذنجان", "البطيخ"] },
  { emoji: "🍑", name: "الخوخ", options: ["المشمش", "الخوخ", "البرقوق", "الكرز"] },
  { emoji: "🌳", name: "الزيتون", options: ["النخيل", "الزيتون", "البلوط", "السرو"] },
];

function PlantIdGame({ onScore }: { onScore: (s: number) => void }) {
  const N = 10;
  const [pool, setPool] = useState(() => [...PLANTS].sort(() => Math.random() - 0.5).slice(0, N));
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const choose = (opt: string) => {
    if (picked) return;
    setPicked(opt);
    const correct = opt === pool[i].name;
    if (correct) setScore((s) => s + 80);
    setTimeout(() => {
      if (i + 1 < pool.length) { setI(i + 1); setPicked(null); }
      else { setDone(true); onScore(score + (correct ? 80 : 0)); }
    }, 700);
  };

  const reset = () => {
    setPool([...PLANTS].sort(() => Math.random() - 0.5).slice(0, N));
    setI(0); setPicked(null); setScore(0); setDone(false);
  };

  if (done) {
    return (
      <div className="text-center py-12">
        <Trophy className="h-16 w-16 mx-auto text-amber-500" />
        <div className="text-3xl font-bold mt-3">{score} نقطة</div>
        <Button onClick={reset} className="mt-4"><RotateCcw className="me-2 h-4 w-4" /> ابدأ من جديد</Button>
      </div>
    );
  }

  const p = pool[i];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="bg-primary/10 px-3 py-1 rounded-full font-bold">{i + 1}/{N}</span>
        <span className="bg-accent/30 px-3 py-1 rounded-full font-bold">{score} نقطة</span>
      </div>
      <motion.div key={i} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center bg-gradient-to-br from-emerald-50 to-amber-50 dark:from-emerald-950/30 dark:to-amber-950/30 border-2 border-primary/15 rounded-3xl py-12">
        <div className="text-9xl">{p.emoji}</div>
      </motion.div>
      <div className="grid grid-cols-2 gap-2">
        {p.options.map((opt) => {
          const isCorrect = picked && opt === p.name;
          const isWrong = picked === opt && opt !== p.name;
          return (
            <button key={opt} onClick={() => choose(opt)} disabled={!!picked}
              className={`p-3 rounded-xl border-2 font-bold text-sm transition ${
                isCorrect ? "bg-emerald-100 border-emerald-400 text-emerald-900"
                : isWrong ? "bg-rose-100 border-rose-400 text-rose-900"
                : "border-border hover:border-primary/40 hover:bg-primary/5"}`}>{opt}</button>
          );
        })}
      </div>
    </div>
  );
}

// New game: Soil pH balance (target a value within range)
function SoilPhGame({ onScore }: { onScore: (s: number) => void }) {
  const [target, setTarget] = useState(() => 5 + Math.random() * 3);
  const [val, setVal] = useState(7);
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const N = 8;

  const lock = () => {
    const diff = Math.abs(val - target);
    const points = Math.max(0, Math.round(150 - diff * 80));
    setScore((s) => s + points);
    if (round >= N) {
      setDone(true);
      onScore(score + points);
    } else {
      setRound((r) => r + 1);
      setTarget(5 + Math.random() * 3);
      setVal(7);
    }
  };

  const reset = () => { setTarget(5 + Math.random() * 3); setVal(7); setRound(1); setScore(0); setDone(false); };

  if (done) {
    return (
      <div className="text-center py-12">
        <Beaker className="h-16 w-16 mx-auto text-emerald-500" />
        <div className="text-3xl font-bold mt-3">{score} نقطة</div>
        <p className="text-sm text-muted-foreground mt-1">عبر {N} جولات pH</p>
        <Button onClick={reset} className="mt-4"><RotateCcw className="me-2 h-4 w-4" /> أعد</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm">
        <span className="bg-primary/10 px-3 py-1 rounded-full font-bold">جولة {round}/{N}</span>
        <span className="bg-accent/30 px-3 py-1 rounded-full font-bold">{score} نقطة</span>
      </div>
      <div className="bg-card border-2 border-primary/15 rounded-3xl p-6 text-center">
        <p className="text-sm text-muted-foreground">اضبط رقم الـ pH ليطابق هدف:</p>
        <div className="text-5xl font-bold text-primary mt-2 tabular-nums">{target.toFixed(2)}</div>
        <div className="mt-8">
          <div className="text-7xl font-bold tabular-nums" style={{ color: `hsl(${(val - 4) * 30}, 70%, 45%)` }}>{val.toFixed(2)}</div>
          <input type="range" min={3} max={10} step={0.05} value={val} onChange={(e) => setVal(Number(e.target.value))} className="w-full mt-4 accent-primary" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>3 (حمضي)</span><span>7 (متعادل)</span><span>10 (قاعدي)</span>
          </div>
        </div>
        <Button onClick={lock} size="lg" className="mt-6 bg-gradient-to-r from-primary to-secondary">تثبيت</Button>
      </div>
    </div>
  );
}

const GAMES = [
  { key: "soil_match", label: "ذاكرة المحاصيل", icon: Brain, Comp: MemoryMatch },
  { key: "plant_quiz", label: "تحدي النباتات", icon: Wheat, Comp: PlantQuiz },
  { key: "harvest_run", label: "سباق الحصاد", icon: Trophy, Comp: HarvestRun },
  { key: "plant_id", label: "تعرّف على النبات", icon: Sprout, Comp: PlantIdGame },
  { key: "soil_ph", label: "موازنة pH", icon: Beaker, Comp: SoilPhGame },
];

export default function Games() {
  const [tab, setTab] = useState(GAMES[0].key);
  const { data: lb } = useGameLeaderboard(tab);
  const { toast } = useToast();
  const qc = useQueryClient();

  const submitScore = async (gameKey: string, score: number) => {
    try {
      await api.post("/v2/games/score", { gameKey, score });
      toast({ title: `+${Math.floor(score / 10)} نقطة في حسابك!`, description: `سجلت ${score} في اللعبة.` });
      qc.invalidateQueries({ queryKey: ["v2", "games", "leaderboard"] });
      qc.invalidateQueries({ queryKey: ["v2", "me"] });
      qc.invalidateQueries({ queryKey: ["v2", "achievements"] });
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="text-center mb-8">
        <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl font-serif font-bold bg-gradient-to-r from-primary via-secondary to-accent-foreground bg-clip-text text-transparent">ساحة الألعاب</motion.h1>
        <p className="text-muted-foreground mt-2">٥ ألعاب · أسئلة لا تتكرر · نقاط تُضاف لرصيدك</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 md:grid-cols-5 max-w-3xl mx-auto h-auto p-1">
          {GAMES.map((g) => (
            <TabsTrigger key={g.key} value={g.key} className="flex flex-col items-center gap-1 py-3">
              <g.icon className="h-5 w-5" />
              <span className="text-[11px]">{g.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="grid lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2">
            {GAMES.map((g) => (
              <TabsContent key={g.key} value={g.key} className="bg-card rounded-3xl p-6 border-2 border-border shadow-lg shadow-primary/5">
                <g.Comp onScore={(s) => submitScore(g.key, s)} />
              </TabsContent>
            ))}
          </div>
          <div className="bg-card border-2 border-border rounded-3xl p-5 h-fit">
            <h3 className="font-bold mb-3 flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> أعلى النتائج</h3>
            <div className="space-y-2">
              <AnimatePresence>
                {(lb ?? []).slice(0, 10).map((r, i) => (
                  <motion.div key={r.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-2 p-2 rounded-xl">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-amber-200 text-amber-900" : i < 3 ? "bg-primary/15 text-primary" : "bg-muted"}`}>{i + 1}</div>
                    {r.userAvatar ? <img src={r.userAvatar} className="w-7 h-7 rounded-full object-cover" /> : <div className="w-7 h-7 rounded-full bg-primary/10" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate">{r.userName}</div>
                      {r.groupName && <div className="text-[10px] text-muted-foreground">G{r.groupName}</div>}
                    </div>
                    <div className="text-sm font-bold tabular-nums">{r.score}</div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {(!lb || lb.length === 0) && <div className="text-xs text-muted-foreground text-center py-4">لم تُسجل نتائج بعد.</div>}
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
