import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, schema } from "../lib/db";
import { handle } from "../lib/util";
import { sendMail, isMailConfigured } from "../lib/mail";

const router: IRouter = Router();

router.post("/v2/contact", (req, res) => {
  void handle(res, async () => {
    const userId = req.demo.currentUserId;
    if (!userId) throw Object.assign(new Error("غير مسجل"), { status: 401 });

    const { name, email, phone, type: contactType, subject, message } = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      type: string;
      subject: string;
      message: string;
    };

    if (!subject || !message || !contactType) {
      throw Object.assign(new Error("الموضوع والنوع والرسالة مطلوبون"), { status: 400 });
    }

    const [user] = await db.select().from(schema.usersTable).where(eq(schema.usersTable.id, userId)).limit(1);
    if (!user) throw Object.assign(new Error("المستخدم غير موجود"), { status: 404 });

    const [created] = await db
      .insert(schema.complaintsTable)
      .values({
        subject: `[${contactType}] ${subject}`,
        body: message,
        category: contactType === "suggestion" ? "academic" : contactType === "inquiry" ? "other" : "technical",
        authorId: userId,
      })
      .returning();

    const displayName = name || user.name;
    const contactEmail = email || user.email;

    const typeLabels: Record<string, string> = {
      complaint: "شكوى",
      suggestion: "اقتراح",
      inquiry: "استفسار",
      report: "بلاغ",
      other: "أخرى",
    };

    if (isMailConfigured()) {
      await sendMail({
        to: contactEmail,
        subject: `[UniVerse] تم استلام ${typeLabels[contactType] || "رسالتك"}`,
        html: `
          <div dir="rtl" style="font-family: 'Cairo', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #2d6a4f, #40916c); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">🌿 UniVerse</h1>
              <p style="color: rgba(255,255,255,0.85); margin-top: 8px;">منصة كلية الزراعة الذكية</p>
            </div>
            <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
              <p style="color: #374151; font-size: 16px;">مرحباً <strong>${displayName}</strong>،</p>
              <p style="color: #374151; font-size: 16px;">تم استلام <strong>${typeLabels[contactType] || "رسالتك"}</strong> بنجاح. فريق الدعم سيراجعها في أقرب وقت ممكن.</p>
              <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;"><strong>الموضوع:</strong> ${subject}</p>
                <p style="margin: 0; color: #6b7280; font-size: 14px;"><strong>الرسالة:</strong></p>
                <p style="margin: 4px 0 0; color: #374151;">${message}</p>
              </div>
              <p style="color: #6b7280; font-size: 14px;">رقم التذكرة: #${created.id}</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
              <p style="color: #9ca3af; font-size: 12px;">هذه رسالة تلقائية، يرجى عدم الرد عليها.</p>
            </div>
          </div>
        `,
      });
    }

    return {
      id: created.id,
      subject: created.subject,
      body: created.body,
      category: created.category,
      status: created.status,
      createdAt: created.createdAt.toISOString(),
    };
  });
});

export default router;
