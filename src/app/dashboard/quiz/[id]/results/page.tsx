import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, XCircle, ArrowRight, BarChart3, RefreshCcw } from "lucide-react"
import { cn } from "@/lib/utils"

export default async function QuizResultsPage({ 
    params, 
    searchParams 
}: { 
    params: Promise<{ id: string }>,
    searchParams: Promise<{ result_id?: string }>
}) {
    const { id } = await params
    const { result_id } = await searchParams
    
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return redirect('/login')
    if (!result_id) return redirect('/dashboard/quiz')

    // Fetch quiz and result
    const { data: quizResult, error: resultError } = await supabase
        .from('quiz_results')
        .select('*, quizzes(*)')
        .eq('id', result_id)
        .eq('user_id', user.id)
        .single()

    if (resultError || !quizResult) {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 text-center">
                <AlertTriangle className="h-10 w-10 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Results Not Found</h1>
                <p className="text-zinc-400 mb-6">Could not find these quiz results.</p>
                <Link href="/dashboard" className="px-6 py-2 bg-white text-black rounded-lg hover:bg-white/90">
                    Back to Dashboard
                </Link>
            </div>
        )
    }

    const { score, total_questions, user_answers } = quizResult
    const percentage = Math.round((score / total_questions) * 100)
    const questions = quizResult.quizzes.questions

    // Determine performance color
    let colorClass = "text-green-500"
    let bgClass = "bg-green-500/10 border-green-500/20"
    if (percentage < 50) {
        colorClass = "text-red-500"
        bgClass = "bg-red-500/10 border-red-500/20"
    } else if (percentage < 80) {
        colorClass = "text-amber-500"
        bgClass = "bg-amber-500/10 border-amber-500/20"
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
            <div className="flex items-center gap-3 text-blue-400 mb-8">
                <BarChart3 className="h-6 w-6" />
                <h1 className="text-2xl font-bold text-white">Quiz Analytics</h1>
            </div>

            {/* Score Summary */}
            <div className={`p-8 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-6 mb-12 ${bgClass}`}>
                <div>
                    <h2 className="text-xl font-medium text-white mb-1">Performance Summary</h2>
                    <p className="text-zinc-400 text-sm">You answered {score} out of {total_questions} questions correctly.</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-center">
                        <div className={`text-5xl font-bold ${colorClass}`}>
                            {percentage}%
                        </div>
                    </div>
                </div>
            </div>

            <h3 className="text-xl font-semibold text-white mb-6">Detailed Review</h3>
            
            <div className="space-y-6">
                {questions.map((q: {
                    type: string
                    difficulty_label?: string
                    question: string
                    correct_answer: string | string[]
                    explanation: string
                }, index: number) => {
                    const userAnswer = user_answers[index]
                    const isMulti = q.type === 'multi_mcq'
                    
                    // Logic to check correctness to show X or Check mark locally
                    let isCorrect = false
                    const normalizedUserString = String(userAnswer || "").trim().toLowerCase()
                    const normalizedCorrectString = String(q.correct_answer || "").trim().toLowerCase()

                    if (isMulti) {
                        const userArr = Array.isArray(userAnswer) ? userAnswer : []
                        const correctArr = Array.isArray(q.correct_answer) ? q.correct_answer : []
                        isCorrect = userArr.length === correctArr.length && userArr.every(val => correctArr.includes(val)) && userArr.length > 0
                    } else {
                        isCorrect = normalizedUserString === normalizedCorrectString && normalizedUserString !== ""
                    }

                    const isSkipped = !userAnswer || (Array.isArray(userAnswer) && userAnswer.length === 0)

                    return (
                        <div key={index} className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 sm:p-8 relative overflow-hidden">
                            {/* Status Indicator */}
                            <div className={cn(
                                "absolute top-0 right-0 p-4 flex items-center gap-2 font-medium text-sm rounded-bl-2xl",
                                isCorrect ? "bg-green-500/20 text-green-400" : 
                                isSkipped ? "bg-zinc-500/10 text-zinc-500" : "bg-red-500/20 text-red-400"
                            )}>
                                {isCorrect ? (
                                    <><CheckCircle2 className="w-5 h-5" /> Correct</>
                                ) : isSkipped ? (
                                    <><div className="w-4 h-4 rounded-full border-2 border-zinc-500" /> Skipped</>
                                ) : (
                                    <><XCircle className="w-5 h-5" /> Incorrect</>
                                )}
                            </div>

                            <div className="pr-24">
                                <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2 font-semibold flex gap-2">
                                    <span>Question {index + 1}</span>
                                    <span>•</span>
                                    <span className={
                                        q.difficulty_label === "Hard" ? "text-red-400" : 
                                        q.difficulty_label === "Medium" ? "text-amber-400" : "text-green-400"
                                    }>{q.difficulty_label}</span>
                                </div>
                                <h4 className="text-lg text-white mb-6 leading-relaxed">{q.question}</h4>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-6 mb-6 pt-4 border-t border-white/10">
                                <div>
                                    <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wider">Your Answer</p>
                                    <p className={cn(
                                        "font-medium",
                                        isCorrect ? "text-green-400" : isSkipped ? "text-zinc-500 italic" : "text-red-400"
                                    )}>
                                        {isMulti 
                                            ? (Array.isArray(userAnswer) && userAnswer.length > 0 ? userAnswer.join(", ") : "Skipped")
                                            : (userAnswer || "Skipped")}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wider">Correct Answer</p>
                                    <p className="font-medium text-green-400">
                                        {isMulti 
                                            ? (Array.isArray(q.correct_answer) ? q.correct_answer.join(", ") : "N/A")
                                            : q.correct_answer}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5 text-sm text-blue-200/80 leading-relaxed">
                                <span className="font-semibold text-blue-400 block mb-1">AI Explanation:</span>
                                {q.explanation}
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="mt-12 flex items-center justify-between">
                <Link href="/dashboard/quiz">
                    <button className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
                        <RefreshCcw className="w-4 h-4" />
                        Generate New Quiz
                    </button>
                </Link>

                <Link href={`/dashboard/subject/${quizResult.quizzes.subject_name ? '?' : ''}`}>
                    <button className="flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-xl hover:bg-white/90 font-medium transition-all hover:scale-105">
                        Back to Dashboard
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </Link>
            </div>
        </div>
    )
}
