"use client"

import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Clock3,
  PieChart as PieChartIcon,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react"
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { QuizConfigForm } from "@/components/quiz-config-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type Topic = {
  id: string
  title: string
}

type Subject = {
  id: string
  title: string
  description?: string | null
} | null

type Analytics = {
  totalAttempts: number
  averageScore: number
  bestScore: number
  averageDifficulty: string
  totalQuestionsAttempted: number
  performanceData: { label: string; score: number; questions: number }[]
  outcomeData: { name: string; value: number; color: string }[]
  latestAttempt: {
    id: string
    quizId: string
    subjectName: string
    difficulty: number
    questionCount: number
    score: number
    totalQuestions: number
    percentage: number
    topics: string[]
    attemptedAt: string
  } | null
}

type HistoryItem = {
  id: string
  quizId: string
  subjectId?: string | null
  subjectName: string
  difficulty: number
  questionCount: number
  score: number
  totalQuestions: number
  percentage: number
  topics: string[]
  attemptedAt: string
}

interface QuizDashboardViewProps {
  analytics: Analytics
  history: HistoryItem[]
  initialSubject: Subject
  initialTopics: Topic[]
  isAttemptView: boolean
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function difficultyLabel(value: number) {
  if (value >= 5) return "Expert"
  if (value >= 4) return "Advanced"
  if (value >= 3) return "Balanced"
  if (value >= 2) return "Light"
  return "Starter"
}

function SummaryCard({
  title,
  value,
  accent,
}: {
  title: string
  value: string
  accent: string
}) {
  return (
    <Card className="border-white/10 bg-white/[0.03] py-0 text-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-zinc-400">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold ${accent}`}>{value}</div>
      </CardContent>
    </Card>
  )
}

export function QuizDashboardView({
  analytics,
  history,
  initialSubject,
  initialTopics,
  isAttemptView,
}: QuizDashboardViewProps) {
  if (isAttemptView) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-blue-300">
              <Sparkles className="h-3.5 w-3.5" />
              Attempt Quiz
            </div>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">Quiz Studio</h1>
            <p className="mt-2 text-sm text-zinc-400 sm:text-base">
              A focused space to configure and launch your next quiz.
            </p>
          </div>

          <Button
            asChild
            variant="outline"
            className="h-11 rounded-full border-white/10 bg-white/5 px-5 text-white hover:bg-white/10"
          >
            <Link href="/dashboard/quiz">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(37,99,235,0.12),rgba(9,9,11,0.95))] p-1 shadow-[0_35px_120px_rgba(0,0,0,0.5)]">
          <div className="rounded-[1.7rem] border border-white/10 bg-zinc-950/90 p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-3 text-blue-300">
              <BookOpen className="h-6 w-6" />
              <div>
                <h2 className="text-2xl font-bold text-white">Present Quiz Studio</h2>
                <p className="text-sm text-zinc-400">
                  Only the quiz builder lives here, so the flow stays clean and focused.
                </p>
              </div>
            </div>

            <QuizConfigForm initialSubject={initialSubject} initialTopics={initialTopics} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_30%),linear-gradient(145deg,rgba(24,24,27,0.96),rgba(9,9,11,0.92))] p-8 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-blue-300">
              <Sparkles className="h-3.5 w-3.5" />
              Quiz Analytics
            </div>
            <h1 className="max-w-2xl text-4xl font-bold leading-tight text-white sm:text-5xl">
              Your full quiz performance lives right here on the quiz page.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
              Review attempt metrics, answer quality, latest parameters, and complete history without
              leaving the main quiz dashboard.
            </p>
          </div>

          <div className="mt-12 border-t border-white/10 pt-6">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-zinc-400">
                Start a new attempt whenever you want from this quick action area.
              </div>
              <Button
                asChild
                className="h-12 rounded-full bg-white px-6 font-semibold text-black hover:bg-zinc-200"
              >
                <Link href="/dashboard/quiz?view=attempt">
                  Attempt Quiz
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300">
                <Clock3 className="h-4 w-4 text-zinc-500" />
                Last activity:{" "}
                {analytics.latestAttempt
                  ? formatDate(analytics.latestAttempt.attemptedAt)
                  : "No quizzes attempted yet"}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SummaryCard
            title="Attempts Recorded"
            value={String(analytics.totalAttempts)}
            accent="text-blue-300"
          />
          <SummaryCard
            title="Average Score"
            value={`${analytics.averageScore}%`}
            accent="text-emerald-300"
          />
          <SummaryCard
            title="Best Score"
            value={`${analytics.bestScore}%`}
            accent="text-amber-300"
          />
          <SummaryCard
            title="Avg Difficulty"
            value={analytics.averageDifficulty}
            accent="text-fuchsia-300"
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <Card className="border-white/10 bg-zinc-950/70 py-0 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-blue-400" />
                Recent Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[260px] pb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.performanceData}>
                  <XAxis
                    dataKey="label"
                    stroke="#71717a"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#71717a"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    contentStyle={{
                      backgroundColor: "#09090b",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "1rem",
                      color: "#fff",
                    }}
                    formatter={(value) => [`${value ?? 0}%`, "Score"]}
                  />
                  <Bar dataKey="score" radius={[10, 10, 0, 0]} fill="#60a5fa" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-zinc-950/70 py-0 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PieChartIcon className="h-4 w-4 text-amber-400" />
                Answer Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[260px] pb-6">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.outcomeData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={92}
                    paddingAngle={3}
                  >
                    {analytics.outcomeData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#09090b",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "1rem",
                      color: "#fff",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-white/10 bg-zinc-950/70 py-0 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-violet-400" />
                Latest Attempt Parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pb-6 text-sm">
              {analytics.latestAttempt ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-500">Subject</p>
                      <p className="font-semibold text-white">{analytics.latestAttempt.subjectName}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-500">Difficulty</p>
                      <p className="font-semibold text-white">
                        {analytics.latestAttempt.difficulty} / 5{" "}
                        <span className="text-zinc-400">
                          ({difficultyLabel(analytics.latestAttempt.difficulty)})
                        </span>
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-500">Question Count</p>
                      <p className="font-semibold text-white">{analytics.latestAttempt.questionCount}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-500">Score</p>
                      <p className="font-semibold text-white">
                        {analytics.latestAttempt.score} / {analytics.latestAttempt.totalQuestions} (
                        {analytics.latestAttempt.percentage}%)
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">Topics Used</p>
                    <div className="flex flex-wrap gap-2">
                      {analytics.latestAttempt.topics.length > 0 ? (
                        analytics.latestAttempt.topics.map((topic) => (
                          <span
                            key={topic}
                            className="rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs text-blue-200"
                          >
                            {topic}
                          </span>
                        ))
                      ) : (
                        <span className="text-zinc-500">General quiz coverage</span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-zinc-500">
                  No attempts yet. Finish your first quiz and this panel will show the selected
                  parameters automatically.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-zinc-950/70 py-0 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4 text-emerald-400" />
                Quiz Snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 pb-6 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Questions Tracked</p>
                <p className="mt-2 text-2xl font-bold text-cyan-300">
                  {analytics.totalQuestionsAttempted}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Best Session</p>
                <p className="mt-2 text-2xl font-bold text-emerald-300">{analytics.bestScore}%</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Average Accuracy</p>
                <p className="mt-2 text-2xl font-bold text-amber-300">{analytics.averageScore}%</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-8 border-white/10 bg-zinc-950/70 py-0 text-white">
        <CardHeader>
          <CardTitle className="text-base">Attempt History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pb-6">
          {history.length > 0 ? (
            history.map((item) => (
              <div
                key={item.id}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <h4 className="text-lg font-semibold text-white">{item.subjectName}</h4>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-zinc-400">
                        {difficultyLabel(item.difficulty)}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-500">{formatDate(item.attemptedAt)}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-right">
                      <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">Score</p>
                      <p className="text-lg font-bold text-emerald-300">{item.percentage}%</p>
                    </div>
                    <Button
                      asChild
                      variant="outline"
                      className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      <Link href={`/dashboard/quiz/${item.quizId}/results?result_id=${item.id}`}>
                        View Result
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Difficulty</p>
                    <p className="mt-1 font-medium text-white">{item.difficulty} / 5</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Questions</p>
                    <p className="mt-1 font-medium text-white">{item.questionCount}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Correct</p>
                    <p className="mt-1 font-medium text-white">
                      {item.score} / {item.totalQuestions}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Topics Used</p>
                    <p className="mt-1 font-medium text-white">
                      {item.topics.length > 0 ? item.topics.length : "General"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {item.topics.length > 0 ? (
                    item.topics.map((topic) => (
                      <span
                        key={`${item.id}-${topic}`}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300"
                      >
                        {topic}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-500">
                      General topic selection
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-8 text-center text-zinc-500">
              Finish a quiz once, and the full attempt history will start appearing here.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
