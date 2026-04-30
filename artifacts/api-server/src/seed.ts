import { db, schema } from "./lib/db";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function wipe() {
  // truncate all tables we own (cascade for FK)
  const tables = [
    schema.dmMessagesTable,
    schema.dmThreadsTable,
    schema.userFollowsTable,
    schema.materialFilesTable,
    schema.groupScheduleTable,
    schema.gameScoresTable,
    schema.adminProposalsTable,
    schema.notificationsTable,
    schema.activityTable,
    schema.attendanceTable,
    schema.gradesTable,
    schema.scheduleItemsTable,
    schema.complaintsTable,
    schema.missionsTable,
    schema.skillLessonsTable,
    schema.skillTracksTable,
    schema.talentCommentsTable,
    schema.talentLikesTable,
    schema.talentsTable,
    schema.forumRepliesTable,
    schema.forumPostsTable,
    schema.quizAttemptsTable,
    schema.quizQuestionsTable,
    schema.quizzesTable,
    schema.materialsTable,
    schema.coursesTable,
    schema.newsTable,
    schema.usersTable,
  ];

  for (const t of tables) {
    const tableName = (t as any)[Symbol.for("drizzle:Name")] ?? "";
    if (!tableName) continue;
    await db.execute(sql.raw(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`));
  }
}

async function main() {
  console.log("Wiping all data...");
  await wipe();

  console.log("Seeding admin accounts...");

  const superAdminPassword = await bcrypt.hash("Xk9#mZ$vL2@pQw7&Ry4!", 10);
  const adminPassword = await bcrypt.hash("Hn6^jT&cB8*dFv3!Qm1@", 10);

  await db.insert(schema.usersTable).values([
    {
      name: "SA",
      username: "SA",
      email: "sb@admin.com",
      phone: "01000000001",
      password: superAdminPassword,
      role: "super_admin",
      department: "الإدارة",
      title: "سوبر أدمن",
      avatarUrl: "https://i.pravatar.cc/200?img=51",
      uniqueCode: "UV-SUPER001",
      points: 0,
      emailVerified: true,
      phoneVerified: true,
    },
    {
      name: "NA",
      username: "NA",
      email: "na@admin.com",
      phone: "01000000002",
      password: adminPassword,
      role: "admin",
      department: "الإدارة",
      title: "أدمن",
      avatarUrl: "https://i.pravatar.cc/200?img=45",
      uniqueCode: "UV-ADMIN001",
      points: 0,
      emailVerified: true,
      phoneVerified: true,
    },
  ]);

  console.log("Done. DB now contains:");
  console.log("  - super_admin: sb@admin.com / Xk9#mZ$vL2@pQw7&Ry4!  (username: SA)");
  console.log("  - admin:       na@admin.com / Hn6^jT&cB8*dFv3!Qm1@  (username: NA)");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
