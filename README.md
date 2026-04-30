# UniVerse - Smart University Platform

منصة طلاب كلية الزراعة الذكية

## المميزات
- نظام تسجيل دخول كامل مع اسم مستخدم وكلمة مرور
- كود خاص لكل مستخدم
- لوحة تحكم للأدمن والسوبر أدمن
- نظام مقترحات للموافقة على التغييرات
- ملف شخصي قابل للتعديل
- نظام نقاط وإنجازات
- دردشة خاصة ومنتدى نقاش
- اختبارات وألعاب تعليمية
- دعم اللغتين (العربية والإنجليزية)

## التشغيل المحلي

### 1. تثبيت الاعتمادات
```bash
pnpm install
```

### 2. إعداد قاعدة البيانات
احصل على قاعدة بيانات PostgreSQL مجانية من [Neon.tech](https://neon.tech):
1. سجل حساب مجاني على neon.tech
2. أنشئ مشروع جديد
3. انسخ رابط الاتصال (يبدو هكذا: `postgresql://user:password@ep-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require`)
4. أنشئ ملف `.env.local` في المجلد الرئيسي:
```
DATABASE_URL="رابط-الاتصال-هنا"
```

### 3. إنشاء الجداول والحسابات
```bash
# إنشاء الجداول في قاعدة البيانات
pnpm --filter @workspace/db run push

# إنشاء حسابات الأدمن
pnpm exec tsx artifacts/api-server/src/seed.ts
```

### 4. تشغيل المشروع
```bash
pnpm dev
```
أو شغلهم منفصلين:
```bash
# السيرفر (في نافذة)
PORT=8080 NODE_ENV=development pnpm --filter @workspace/api-server run dev

# الفرونت اند (في نافذة تانية)
cd artifacts/universe && pnpm dev
```

## النشر على Vercel (مجاني)

### الخطوة 1: ارفع الكود على GitHub
```bash
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

### الخطوة 2: أنشئ قاعدة بيانات على Neon
1. ادخل على [neon.tech](https://neon.tech)
2. سجل بحسابك (مجاني)
3. Create Project
4. انسخ الـ Connection String من صفحة المشروع

### الخطوة 3: اربط المشروع بـ Vercel
1. ادخل على [vercel.com](https://vercel.com) وسجل بحسابك
2. اضغط **New Project**
3. اختار الـ Repository بتاعك من GitHub
4. في الإعدادات:
   - **Framework Prespect**: Vite
   - **Build Command**: `pnpm install && pnpm run build`
   - **Output Directory**: `artifacts/universe/dist/public`
   - **Install Command**: `pnpm install`
5. في **Environment Variables** ضيف:
   - **Name**: `DATABASE_URL`
   - **Value**: رابط الاتصال من Neon
6. اضغط **Deploy**

### الخطوة 4: إنشاء الجداول بعد النشر
بعد ما المشروع ينشر، شغل الأمر ده من التيرمينال:
```bash
DATABASE_URL="رابط-neon-بتاعك" pnpm --filter @workspace/db run push
DATABASE_URL="رابط-neon-بتاعك" pnpm exec tsx artifacts/api-server/src/seed.ts
```

## حسابات الأدمن (بعد الـ seed)

| الدور | الإيميل | كلمة المرور |
|-------|---------|-------------|
| سوبر أدمن | khaled@uniagri.edu | SuperAdmin123! |
| أدمن | fatma@uniagri.edu | Admin123! |

## التقنيات المستخدمة

| الجزء | التقنية |
|-------|---------|
| الفرونت اند | React 19 + Vite + Tailwind CSS |
| الباك اند | Express 5 |
| قاعدة البيانات | PostgreSQL (Neon) |
| ORM | Drizzle ORM |
| التوثيق | bcryptjs + cookies |
| النشر | Vercel (مجاني) |

## هيكل المشروع

```
├── api/                    # Vercel serverless functions
├── artifacts/
│   ├── api-server/         # Express API
│   └── universe/           # React frontend
├── lib/
│   ├── db/                 # Drizzle schema
│   ├── api-spec/           # OpenAPI spec
│   ├── api-client-react/   # React hooks
│   └── api-zod/            # Zod schemas
└── scripts/                # Dev scripts
```
# unv
