import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";

const API_BASE = "/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("uv_token");
}

function setToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("uv_token", token);
}

function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("uv_token");
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      msg = (j as { error?: string }).error || msg;
    } catch {}
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json();
  if ((data as any).token) setToken((data as any).token);
  return data as T;
}

export function logoutClient() {
  clearToken();
}

export const api = {
  get: <T,>(path: string) => request<T>("GET", path),
  post: <T,>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T,>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T,>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  del: <T,>(path: string) => request<T>("DELETE", path),
};

// ----- Hooks -----

export interface MeV2 {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  groupName: string | null;
  avatarUrl: string | null;
  department: string;
  year: number | null;
  yearInCollege: number | null;
  specialization: string | null;
  points: number;
  level: number;
  streak: number;
  title: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  unreadCount: number;
  unreadDmCount: number;
  username: string | null;
  uniqueCode: string | null;
}

export function useMeV2(opts?: Partial<UseQueryOptions<MeV2>>) {
  return useQuery<MeV2>({
    queryKey: ["v2", "me"],
    queryFn: () => api.get<MeV2>("/v2/me"),
    staleTime: 30_000,
    ...opts,
  });
}

export interface NotificationItem {
  id: number;
  userId: number;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: string;
}

export function useNotifications() {
  return useQuery<NotificationItem[]>({
    queryKey: ["v2", "notifications"],
    queryFn: () => api.get<NotificationItem[]>("/v2/notifications"),
    refetchInterval: 30_000,
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ ok: true }>("/v2/notifications/mark-all-read"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "notifications"] });
      qc.invalidateQueries({ queryKey: ["v2", "me"] });
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<{ ok: true }>(`/v2/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "notifications"] });
      qc.invalidateQueries({ queryKey: ["v2", "me"] });
    },
  });
}

export function useSendSystemNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; body: string; type?: string; targetRole?: string; targetGroup?: string; targetYear?: number }) =>
      api.post<{ ok: boolean; sentTo: number }>("/v2/admin/notifications/system", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "notifications"] });
    },
  });
}

export interface TalentFeedItem {
  id: number;
  title: string;
  description: string;
  category: string;
  mediaUrl: string | null;
  votes: number;
  ownerId: number;
  status: string;
  groupOnly: string | null;
  createdAt: string;
  owner: { id: number; name: string; avatarUrl: string | null; groupName: string | null; department: string } | null;
  likesCount: number;
  likedByMe: boolean;
  commentsCount: number;
}

export function useTalentsFeed() {
  return useQuery<TalentFeedItem[]>({
    queryKey: ["v2", "talents-feed"],
    queryFn: () => api.get<TalentFeedItem[]>("/v2/talents-feed"),
  });
}

export interface AdminProposal {
  id: number;
  proposerId: number;
  proposerName?: string;
  proposerRole?: string;
  action: string;
  resourceKind: string;
  resourceId: number | null;
  payload: Record<string, unknown>;
  reason: string | null;
  status: string;
  decisionNote: string | null;
  decidedById: number | null;
  decidedAt: string | null;
  createdAt: string;
}

export function useProposals(status: string = "pending") {
  return useQuery<AdminProposal[]>({
    queryKey: ["v2", "proposals", status],
    queryFn: () => api.get<AdminProposal[]>(`/v2/admin/proposals?status=${status}`),
  });
}

export interface GameScore {
  id: number;
  userId: number;
  gameKey: string;
  score: number;
  durationMs: number;
  createdAt: string;
  userName?: string;
  userAvatar?: string | null;
  groupName?: string | null;
}

export function useGameLeaderboard(gameKey?: string) {
  return useQuery<GameScore[]>({
    queryKey: ["v2", "games", "leaderboard", gameKey ?? "all"],
    queryFn: () => api.get<GameScore[]>(`/v2/games/leaderboard${gameKey ? `?gameKey=${gameKey}` : ""}`),
  });
}

// ===== Profile =====
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<{ name: string; phone: string; avatarUrl: string; bio: string; specialization: string; yearInCollege: number; groupName: string }>) =>
      request("PATCH", "/v2/me/profile", body),
    onSuccess: () => qc.invalidateQueries(),
  });
}

// ===== Auth =====
export function useSignup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; email: string; phone: string; yearInCollege?: number; specialization?: string; groupName?: string; avatarUrl?: string }) =>
      api.post<{ userId: number; isNew: boolean }>("/v2/auth/signup", body),
    onSuccess: () => qc.invalidateQueries(),
  });
}
export function useDemoLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { identifier: string; password: string }) => api.post<{ userId: number; role: string }>("/v2/auth/login", body),
    onSuccess: () => qc.invalidateQueries(),
  });
}
export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/v2/auth/logout"),
    onSuccess: () => {
      clearToken();
      qc.invalidateQueries();
    },
  });
}

// ===== Follow / Students =====
export interface StudentLite {
  id: number;
  name: string;
  avatarUrl: string | null;
  groupName: string | null;
  specialization: string | null;
  yearInCollege: number | null;
  points: number;
}
export function useStudents() {
  return useQuery<StudentLite[]>({ queryKey: ["v2", "students"], queryFn: () => api.get("/v2/users/students") });
}
export function useFollows() {
  return useQuery<{ followers: StudentLite[]; following: StudentLite[] }>({
    queryKey: ["v2", "follows", "me"],
    queryFn: () => api.get("/v2/follows/me"),
  });
}
export function useToggleFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => api.post<{ following: boolean }>(`/v2/follow/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "follows", "me"] });
      qc.invalidateQueries({ queryKey: ["v2", "students"] });
    },
  });
}
export function useFollowStatus(userId: number) {
  return useQuery<{ following: boolean }>({
    queryKey: ["v2", "follow-status", userId],
    queryFn: () => api.get(`/v2/follows/${userId}/status`),
    enabled: userId > 0,
  });
}

// ===== DM =====
export interface DmThread {
  threadId: number;
  other: { id: number; name: string; avatarUrl: string | null; groupName: string | null } | null;
  lastMessage: { body: string; createdAt: string; fromMe: boolean } | null;
  unread: number;
  lastMessageAt: string;
}
export function useDmThreads() {
  return useQuery<DmThread[]>({ queryKey: ["v2", "dm", "threads"], queryFn: () => api.get("/v2/dm/threads"), refetchInterval: 8000 });
}
export interface DmMessage {
  id: number; threadId: number; fromId: number; body: string; read: boolean; createdAt: string; fromMe: boolean;
}
export function useDmWith(userId: number) {
  return useQuery<{ threadId: number; other: any; messages: DmMessage[] }>({
    queryKey: ["v2", "dm", "with", userId],
    queryFn: () => api.get(`/v2/dm/with/${userId}`),
    enabled: userId > 0,
    refetchInterval: 4000,
    retry: (failureCount, error: any) => {
      if (error?.status === 404) return false;
      return failureCount < 2;
    },
  });
}
export function useSendDm(userId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.post(`/v2/dm/with/${userId}`, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "dm", "with", userId] });
      qc.invalidateQueries({ queryKey: ["v2", "dm", "threads"] });
    },
  });
}

// Super Admin: view all DM threads
export interface AdminDmThread {
  threadId: number;
  userA: { id: number; name: string; avatarUrl: string | null; role: string } | null;
  userB: { id: number; name: string; avatarUrl: string | null; role: string } | null;
  lastMessage: { body: string; createdAt: string; fromId: number } | null;
  totalMessages: number;
  lastMessageAt: string;
}
export function useAdminDmThreads() {
  return useQuery<AdminDmThread[]>({ queryKey: ["v2", "admin", "dm", "threads"], queryFn: () => api.get("/v2/admin/dm/threads") });
}

export interface AdminDmConversation {
  threadId: number;
  userA: { id: number; name: string; avatarUrl: string | null; role: string } | null;
  userB: { id: number; name: string; avatarUrl: string | null; role: string } | null;
  messages: { id: number; threadId: number; fromId: number; body: string; read: boolean; createdAt: string; fromName: string; fromAvatar: string | null }[];
}
export function useAdminDmConversation(threadId: number) {
  return useQuery<AdminDmConversation>({
    queryKey: ["v2", "admin", "dm", "threads", threadId],
    queryFn: () => api.get(`/v2/admin/dm/threads/${threadId}`),
    enabled: threadId > 0,
    refetchInterval: 4000,
  });
}

// ===== Forum =====
export interface ForumPostV2 {
  id: number; title: string; body: string; category: string; authorId: number;
  upvotes: number; bestReplyId: number | null; groupOnly: string | null; createdAt: string;
  authorName?: string; authorAvatar?: string | null; authorGroup?: string | null; repliesCount: number;
}
export function useForumPosts() {
  return useQuery<ForumPostV2[]>({ queryKey: ["v2", "forum", "posts"], queryFn: () => api.get("/v2/forum/posts") });
}
export interface ForumReplyV2 {
  id: number; postId: number; body: string; authorId: number; upvotes: number; isBest: boolean;
  createdAt: string; authorName?: string; authorAvatar?: string | null; authorRole?: string;
}
export function useForumReplies(postId: number) {
  return useQuery<ForumReplyV2[]>({
    queryKey: ["v2", "forum", "replies", postId],
    queryFn: () => api.get(`/v2/forum/posts/${postId}/replies`),
    enabled: postId > 0,
  });
}
export function useReplyToPost(postId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.post(`/v2/forum/posts/${postId}/replies`, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "forum", "replies", postId] });
      qc.invalidateQueries({ queryKey: ["v2", "forum", "posts"] });
    },
  });
}
export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; body: string; category?: string; groupOnly?: string }) =>
      api.post("/v2/forum/posts", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "forum", "posts"] }),
  });
}
export function useUpvotePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post(`/v2/forum/posts/${id}/upvote`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "forum", "posts"] }),
  });
}

// ===== Skills =====
export interface SkillTrackFull {
  id: number; title: string; category: string; description: string;
  difficulty: string; coverUrl: string | null; progress: number;
  lessons: { id: number; trackId: number; title: string; durationMinutes: number; kind: string; completed: boolean; ord: number }[];
}
export function useSkillTracks() {
  return useQuery<SkillTrackFull[]>({ queryKey: ["v2", "skills"], queryFn: () => api.get("/v2/skills/tracks") });
}
export function useCompleteLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post(`/v2/skills/lessons/${id}/complete`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "skills"] });
      qc.invalidateQueries({ queryKey: ["v2", "me"] });
    },
  });
}

// ===== Quizzes (open + attempts) =====
export interface QuizOpenItem {
  id: number; title: string; description: string; courseTitle: string;
  durationMinutes: number; totalPoints: number; difficulty: string; isOpen: boolean;
  groupOnly: string | null; yearOnly: number | null; createdAt: string;
  myAttemptsCount: number; myBestScore: number;
}
export function useOpenQuizzes() {
  return useQuery<QuizOpenItem[]>({ queryKey: ["v2", "quizzes", "open"], queryFn: () => api.get("/v2/quizzes/open") });
}
export interface QuizSession {
  quiz: QuizOpenItem;
  questions: { id: number; text: string; options: string[]; optionMap: number[]; points: number }[];
}
export function useStartQuiz(id: number) {
  return useQuery<QuizSession>({
    queryKey: ["v2", "quiz", "start", id, Date.now()],
    queryFn: () => api.get(`/v2/quizzes/${id}/start`),
    enabled: id > 0,
    staleTime: 0,
    gcTime: 0,
  });
}
export function useSubmitQuiz(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { answers: { questionId: number; chosenOriginalIndex: number }[]; durationSec: number }) =>
      api.post(`/v2/quizzes/${id}/submit`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "quizzes", "open"] });
      qc.invalidateQueries({ queryKey: ["v2", "me"] });
    },
  });
}

// ===== Admin: full management =====
export interface AdminQuizRow {
  id: number; title: string; description: string; courseTitle: string; difficulty: string;
  durationMinutes: number; isOpen: boolean; groupOnly: string | null; yearOnly: number | null;
  totalPoints: number; createdAt: string; attemptsCount: number; passPercent: number;
}
export function useAdminQuizzes() {
  return useQuery<AdminQuizRow[]>({ queryKey: ["v2", "admin", "quizzes"], queryFn: () => api.get("/v2/admin/all-quizzes") });
}
export function useToggleQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<{ ok: true; isOpen: boolean }>(`/v2/admin/quizzes/toggle/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "admin", "quizzes"] });
      qc.invalidateQueries({ queryKey: ["v2", "quizzes", "open"] });
    },
  });
}
export interface QuizAttemptView {
  id: number; quizId: number; userId: number; score: number; total: number;
  durationSec: number; completedAt: string;
  userName?: string; userAvatar?: string | null; userGroup?: string | null;
}
export function useQuizAttempts(quizId: number) {
  return useQuery<QuizAttemptView[]>({
    queryKey: ["v2", "admin", "quiz-attempts", quizId],
    queryFn: () => api.get(`/v2/admin/quizzes/${quizId}/attempts`),
    enabled: quizId > 0,
  });
}

export interface AdminQuizAttemptDetail {
  attemptId: number;
  userName: string; userAvatar: string | null; userGroup: string | null;
  score: number; total: number; durationSec: number; passed: boolean; completedAt: string;
  questions: {
    questionId: number; text: string; options: string[]; correctIndex: number;
    explanation: string; points: number; userChosen: number; correct: boolean;
  }[];
}
export function useAdminQuizAttemptDetail(attemptId: number) {
  return useQuery<AdminQuizAttemptDetail>({
    queryKey: ["v2", "admin", "quiz-attempt-detail", attemptId],
    queryFn: () => api.get(`/v2/admin/quiz-attempts/${attemptId}`),
    enabled: attemptId > 0,
  });
}

export interface AdminCourseRow {
  id: number; title: string; code: string; description: string; credits: number;
  department: string; instructor: string; coverUrl: string | null; enrolled: number;
  semester: number;
}
export function useAdminCourses() {
  return useQuery<AdminCourseRow[]>({ queryKey: ["v2", "admin", "courses"], queryFn: () => api.get("/v2/admin/all-courses") });
}
export function useCourses() {
  return useQuery<AdminCourseRow[]>({ queryKey: ["v2", "courses"], queryFn: () => api.get("/v2/courses") });
}

export interface AdminMaterialRow {
  id: number; courseId: number; title: string; kind: string; url: string; lecturer: string | null; durationMinutes: number | null; ord: number;
}
export function useAdminMaterials() {
  return useQuery<AdminMaterialRow[]>({ queryKey: ["v2", "admin", "materials"], queryFn: () => api.get("/v2/admin/all-materials") });
}
export function useCreateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { courseId: number; title: string; kind: string; url?: string; lecturer?: string; durationMinutes?: number; ord?: number }) =>
      api.post("/v2/admin/materials", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "admin", "materials"] });
      qc.invalidateQueries({ queryKey: ["v2", "courses"] });
    },
  });
}
export function useUpdateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; title?: string; kind?: string; lecturer?: string; durationMinutes?: number; ord?: number }) =>
      api.patch(`/v2/admin/materials/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "admin", "materials"] });
    },
  });
}
export function useDeleteMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/v2/admin/materials/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "admin", "materials"] });
    },
  });
}

// Material files (per course)
export interface MaterialFileRow {
  id: number; materialId: number; courseId: number; name: string; kind: string; url: string;
  sizeBytes: number; uploadedById: number; uploadedByName: string; createdAt: string;
}
export function useCourseFiles(courseId: number) {
  return useQuery<MaterialFileRow[]>({
    queryKey: ["v2", "course-files", courseId],
    queryFn: () => api.get(`/v2/courses/${courseId}/all-files`),
    enabled: courseId > 0,
  });
}
export function useMaterialFiles(materialId: number) {
  return useQuery<MaterialFileRow[]>({
    queryKey: ["v2", "material-files", materialId],
    queryFn: () => api.get(`/v2/materials/${materialId}/files`),
    enabled: materialId > 0,
  });
}
export function useUploadMaterialFile(materialId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; kind: string; url: string; sizeBytes?: number }) =>
      api.post(`/v2/admin/materials/${materialId}/files`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "material-files", materialId] });
      qc.invalidateQueries({ queryKey: ["v2", "course-files"] });
    },
  });
}
export function useDeleteMaterialFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/v2/admin/material-files/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "material-files"] });
      qc.invalidateQueries({ queryKey: ["v2", "course-files"] });
    },
  });
}

// Group schedule
export interface GroupScheduleRow {
  id: number; groupName: string; yearInCollege: number; day: string; dayNumber: number; startTime: string;
  endTime: string; courseTitle: string; courseCode: string | null; instructor: string; room: string; type: string;
}
export function useMyGroupSchedule(group?: string | null, year?: number | null) {
  return useQuery<GroupScheduleRow[]>({
    queryKey: ["v2", "group-schedule", group, year],
    queryFn: () => api.get(`/v2/group-schedule${group && year ? `?group=${group}&year=${year}` : ""}`),
  });
}
export function useAdminGroupSchedule() {
  return useQuery<GroupScheduleRow[]>({ queryKey: ["v2", "admin", "group-schedule"], queryFn: () => api.get("/v2/admin/group-schedule") });
}
export function useAddGroupScheduleRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<GroupScheduleRow, "id">) => api.post("/v2/admin/group-schedule", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "admin", "group-schedule"] });
      qc.invalidateQueries({ queryKey: ["v2", "group-schedule"] });
    },
  });
}
export function useDeleteGroupScheduleRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/v2/admin/group-schedule/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "admin", "group-schedule"] });
      qc.invalidateQueries({ queryKey: ["v2", "group-schedule"] });
    },
  });
}

// Study activity logging
export function useLogStudyActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (minutes: number) => api.post("/v2/activity/log", { minutes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["v2", "users"] });
    },
  });
}

export interface ExamScheduleRow {
  id: number; groupName: string; yearInCollege: number; day: string; date: string;
  time: string; courseTitle: string; courseCode: string | null; room: string; type: string;
}
export function useMyExamSchedule(group?: string | null, year?: number | null) {
  return useQuery<ExamScheduleRow[]>({
    queryKey: ["v2", "exam-schedule", group, year],
    queryFn: () => api.get(`/v2/exam-schedule${group && year ? `?group=${group}&year=${year}` : ""}`),
  });
}
export function useAdminExamSchedule() {
  return useQuery<ExamScheduleRow[]>({ queryKey: ["v2", "admin", "exam-schedule"], queryFn: () => api.get("/v2/admin/exam-schedule") });
}
export function useAddExamScheduleRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<ExamScheduleRow, "id">) => api.post("/v2/admin/exam-schedule", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "admin", "exam-schedule"] });
      qc.invalidateQueries({ queryKey: ["v2", "exam-schedule"] });
    },
  });
}
export function useDeleteExamScheduleRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/v2/admin/exam-schedule/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "admin", "exam-schedule"] });
      qc.invalidateQueries({ queryKey: ["v2", "exam-schedule"] });
    },
  });
}

// Achievements
export interface Achievement {
  id: string; title: string; desc: string; target: number; value: number; icon: string; completed: boolean; percent: number;
}
export function useAchievements() {
  return useQuery<Achievement[]>({ queryKey: ["v2", "achievements"], queryFn: () => api.get("/v2/achievements") });
}

// Staff delete (super admin)
export function useDeleteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/v2/admin/staff/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "admin", "staff"] }),
  });
}

// Staff create / update (admin + super_admin) with avatar
export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string; email: string; phone?: string; role: "doctor" | "ta" | "admin";
      department?: string; title?: string; avatarUrl?: string; bio?: string;
      officeHours?: string; researchInterests?: string[];
      username?: string; password?: string;
    }) => api.post("/v2/admin/staff", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "admin", "staff"] }),
  });
}
export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Partial<{ name: string; phone: string; department: string; title: string; avatarUrl: string; bio: string; officeHours: string; researchInterests: string[] }>) =>
      request("PATCH", `/v2/admin/staff/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "admin", "staff"] }),
  });
}

// ===== Doctors / TAs list (for course assignment) =====
export interface DoctorLite {
  id: number; name: string; role: string; department: string;
  avatarUrl: string | null; title: string | null;
}
export function useDoctorsList() {
  return useQuery<DoctorLite[]>({ queryKey: ["v2", "doctors"], queryFn: () => api.get("/v2/staff/doctors") });
}

// ===== Admin courses CRUD =====
export function useCreateAdminCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string; code: string; description?: string; credits?: number;
      department?: string; instructorId: number; taIds?: number[];
      yearInCollege?: number; semester?: number; coverUrl?: string;
    }) => api.post("/v2/admin/courses", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "admin", "courses"] }),
  });
}
export function useDeleteAdminCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/v2/admin/courses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "admin", "courses"] }),
  });
}

// ===== Course Lectures & Sections =====
export interface LectureVideo {
  id: number; lectureId: number; title: string; youtubeUrl: string; youtubeId: string; ord: number;
}
export interface LectureQuizQuestion {
  id: number; quizId: number; text: string; options: string[]; correctIndex: number; points: number; ord: number;
}
export interface LectureQuiz {
  id: number; lectureId: number; title: string; questions: LectureQuizQuestion[];
}
export interface LecturePdf {
  id: number; lectureId: number; name: string; url: string; sizeBytes: number; materialFileId: number | null;
}
export interface LectureFull {
  id: number; courseId: number; title: string; type: "lecture" | "section"; ord: number;
  videos: LectureVideo[];
  quizzes: LectureQuiz[];
  pdfs: LecturePdf[];
}
export function useCourseLectures(courseId: number) {
  return useQuery<LectureFull[]>({
    queryKey: ["v2", "course-lectures", courseId],
    queryFn: () => api.get(`/v2/courses/${courseId}/lectures`),
    enabled: courseId > 0,
  });
}
export function useCreateLecture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, title, type }: { courseId: number; title: string; type: "lecture" | "section" }) =>
      api.post(`/v2/admin/courses/${courseId}/lectures`, { title, type }),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["v2", "course-lectures", vars.courseId] }),
  });
}
export function useDeleteLecture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/v2/admin/lectures/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "course-lectures"] });
    },
  });
}

// ===== Lecture Videos =====
export function useAddVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lectureId, title, youtubeUrl }: { lectureId: number; title: string; youtubeUrl: string }) =>
      api.post(`/v2/admin/lectures/${lectureId}/videos`, { title, youtubeUrl }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "course-lectures"] }),
  });
}
export function useDeleteVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/v2/admin/videos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "course-lectures"] }),
  });
}

// ===== Lecture PDFs =====
export function useAddLecturePdf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lectureId, name, url, sizeBytes }: { lectureId: number; name: string; url: string; sizeBytes?: number }) =>
      api.post(`/v2/admin/lectures/${lectureId}/pdfs`, { name, url, sizeBytes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "course-lectures"] });
      qc.invalidateQueries({ queryKey: ["v2", "course-files"] });
    },
  });
}
export function useDeleteLecturePdf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/v2/admin/lecture-pdfs/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "course-lectures"] });
      qc.invalidateQueries({ queryKey: ["v2", "course-files"] });
    },
  });
}

// ===== Lecture Quizzes =====
export function useCreateLectureQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lectureId, title, questions }: { lectureId: number; title: string; questions?: { text: string; options: string[]; correctIndex: number; points?: number }[] }) =>
      api.post(`/v2/admin/lectures/${lectureId}/quizzes`, { title, questions }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "course-lectures"] }),
  });
}
export function useAddQuizQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ quizId, text, options, correctIndex, points }: { quizId: number; text: string; options: string[]; correctIndex: number; points?: number }) =>
      api.post(`/v2/admin/quizzes/${quizId}/questions`, { text, options, correctIndex, points }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "course-lectures"] }),
  });
}
export function useDeleteLectureQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/v2/admin/lecture-quizzes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "course-lectures"] }),
  });
}
export function useAddLectureQuizQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ quizId, text, options, correctIndex, points }: { quizId: number; text: string; options: string[]; correctIndex: number; points?: number }) =>
      api.post(`/v2/admin/lecture-quizzes/${quizId}/questions`, { text, options, correctIndex, points }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "course-lectures"] }),
  });
}
export function useDeleteLectureQuizQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/v2/admin/lecture-quiz-questions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "course-lectures"] }),
  });
}
export function useDeleteQuizQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/v2/admin/quiz-questions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "course-lectures"] }),
  });
}

// ===== Student: Video Progress =====
export interface VideoProgressItem { videoId: number; completed: boolean; }
export function useCourseVideoProgress(courseId: number) {
  return useQuery<VideoProgressItem[]>({
    queryKey: ["v2", "video-progress", courseId],
    queryFn: () => api.get(`/v2/courses/${courseId}/video-progress`),
    enabled: courseId > 0,
  });
}
export function useMarkVideoWatched() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (videoId: number) => api.post(`/v2/videos/${videoId}/watch`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "video-progress"] });
      qc.invalidateQueries({ queryKey: ["v2", "course-progress"] });
    },
  });
}

// ===== Student: Lecture Quiz Submit =====
export function useSubmitLectureQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ quizId, answers }: { quizId: number; answers: { questionId: number; chosenIndex: number }[] }) =>
      api.post(`/v2/lecture-quizzes/${quizId}/submit`, { answers }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "course-progress"] });
      qc.invalidateQueries({ queryKey: ["v2", "lecture-quiz-attempts"] });
    },
  });
}
export function useLectureQuizAttempts(quizId: number) {
  return useQuery<any[]>({
    queryKey: ["v2", "lecture-quiz-attempts", quizId],
    queryFn: () => api.get(`/v2/lecture-quizzes/${quizId}/attempts`),
    enabled: quizId > 0,
  });
}

// ===== Student: Course Progress =====
export interface CourseProgress {
  totalItems: number;
  completedItems: number;
  percent: number;
  videos: { id: number; completed: boolean }[];
  quizzes: { id: number; completed: boolean }[];
}
export function useCourseProgress(courseId: number) {
  return useQuery<CourseProgress>({
    queryKey: ["v2", "course-progress", courseId],
    queryFn: () => api.get(`/v2/courses/${courseId}/progress`),
    enabled: courseId > 0,
  });
}

// ===== Events =====
export interface EventRow {
  id: number; title: string; description: string; kind: string;
  yearInCollege: number | null; groupName: string | null;
  dueAt: string; location: string | null;
  createdById: number; createdAt: string;
}
export function useEvents() {
  return useQuery<EventRow[]>({ queryKey: ["events"], queryFn: () => api.get("/events") });
}
export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; description?: string; kind?: string; yearInCollege?: number; groupName?: string; dueAt: string; location?: string }) =>
      api.post("/admin/events", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
}
export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/admin/events/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
}

// ===== Material file likes/views/comments =====
export interface MaterialFileFull extends MaterialFileRow {
  category: string;
  views: number;
  likes: number;
  likedByMe: boolean;
  viewedByMe: boolean;
}
export function useMaterialFile(id: number) {
  return useQuery<MaterialFileFull>({
    queryKey: ["v2", "material-file", id],
    queryFn: () => api.get(`/v2/material-files/${id}`),
    enabled: id > 0,
  });
}
export function useCountMaterialFileView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<{ counted: boolean }>(`/v2/material-files/${id}/view`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["v2", "material-file", id] });
      qc.invalidateQueries({ queryKey: ["v2", "course-files"] });
      qc.invalidateQueries({ queryKey: ["v2", "student-summaries"] });
    },
  });
}
export function useToggleMaterialFileLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<{ liked: boolean }>(`/v2/material-files/${id}/like`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["v2", "material-file", id] });
      qc.invalidateQueries({ queryKey: ["v2", "course-files"] });
      qc.invalidateQueries({ queryKey: ["v2", "student-summaries"] });
    },
  });
}
export interface FileComment {
  id: number; fileId: number; authorId: number; body: string; createdAt: string;
  authorName?: string; authorAvatar?: string | null; authorRole?: string;
}
export function useFileComments(id: number) {
  return useQuery<FileComment[]>({
    queryKey: ["v2", "file-comments", id],
    queryFn: () => api.get(`/v2/material-files/${id}/comments`),
    enabled: id > 0,
  });
}
export function useAddFileComment(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.post(`/v2/material-files/${id}/comments`, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "file-comments", id] }),
  });
}

// ===== Student summaries =====
export interface StudentSummaryRow extends MaterialFileRow {
  category: string;
  views: number;
  likes: number;
  uploaderTitle: string | null;
  uploaderAvatar: string | null;
  uploaderPoints: number;
}
export function useStudentSummaries() {
  return useQuery<StudentSummaryRow[]>({
    queryKey: ["v2", "student-summaries"],
    queryFn: () => api.get("/v2/student-summaries"),
  });
}
export function useCourseSummaries(courseId: number) {
  return useQuery<MaterialFileRow[]>({
    queryKey: ["v2", "course-summaries", courseId],
    queryFn: () => api.get(`/v2/courses/${courseId}/student-summaries`),
    enabled: courseId > 0,
  });
}
export function useUploadStudentSummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; kind: string; url: string; sizeBytes?: number; courseId: number }) =>
      api.post("/v2/student-summaries", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "student-summaries"] });
      qc.invalidateQueries({ queryKey: ["v2", "course-summaries"] });
      qc.invalidateQueries({ queryKey: ["v2", "me"] });
    },
  });
}
export function useDeleteStudentSummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/v2/student-summaries/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "student-summaries"] });
      qc.invalidateQueries({ queryKey: ["v2", "course-summaries"] });
    },
  });
}

// ===== Admin News flow =====
export interface AdminNewsRow {
  id: number; title: string; excerpt: string; body: string; category: string;
  imageUrl: string | null; author: string; authorId: number | null;
  status: string; publishedAt: string;
}
export function useAdminNews() {
  return useQuery<AdminNewsRow[]>({ queryKey: ["v2", "admin", "news"], queryFn: () => api.get("/v2/admin/news") });
}
export function useCreateAdminNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; excerpt: string; body: string; category: string; imageUrl?: string }) =>
      api.post("/v2/admin/news", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "admin", "news"] }),
  });
}
export function useApproveNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post(`/v2/admin/news/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "admin", "news"] }),
  });
}
export function useRejectNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      api.post(`/v2/admin/news/${id}/reject`, { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "admin", "news"] }),
  });
}
export function useDeleteAdminNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/v2/admin/news/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "admin", "news"] }),
  });
}

// User profile
export interface UserProfile {
  id: number; name: string; username: string | null; email: string; phone: string | null;
  role: string; groupName: string | null; avatarUrl: string | null; department: string;
  year: number | null; yearInCollege: number | null; specialization: string | null;
  points: number; level: number; streak: number; title: string | null; bio: string | null;
  lastSeen: string | null; createdAt: string | null;
  followerCount: number; followingCount: number; totalLikesReceived: number;
  forumPosts: any[]; talents: any[]; summaries: any[]; following: boolean;
}
export function useUserProfile(userId: number) {
  return useQuery<UserProfile>({
    queryKey: ["v2", "users", userId],
    queryFn: () => api.get(`/v2/users/${userId}`),
    enabled: userId > 0,
  });
}

// Admin delete mutations
export function useDeleteForumPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/admin/forum/posts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forum", "posts"] });
      qc.invalidateQueries({ queryKey: ["v2", "users"] });
    },
  });
}
export function useDeleteForumReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/admin/forum/replies/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forum", "posts"] });
      qc.invalidateQueries({ queryKey: ["v2", "users"] });
    },
  });
}
export function useDeleteTalent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/v2/admin/talents/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "talents-feed"] });
      qc.invalidateQueries({ queryKey: ["v2", "admin", "talents"] });
      qc.invalidateQueries({ queryKey: ["v2", "users"] });
    },
  });
}
export function useDeleteTalentComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/v2/admin/talent-comments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "talent-comments"] });
      qc.invalidateQueries({ queryKey: ["v2", "users"] });
    },
  });
}
export function useDeleteMaterialComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/v2/admin/material-comments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "material-comments"] });
    },
  });
}

