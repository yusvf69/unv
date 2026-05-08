import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Leaf, Mail, Phone, User, Loader2, CheckCircle2, Shield, GraduationCap, Sprout, Eye, EyeOff, AlertCircle, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import FileUpload from "@/components/file-upload";

const SPECIALIZATIONS = [
  "شعبه عامه",
  "علوم التربة والمياه",
  "الإنتاج النباتي",
  "الإنتاج الحيواني",
  "الهندسة الزراعية",
  "التكنولوجيا الحيوية",
  "علوم الأغذية",
  "الاقتصاد الزراعي",
  "وقاية النبات",
];
const YEARS = [1, 2, 3, 4];
const GROUPS = ["عام", "A", "B", "C", "D", "E"];

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [yearInCollege, setYearInCollege] = useState<number>(1);
  const [specialization, setSpecialization] = useState(SPECIALIZATIONS[0]);
  const [groupName, setGroupName] = useState("A");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [usernameStatus, setUsernameStatus] = useState<{ checking: boolean; available: boolean; reason?: string; suggestions?: string[] }>({ checking: false, available: false });

  // Verification state
  const [verifyStep, setVerifyStep] = useState<"idle" | "sending" | "sent" | "verifying" | "done">("idle");
  const [emailCode, setEmailCode] = useState("");
  const [whatsappCode, setWhatsappCode] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [existingUserError, setExistingUserError] = useState<string | null>(null);

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<"identifier" | "code" | "newPassword">("identifier");
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const checkUsername = useCallback(async (un: string) => {
    if (un.length < 4) {
      setUsernameStatus({ checking: false, available: false, reason: un.length > 0 ? "اليوزر لازم يكون 4 حروف على الأقل" : undefined });
      return;
    }
    setUsernameStatus({ checking: true, available: false });
    try {
      const res = await fetch(`/api/v2/auth/username-available?username=${encodeURIComponent(un)}`);
      const data = await res.json();
      setUsernameStatus({ checking: false, available: data.available, reason: data.reason, suggestions: data.suggestions });
    } catch {
      setUsernameStatus({ checking: false, available: false, reason: "حدث خطأ في التحقق" });
    }
  }, []);

  const submitSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !username || !email || !phone || !password) {
      toast({ title: "املأ كل الحقول", variant: "destructive" });
      return;
    }
    if (username.length < 4) {
      toast({ title: "اليوزر لازم يكون 4 حروف على الأقل", variant: "destructive" });
      return;
    }
    if (!usernameStatus.available) {
      toast({ title: usernameStatus.reason || "اختار يوزر متاح", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "كلمة المرور لازم تكون 6 حروف على الأقل", variant: "destructive" });
      return;
    }

    if (verifyStep === "idle") {
      setVerifyStep("sending");
      try {
        const checkRes = await fetch("/api/v2/auth/check-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, phone }),
        });
        const checkData = await checkRes.json();
        if (checkData.exists) {
          setVerifyStep("idle");
          const field = checkData.field === "email" ? "البريد الإلكتروني" : "رقم الهاتف";
          setExistingUserError(`${field} مسجل بالفعل. سجل دخول بدلاً من ذلك.`);
          return;
        }

        const res = await fetch("/api/v2/auth/send-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, phone }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "فشل الإرسال");
        setVerifyStep("sent");
        setExistingUserError(null);
        toast({ title: "تم الإرسال", description: "تحقق من بريدك وواتساب" });
      } catch (err) {
        setVerifyStep("idle");
        toast({ title: "خطأ", description: (err as Error).message, variant: "destructive" });
      }
      return;
    }

    if (verifyStep === "sent" || verifyStep === "done") {
      if (verifyStep === "sent") {
        setVerifyStep("verifying");
        try {
          const code = emailCode || whatsappCode;
          if (!code) throw new Error("أدخل الكود");
          const res = await fetch("/api/v2/auth/verify-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, phone, code }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "الكود غلط");
          setVerifyStep("done");
          toast({ title: "تم التأكيد", description: "الكود صحيح، هنسجل حسابك دلوقتي" });
        } catch (err) {
          setVerifyStep("sent");
          toast({ title: "خطأ", description: (err as Error).message, variant: "destructive" });
          return;
        }
      }

      try {
        const res = await fetch("/api/v2/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, username, email, phone, password, yearInCollege, specialization, groupName, avatarUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message);
        if (data.token) localStorage.setItem("uv_token", data.token);
        queryClient.invalidateQueries();
        setDone(true);
        toast({ title: `أهلاً ${name}`, description: "تم إنشاء حسابك بنجاح" });
        setTimeout(() => setLocation("/"), 900);
      } catch (err) {
        toast({ title: "خطأ", description: (err as Error).message, variant: "destructive" });
      }
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    try {
      const res = await fetch("/api/v2/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل");
      toast({ title: "تم إعادة الإرسال", description: "تحقق من بريدك وواتساب" });
      setResendTimer(60);
      const interval = setInterval(() => {
        setResendTimer(t => { if (t <= 1) { clearInterval(interval); return 0; } return t - 1; });
      }, 1000);
    } catch (err) {
      toast({ title: "خطأ", description: (err as Error).message, variant: "destructive" });
    } finally {
      setResendLoading(false);
    }
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "أدخل البريد/الهاتف وكلمة المرور", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/v2/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message);
      if (data.token) localStorage.setItem("uv_token", data.token);
      queryClient.invalidateQueries();
      toast({ title: "تم الدخول بنجاح" });
      setTimeout(() => setLocation("/"), 400);
    } catch (err) {
      toast({ title: "خطأ", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-3 sm:p-4 bg-gradient-to-br from-primary/10 via-background to-accent/20 relative overflow-hidden">
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-primary/10"
          initial={{ y: -50, x: `${(i * 47) % 100}%` }}
          animate={{ y: ["0%", "110vh"], rotate: [0, 360] }}
          transition={{ duration: 18 + i, repeat: Infinity, delay: i * 0.7, ease: "linear" }}
        >
          <Sprout className="h-6 w-6 sm:h-8 sm:w-8" />
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-lg sm:max-w-2xl bg-card border-2 border-primary/10 rounded-2xl sm:rounded-3xl shadow-2xl shadow-primary/10 p-4 sm:p-6 md:p-8 max-h-[90vh] overflow-y-auto"
      >
        <div className="text-center mb-4 sm:mb-5">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", duration: 0.7 }}
            className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary shadow-xl shadow-primary/30 mb-2 sm:mb-3"
          >
            <Leaf className="h-6 w-6 sm:h-7 sm:w-7 text-primary-foreground" />
          </motion.div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">UniVerse</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">منصة طلاب كلية الزراعة</p>
        </div>

        <div className="flex bg-muted/50 rounded-xl p-1 mb-4 sm:mb-5 max-w-sm mx-auto">
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition ${mode === "signup" ? "bg-background shadow" : ""}`}
          >
            إنشاء حساب
          </button>
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition ${mode === "login" ? "bg-background shadow" : ""}`}
          >
            تسجيل دخول
          </button>
        </div>

        <AnimatePresence mode="wait">
          {done ? (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
              <CheckCircle2 className="h-20 w-20 text-emerald-500 mx-auto" />
              <h2 className="text-2xl font-bold mt-4">تم!</h2>
              <p className="text-muted-foreground mt-1">جاري التحويل...</p>
            </motion.div>
          ) : mode === "signup" ? (
            <motion.form key="signup" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={submitSignup} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="sm:col-span-2 flex flex-col items-center gap-3 mb-2">
                <div className="text-xs text-muted-foreground">صورة الملف الشخصي (اختياري)</div>
                <div className="w-24 sm:w-32">
                  {avatarUrl ? (
                    <div className="relative">
                      <img src={avatarUrl} alt="me" className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-primary/20" />
                      <button type="button" onClick={() => setAvatarUrl(null)} className="absolute -top-1 -end-1 bg-destructive text-destructive-foreground rounded-full w-6 h-6 sm:w-7 sm:h-7 text-xs sm:text-sm flex items-center justify-center">x</button>
                    </div>
                  ) : (
                    <FileUpload value={avatarUrl} onChange={setAvatarUrl} label="ارفع صورة" maxSizeKb={400} />
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs"><User className="h-3.5 w-3.5" /> الاسم بالكامل</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: أحمد محمد" className="h-9 sm:h-10 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs">@ اسم المستخدم</Label>
                <div className="relative">
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} onBlur={() => checkUsername(username)} placeholder="مثال: ahmed2024" className={`h-10 ${usernameStatus.available ? "border-emerald-500" : usernameStatus.reason && username.length >= 4 ? "border-red-500" : ""}`} />
                  {username.length >= 4 && (
                    <div className="absolute left-2 top-1/2 -translate-y-1/2">
                      {usernameStatus.checking ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : usernameStatus.available ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-red-500" />}
                    </div>
                  )}
                </div>
                {usernameStatus.reason && username.length >= 4 && (
                  <p className="text-xs text-red-500">{usernameStatus.reason}</p>
                )}
                {usernameStatus.available && username.length >= 4 && (
                  <p className="text-xs text-emerald-500">اليوزر متاح!</p>
                )}
                {usernameStatus.suggestions && usernameStatus.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-muted-foreground">اقتراحات:</span>
                    {usernameStatus.suggestions.map((s) => (
                      <button key={s} type="button" onClick={() => setUsername(s)} className="text-xs bg-muted px-2 py-0.5 rounded hover:bg-muted/80">{s}</button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-amber-600 font-medium">تنبيه: اسم المستخدم مش هيتغير بعد التسجيل، اختاره بعناية!</p>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs"><Mail className="h-3.5 w-3.5" /> البريد الإلكتروني</Label>
                <Input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs"><Phone className="h-3.5 w-3.5" /> رقم الهاتف</Label>
                <Input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs"><Shield className="h-3.5 w-3.5" /> كلمة المرور</Label>
                <div className="relative">
                  <Input key={showPassword ? "visible" : "hidden"} type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 حروف على الأقل" className="h-10 ps-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute start-2 top-1/2 -translate-y-1/2 text-muted-foreground z-10 cursor-pointer">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs"><GraduationCap className="h-3.5 w-3.5" /> السنة الدراسية</Label>
                <select value={yearInCollege} onChange={(e) => setYearInCollege(Number(e.target.value))} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                  {YEARS.map((y) => <option key={y} value={y}>السنة {y}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">التخصص</Label>
                <select value={specialization} onChange={(e) => setSpecialization(e.target.value)} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                  {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">المجموعة</Label>
                <div className="flex gap-2">
                  {GROUPS.map((g) => (
                    <button type="button" key={g} onClick={() => setGroupName(g)} className={`flex-1 h-10 rounded-md border-2 text-sm font-bold transition ${groupName === g ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {verifyStep === "idle" ? (
                <>
                  {existingUserError && (
                    <div className="sm:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                      <p className="text-sm text-amber-700 font-medium mb-2">{existingUserError}</p>
                      <button type="button" onClick={() => { setMode("login"); setExistingUserError(null); }} className="text-sm text-primary underline font-medium">تسجيل دخول</button>
                    </div>
                  )}
                  <Button type="submit" className="sm:col-span-2 w-full h-10 sm:h-11 bg-gradient-to-r from-primary to-secondary text-sm" disabled={usernameStatus.checking}>
                    <Mail className="me-2 h-4 w-4" /> تأكيد البريد والواتساب
                  </Button>
                  <p className="sm:col-span-2 text-xs text-muted-foreground text-center">سيتم إرسال كود تأكيد لبريدك وواتساب. يمكنك تعديل بياناتك فيما عدا اسم المستخدم من صفحة الملف الشخصي.</p>
                </>
              ) : (
                <div className="sm:col-span-2 space-y-3 border-2 border-primary/20 rounded-xl p-4 bg-primary/5">
                  <h3 className="font-bold text-sm text-center">تأكيد البريد والواتساب</h3>
                  <p className="text-xs text-muted-foreground text-center">تم إرسال كود التأكيد إلى {email} و {phone}</p>

                  <div className="space-y-1.5">
                    <Label className="text-xs">كود البريد الإلكتروني</Label>
                    <Input value={emailCode} onChange={(e) => setEmailCode(e.target.value)} placeholder="أدخل الكود" className="h-10 text-center text-lg tracking-widest" maxLength={6} />
                  </div>

                  {verifyStep === "done" ? (
                    <Button onClick={submitSignup} className="w-full h-10 bg-gradient-to-r from-emerald-500 to-green-600 text-sm">
                      <CheckCircle2 className="me-2 h-4 w-4" /> إنشاء الحساب
                    </Button>
                  ) : (
                    <>
                      <Button onClick={submitSignup} disabled={verifyStep === "sending" || verifyStep === "verifying" || (!emailCode && !whatsappCode)} className="w-full h-10 text-sm">
                        {verifyStep === "sending" || verifyStep === "verifying" ? <><Loader2 className="me-2 h-4 w-4 animate-spin" /> جاري...</> : "تأكيد الكود"}
                      </Button>
                      <div className="text-center">
                        {resendTimer > 0 ? (
                          <span className="text-xs text-muted-foreground">إعادة الإرسال بعد {resendTimer} ثانية</span>
                        ) : (
                          <button type="button" onClick={handleResend} disabled={resendLoading} className="text-xs text-primary underline disabled:opacity-50">
                            {resendLoading ? "جاري..." : "إعادة إرسال الكود"}
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  <button type="button" onClick={() => { setVerifyStep("idle"); setEmailCode(""); setWhatsappCode(""); }} className="text-xs text-muted-foreground underline block mx-auto">تغيير البريد أو الرقم</button>
                </div>
              )}
            </motion.form>
          ) : showForgotPassword ? (
            <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3 sm:space-y-4 max-w-md mx-auto py-2 sm:py-4">
              <div className="text-center mb-4">
                <KeyRound className="h-10 w-10 text-primary mx-auto mb-2" />
                <h2 className="text-lg font-bold">استعاده كلمة المرور</h2>
                <p className="text-xs text-muted-foreground">هنتحقق من هويتك ونبعتلك كود</p>
              </div>

              {forgotStep === "identifier" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs"><Mail className="h-3.5 w-3.5" /> البريد الإلكتروني أو رقم الهاتف</Label>
                    <Input type="text" value={forgotIdentifier} onChange={(e) => setForgotIdentifier(e.target.value)} placeholder="you@example.com أو 01xxxxxxxxx" className="h-10 sm:h-11 text-sm" />
                  </div>
                  <Button onClick={async () => {
                    if (!forgotIdentifier) { toast({ title: "أدخل البريد أو رقم الهاتف", variant: "destructive" }); return; }
                    setForgotLoading(true);
                    try {
                      const isEmail = forgotIdentifier.includes("@");
                      const body = isEmail ? { email: forgotIdentifier } : { phone: forgotIdentifier };
                      const res = await fetch("/api/v2/auth/forgot-password", {
                        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || "فشل الإرسال");
                      setForgotStep("code");
                      toast({ title: "تم الإرسال", description: "تحقق من بريدك أو واتساب" });
                    } catch (err) { toast({ title: "خطأ", description: (err as Error).message, variant: "destructive" }); }
                    finally { setForgotLoading(false); }
                  }} disabled={forgotLoading} className="w-full h-10 sm:h-11 bg-gradient-to-r from-primary to-secondary text-sm">
                    {forgotLoading ? <><Loader2 className="me-2 h-4 w-4 animate-spin" /> جاري...</> : "إرسال كود الاستعاده"}
                  </Button>
                </div>
              )}

              {forgotStep === "code" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground text-center">تم إرسال الكود إلى {forgotIdentifier}</p>
                  <div className="space-y-1.5">
                    <Label className="text-xs">كود الاستعاده</Label>
                    <Input value={forgotCode} onChange={(e) => setForgotCode(e.target.value)} placeholder="أدخل الكود" className="h-10 text-center text-lg tracking-widest" maxLength={6} />
                  </div>
                  <Button onClick={async () => {
                    if (!forgotCode) { toast({ title: "أدخل الكود", variant: "destructive" }); return; }
                    setForgotLoading(true);
                    try {
                      const isEmail = forgotIdentifier.includes("@");
                      const body = isEmail ? { email: forgotIdentifier, code: forgotCode } : { phone: forgotIdentifier, code: forgotCode };
                      const res = await fetch("/api/v2/auth/verify-reset-code", {
                        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || "الكود غلط");
                      setForgotStep("newPassword");
                      toast({ title: "تم التأكيد", description: "الكود صحيح، أدخل كلمة المرور الجديدة" });
                    } catch (err) { toast({ title: "خطأ", description: (err as Error).message, variant: "destructive" }); }
                    finally { setForgotLoading(false); }
                  }} disabled={forgotLoading} className="w-full h-10 text-sm">
                    {forgotLoading ? <><Loader2 className="me-2 h-4 w-4 animate-spin" /> جاري...</> : "تأكيد الكود"}
                  </Button>
                </div>
              )}

              {forgotStep === "newPassword" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs"><Shield className="h-3.5 w-3.5" /> كلمة المرور الجديدة</Label>
                    <div className="relative">
                      <Input key={showPassword ? "visible" : "hidden"} type={showPassword ? "text" : "password"} value={forgotNewPassword} onChange={(e) => setForgotNewPassword(e.target.value)} placeholder="6 حروف على الأقل" className="h-10 ps-10" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute start-2 top-1/2 -translate-y-1/2 text-muted-foreground z-10 cursor-pointer">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button onClick={async () => {
                    if (!forgotNewPassword || forgotNewPassword.length < 6) { toast({ title: "كلمة المرور لازم تكون 6 حروف على الأقل", variant: "destructive" }); return; }
                    setForgotLoading(true);
                    try {
                      const isEmail = forgotIdentifier.includes("@");
                      const body = isEmail ? { email: forgotIdentifier, code: forgotCode, newPassword: forgotNewPassword } : { phone: forgotIdentifier, code: forgotCode, newPassword: forgotNewPassword };
                      const res = await fetch("/api/v2/auth/reset-password", {
                        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || "فشل");
                      if (data.token) localStorage.setItem("uv_token", data.token);
                      queryClient.invalidateQueries();
                      setShowForgotPassword(false);
                      setForgotStep("identifier");
                      setForgotIdentifier("");
                      setForgotCode("");
                      setForgotNewPassword("");
                      toast({ title: "تم تغيير كلمة المرور", description: "هتتحول للصفحة الرئيسية" });
                      setTimeout(() => setLocation("/"), 900);
                    } catch (err) { toast({ title: "خطأ", description: (err as Error).message, variant: "destructive" }); }
                    finally { setForgotLoading(false); }
                  }} disabled={forgotLoading} className="w-full h-10 sm:h-11 bg-gradient-to-r from-emerald-500 to-green-600 text-sm">
                    {forgotLoading ? <><Loader2 className="me-2 h-4 w-4 animate-spin" /> جاري...</> : "تغيير كلمة المرور وتسجيل الدخول"}
                  </Button>
                </div>
              )}

              <button type="button" onClick={() => { setShowForgotPassword(false); setForgotStep("identifier"); setForgotIdentifier(""); setForgotCode(""); setForgotNewPassword(""); }} className="text-xs text-muted-foreground underline block mx-auto">العوده لتسجيل الدخول</button>
            </motion.div>
          ) : (
            <motion.form key="login" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={submitLogin} noValidate className="space-y-3 sm:space-y-4 max-w-md mx-auto py-2 sm:py-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs"><Mail className="h-3.5 w-3.5" /> البريد الإلكتروني أو رقم الهاتف</Label>
                <Input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com أو 01xxxxxxxxx" className="h-10 sm:h-11 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs"><Shield className="h-3.5 w-3.5" /> كلمة المرور</Label>
                <div className="relative">
                  <Input key={showPassword ? "visible" : "hidden"} type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة المرور" className="h-10 sm:h-11 ps-10 text-sm" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute start-2 top-1/2 -translate-y-1/2 text-muted-foreground z-10 cursor-pointer">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="text-start">
                <button type="button" onClick={() => setShowForgotPassword(true)} className="text-xs text-primary underline">هل نسيت الباسورد؟</button>
              </div>
              <Button type="submit" className="w-full h-10 sm:h-11 bg-gradient-to-r from-primary to-secondary text-sm">
                تسجيل الدخول
              </Button>
              <p className="text-xs text-muted-foreground text-center">ليس لديك حساب؟ <button type="button" onClick={() => setMode("signup")} className="text-primary underline">أنشئ حساب جديد</button></p>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
