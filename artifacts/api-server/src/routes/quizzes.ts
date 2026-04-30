import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { ListQuizzesResponse, GetQuizResponse, SubmitQuizBody, SubmitQuizResponse } from "@workspace/api-zod";
import { db, schema } from "../lib/db";
import { handle } from "../lib/util";

const router: IRouter = Router();

router.get("/quizzes", (_req, res) => {
  void handle(res, async () => {
    const rows = await db.select().from(schema.quizzesTable);
    const counts = await db
      .select({ quizId: schema.quizQuestionsTable.quizId, c: sql<number>`count(*)::int` })
      .from(schema.quizQuestionsTable)
      .groupBy(schema.quizQuestionsTable.quizId);
    const countMap = new Map(counts.map((x) => [x.quizId, x.c]));
    return ListQuizzesResponse.parse(
      rows.map((q) => ({
        id: q.id,
        title: q.title,
        description: q.description,
        courseId: q.courseId,
        courseTitle: q.courseTitle,
        durationMinutes: q.durationMinutes,
        questionCount: countMap.get(q.id) ?? 0,
        totalPoints: q.totalPoints,
        difficulty: q.difficulty,
      })),
    );
  });
});

router.get("/quizzes/:id", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const [q] = await db.select().from(schema.quizzesTable).where(eq(schema.quizzesTable.id, id)).limit(1);
    if (!q) throw Object.assign(new Error("Quiz not found"), { status: 404 });
    const questions = await db
      .select()
      .from(schema.quizQuestionsTable)
      .where(eq(schema.quizQuestionsTable.quizId, id))
      .orderBy(schema.quizQuestionsTable.ord);
    return GetQuizResponse.parse({
      id: q.id,
      title: q.title,
      description: q.description,
      courseId: q.courseId,
      courseTitle: q.courseTitle,
      durationMinutes: q.durationMinutes,
      questionCount: questions.length,
      totalPoints: q.totalPoints,
      difficulty: q.difficulty,
      questions: questions.map((qq) => ({
        id: qq.id,
        text: qq.text,
        options: qq.options,
        points: qq.points,
      })),
    });
  });
});

router.post("/quizzes/:id/submit", (req, res) => {
  void handle(res, async () => {
    const id = Number(req.params.id);
    const body = SubmitQuizBody.parse(req.body);
    const [q] = await db.select().from(schema.quizzesTable).where(eq(schema.quizzesTable.id, id)).limit(1);
    if (!q) throw Object.assign(new Error("Quiz not found"), { status: 404 });
    const questions = await db
      .select()
      .from(schema.quizQuestionsTable)
      .where(eq(schema.quizQuestionsTable.quizId, id));

    let score = 0;
    let correctCount = 0;
    const breakdown = questions.map((qq) => {
      const ans = body.answers.find((a) => a.questionId === qq.id);
      const correct = ans?.selectedIndex === qq.correctIndex;
      if (correct) {
        score += qq.points;
        correctCount += 1;
      }
      return {
        questionId: qq.id,
        correct,
        correctIndex: qq.correctIndex,
        explanation: qq.explanation,
      };
    });

    const pointsEarned = Math.round(score * 0.5);
    const userId = req.demo.currentUserId;
    if (!userId) throw Object.assign(new Error("غير مسجل"), { status: 401 });
    await db
      .update(schema.usersTable)
      .set({ points: sql`${schema.usersTable.points} + ${pointsEarned}` })
      .where(eq(schema.usersTable.id, userId));

    return SubmitQuizResponse.parse({
      quizId: id,
      score,
      totalPoints: q.totalPoints,
      correctCount,
      questionCount: questions.length,
      pointsEarned,
      breakdown,
    });
  });
});

export default router;
