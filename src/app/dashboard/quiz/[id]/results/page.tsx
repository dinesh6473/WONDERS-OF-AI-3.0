import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, XCircle, ArrowLeft, ArrowRight, BarChart3, RefreshCcw, BrainCircuit } from "lucide-react"
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
    const answersMap = user_answers?.answers ?? user_answers ?? {}
    const visitedQuestionIndexes = Array.isArray(user_answers?.visited_question_indexes)
        ? user_answers.visited_question_indexes
        : []
    const quizzesData = Array.isArray(quizResult.quizzes) ? quizResult.quizzes[0] : quizResult.quizzes
    const fallbackQuestions = quizzesData?.questions || []
    const questions = Array.isArray(user_answers?.evaluated_questions)
        ? user_answers.evaluated_questions
        : (visitedQuestionIndexes.length > 0
            ? visitedQuestionIndexes.map((index: number) => fallbackQuestions[index]).filter(Boolean)
            : fallbackQuestions)

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
            <div className="flex items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3 text-blue-400">
                    <BarChart3 className="h-6 w-6" />
                    <h1 className="text-2xl font-bold text-white">Quiz Analytics</h1>
                </div>

                <Link href="/dashboard/quiz">
                    <button className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition-all hover:bg-white/10 hover:text-white">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Quiz Page
                    </button>
                </Link>
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
                    reference_answer?: string
                    explanation: string
                }, index: number) => {
                    const originalIndex = visitedQuestionIndexes.length > 0 ? visitedQuestionIndexes[index] : index
                    const userAnswer = answersMap[originalIndex]
                    const aiEvaluation = user_answers?.ai_evaluations?.[originalIndex]
                    const isMulti = q.type === 'multi_mcq'
                    const isTheoretical = q.type === 'theoretical'
                    
                    // Logic to check correctness to show X or Check mark locally
                    let isCorrect = false
                    const normalizedUserString = String(userAnswer || "").trim().toLowerCase()
                    const normalizedCorrectString = String(q.correct_answer || "").trim().toLowerCase()

                    if (isTheoretical) {
                        isCorrect = aiEvaluation ? aiEvaluation.rating >= 2.5 : false
                    } else if (isMulti) {
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
                                    <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wider">{isTheoretical ? "Reference Answer" : "Correct Answer"}</p>
                                    <p className="font-medium text-green-400">
                                        {isTheoretical 
                                            ? (q.reference_answer || "N/A")
                                            : isMulti 
                                                ? (Array.isArray(q.correct_answer) ? q.correct_answer.join(", ") : "N/A")
                                                : q.correct_answer}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5 text-sm text-blue-200/80 leading-relaxed">
                                {isTheoretical && aiEvaluation ? (
                                    <>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-semibold text-blue-400 block">AI Evaluation:</span>
                                            <span className="text-blue-300 font-bold px-2 py-0.5 rounded border border-blue-500/30 bg-blue-500/20">Score: {Number(aiEvaluation.rating).toFixed(2)} / 5.00</span>
                                        </div>
                                        {/* Multi-Axis Rubric */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                                            {[
                                                { label: "Accuracy", score: aiEvaluation.accuracy_score || 0, color: "text-blue-400", bg: "bg-blue-500" },
                                                { label: "Completeness", score: aiEvaluation.completeness_score || 0, color: "text-purple-400", bg: "bg-purple-500" },
                                                { label: "Clarity", score: aiEvaluation.clarity_score || 0, color: "text-emerald-400", bg: "bg-emerald-500" }
                                            ].map((axis, idx) => (
                                                <div key={idx} className="bg-black/20 border border-white/5 rounded-xl p-3 flex flex-col justify-center">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className={`text-xs font-bold uppercase tracking-wider ${axis.color}`}>{axis.label}</span>
                                                        <span className={`text-sm font-bold ${axis.color}`}>{Number(axis.score).toFixed(1)}/5</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full ${axis.bg} transition-all duration-1000 ease-out`}
                                                            style={{ width: `${(axis.score / 5) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Baseline Expectation */}
                                        {aiEvaluation.ideal_answer && (
                                            <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-5 mb-6 shadow-inner">
                                                <h5 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                    <BrainCircuit className="w-4 h-4" /> AI Baseline Expectation
                                                </h5>
                                                <p className="text-indigo-100/90 text-sm leading-relaxed">
                                                    {aiEvaluation.ideal_answer}
                                                </p>
                                            </div>
                                        )}

                                        {/* Diagnostic Breakdown */}
                                        {aiEvaluation.detailed_analysis && (
                                            <div className="space-y-4 mb-6">
                                                {(() => {
                                                    const correctAspects = Array.isArray(aiEvaluation.detailed_analysis.correct_aspects) 
                                                        ? aiEvaluation.detailed_analysis.correct_aspects 
                                                        : typeof aiEvaluation.detailed_analysis.correct_aspects === 'string' 
                                                            ? [aiEvaluation.detailed_analysis.correct_aspects] 
                                                            : [];
                                                    const missingConcepts = Array.isArray(aiEvaluation.detailed_analysis.missing_concepts)
                                                        ? aiEvaluation.detailed_analysis.missing_concepts
                                                        : typeof aiEvaluation.detailed_analysis.missing_concepts === 'string'
                                                            ? [aiEvaluation.detailed_analysis.missing_concepts]
                                                            : [];
                                                    const misconceptions = Array.isArray(aiEvaluation.detailed_analysis.misconceptions)
                                                        ? aiEvaluation.detailed_analysis.misconceptions
                                                        : typeof aiEvaluation.detailed_analysis.misconceptions === 'string'
                                                            ? [aiEvaluation.detailed_analysis.misconceptions]
                                                            : [];

                                                    return (
                                                        <>
                                                            {correctAspects.length > 0 && (
                                                                <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                                                                    <h5 className="text-sm font-bold text-green-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                                        <CheckCircle2 className="w-4 h-4" /> What You Got Right
                                                                    </h5>
                                                                    <ul className="space-y-2">
                                                                        {correctAspects.map((item: string, idx: number) => (
                                                                            <li key={idx} className="text-sm text-green-200/90 flex gap-2 items-start">
                                                                                <span className="text-green-500/50 mt-1">•</span> {item}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                            
                                                            {missingConcepts.length > 0 && (
                                                                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                                                                    <h5 className="text-sm font-bold text-amber-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                                        <AlertTriangle className="w-4 h-4" /> Missing Concepts
                                                                    </h5>
                                                                    <ul className="space-y-2">
                                                                        {missingConcepts.map((item: string, idx: number) => (
                                                                            <li key={idx} className="text-sm text-amber-200/90 flex gap-2 items-start">
                                                                                <span className="text-amber-500/50 mt-1">•</span> {item}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}

                                                            {misconceptions.length > 0 && (
                                                                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                                                                    <h5 className="text-sm font-bold text-red-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                                        <XCircle className="w-4 h-4" /> Misconceptions & Errors
                                                                    </h5>
                                                                    <ul className="space-y-2">
                                                                        {misconceptions.map((item: string, idx: number) => (
                                                                            <li key={idx} className="text-sm text-red-200/90 flex gap-2 items-start">
                                                                                <span className="text-red-500/50 mt-1">•</span> {item}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        )}

                                        <div className="mb-4">
                                            <span className="font-bold text-blue-400 uppercase tracking-wider text-xs block mb-2">Detailed Feedback</span>
                                            {aiEvaluation.explanation}
                                        </div>

                                        {aiEvaluation.improvement_suggestion && (
                                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex gap-3 items-start">
                                                <div className="mt-0.5 text-amber-500">💡</div>
                                                <div>
                                                    <h5 className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1">How to Improve</h5>
                                                    <p className="text-sm text-amber-200/90 font-medium">"{aiEvaluation.improvement_suggestion}"</p>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <span className="font-semibold text-blue-400 block mb-1">AI Explanation:</span>
                                        {q.explanation}
                                    </>
                                )}
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

                <Link href={quizzesData?.subject_id ? `/dashboard/subject/${quizzesData.subject_id}` : '/dashboard'}>
                    <button className="flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-xl hover:bg-white/90 font-medium transition-all hover:scale-105">
                        Back to Dashboard
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </Link>
            </div>
        </div>
    )
}
