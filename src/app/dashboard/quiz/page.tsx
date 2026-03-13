import { getSubject, getSubjectTopics } from "@/app/actions"
import { QuizDashboardView } from "@/components/quiz-dashboard-view"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

type QuizSearchParams = {
  subject_id?: string
  view?: string
}

type TopicNode = {
  id: string
  data: {
    label: string
    status: string
  }
}

type QuizRow = {
  id: string
  subject_id: string | null
  subject_name: string
  difficulty: number
  topics: unknown
  questions: unknown
  created_at: string
}

type QuizResultRow = {
  id: string
  quiz_id: string
  score: number
  total_questions: number
  user_answers: Record<string, unknown>
  created_at: string
}

function formatTopics(raw: unknown) {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item)).filter(Boolean)
  }
  if (typeof raw === "object" && typeof raw.raw === "string") {
    return raw.raw
      .split(",")
      .map((item: string) => item.trim())
      .filter(Boolean)
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

export default async function QuizSetupPage(props: {
  searchParams: Promise<QuizSearchParams>
}) {
  const searchParams = await props.searchParams
  const subjectId = searchParams.subject_id
  const isAttemptView = searchParams.view === "attempt"

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect("/login")
  }

  let subject = null
  let topics: { id: string; title: string }[] = []

  if (subjectId) {
    const { data } = await getSubject(subjectId)
    if (data) {
      subject = data
      const graphData = await getSubjectTopics(subjectId)
      topics = (graphData.nodes as TopicNode[])
        .filter(
          (n) =>
            n.data.status === "AVAILABLE" ||
            n.data.status === "COMPLETED" ||
            n.data.status === "GENERATED"
        )
        .map((n) => ({ id: n.id, title: n.data.label }))
    }
  }

  let quizzes: QuizRow[] = []
  let results: QuizResultRow[] = []

  const quizzesResponse = await supabase
    .from("quizzes")
    .select("id, subject_id, subject_name, difficulty, topics, questions, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (!quizzesResponse.error && quizzesResponse.data) {
    quizzes = quizzesResponse.data as QuizRow[]
  }

  const resultsResponse = await supabase
    .from("quiz_results")
    .select("id, quiz_id, score, total_questions, user_answers, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (!resultsResponse.error && resultsResponse.data) {
    results = resultsResponse.data as QuizResultRow[]
  }

  const quizMap = new Map(quizzes.map((quiz) => [quiz.id, quiz]))
  const history = results
    .map((result) => {
      const quiz = quizMap.get(result.quiz_id)
      if (!quiz) return null

      const questionCount = Array.isArray(quiz.questions)
        ? quiz.questions.length
        : result.total_questions || 0
      const percentage =
        result.total_questions > 0
          ? Math.round((result.score / result.total_questions) * 100)
          : 0

      return {
        id: result.id,
        quizId: result.quiz_id,
        subjectId: quiz.subject_id,
        subjectName: quiz.subject_name,
        difficulty: quiz.difficulty,
        questionCount,
        score: result.score,
        totalQuestions: result.total_questions,
        percentage,
        topics: formatTopics(quiz.topics),
        attemptedAt: result.created_at,
      }
    })
    .filter(Boolean) as {
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
  }[]

  const totalAttempts = history.length
  const totalCorrectAnswers = history.reduce((sum, item) => sum + item.score, 0)
  const totalQuestionsAttempted = history.reduce(
    (sum, item) => sum + item.totalQuestions,
    0
  )
  const incorrectAnswers = Math.max(
    totalQuestionsAttempted - totalCorrectAnswers,
    0
  )
  const averageScore =
    totalAttempts > 0
      ? Math.round(
          history.reduce((sum, item) => sum + item.percentage, 0) / totalAttempts
        )
      : 0
  const bestScore = history.reduce(
    (best, item) => Math.max(best, item.percentage),
    0
  )
  const averageDifficulty =
    totalAttempts > 0
      ? (
          history.reduce((sum, item) => sum + item.difficulty, 0) / totalAttempts
        ).toFixed(1)
      : "0.0"

  const performanceData = history
    .slice(0, 6)
    .reverse()
    .map((item, index) => ({
      label: `T${index + 1}`,
      score: item.percentage,
      questions: item.totalQuestions,
    }))

  const outcomeData =
    totalQuestionsAttempted > 0
      ? [
          { name: "Correct", value: totalCorrectAnswers, color: "#22c55e" },
          { name: "Incorrect", value: incorrectAnswers, color: "#f97316" },
        ]
      : [
          { name: "No Attempts", value: 1, color: "#52525b" },
        ]

  const analytics = {
    totalAttempts,
    averageScore,
    bestScore,
    averageDifficulty,
    totalQuestionsAttempted,
    performanceData,
    outcomeData,
    latestAttempt: history[0] ?? null,
  }

  return (
    <QuizDashboardView
      analytics={analytics}
      history={history}
      initialSubject={subject}
      initialTopics={topics}
      isAttemptView={isAttemptView}
    />
  )
}
