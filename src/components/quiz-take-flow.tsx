'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { generateMoreQuizQuestions, submitQuiz, evaluateTheoreticalAnswer } from '@/app/actions'
import { Loader2, ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, BrainCircuit } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuizTakeFlowProps {
    quiz: any
}

export function QuizTakeFlow({ quiz }: QuizTakeFlowProps) {
    const router = useRouter()
    const [isSubmitting, startTransition] = useTransition()
    const [currentIndex, setCurrentIndex] = useState(0)
    const [checkedQuestions, setCheckedQuestions] = useState<Record<number, { 
        rating: number, 
        overall_score: number,
        accuracy_score: number,
        completeness_score: number,
        clarity_score: number,
        explanation: string, 
        ideal_answer: string,
        detailed_analysis: {
            correct_aspects: string[],
            missing_concepts: string[],
            misconceptions: string[]
        },
        improvement_suggestion: string 
    }>>({})
    const [isChecking, setIsChecking] = useState(false)
    const [questions, setQuestions] = useState(quiz.questions || [])
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const visitedQuestionIndexesRef = useRef<Set<number>>(new Set([0]))
    
    // Store user answers keyed by question index.
    // For single_mcq/fill_in: string. For multi_mcq: string[]
    const [answers, setAnswers] = useState<Record<number, any>>({})

    const total = questions.length
    const targetCount = typeof quiz.topics?.target_count === 'number'
        ? quiz.topics.target_count
        : questions.length
    
    // Short-circuit if empty
    if (total === 0) {
        return <div className="text-center p-8 text-zinc-400">This quiz has no questions.</div>
    }

    const currentQuestion = questions[currentIndex]
    const currentEvaluation = checkedQuestions[currentIndex]
    const isCurrentAnswerChecked = !!currentEvaluation

    useEffect(() => {
        visitedQuestionIndexesRef.current.add(currentIndex)
    }, [currentIndex])

    function handleSingleSelect(option: string) {
        if (isCurrentAnswerChecked) return
        setAnswers(prev => ({ ...prev, [currentIndex]: option }))
    }

    function handleMultiSelect(option: string) {
        if (isCurrentAnswerChecked) return
        setAnswers(prev => {
            const currentArr = Array.isArray(prev[currentIndex]) ? prev[currentIndex] : []
            if (currentArr.includes(option)) {
                return { ...prev, [currentIndex]: currentArr.filter((o: string) => o !== option) }
            } else {
                return { ...prev, [currentIndex]: [...currentArr, option] }
            }
        })
    }

    function handleTextInput(text: string) {
        if (isCurrentAnswerChecked) return
        setAnswers(prev => ({ ...prev, [currentIndex]: text }))
    }

    function handleNext() {
        if (currentIndex < total - 1) {
            setCurrentIndex(prev => prev + 1)
        }
    }

    function handlePrev() {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1)
        }
    }

    async function handleCheckCurrentAnswer() {
        if (!currentAnswer || currentAnswer.trim() === '') return
        
        setIsChecking(true)
        try {
            const result = await evaluateTheoreticalAnswer(
                currentQuestion.question,
                currentAnswer,
                currentQuestion.reference_answer || "No reference answer provided"
            )
            
            setCheckedQuestions(prev => ({
                ...prev,
                [currentIndex]: result
            }))
        } catch (e: any) {
            console.error("Evaluation failed", e)
            alert("Evaluation failed: " + e.message)
        } finally {
            setIsChecking(false)
        }
    }

    async function ensureMoreQuestions() {
        if (isLoadingMore || questions.length >= targetCount) return

        setIsLoadingMore(true)
        try {
            const desiredCount = Math.min(20, targetCount - questions.length)
            const result = await generateMoreQuizQuestions({
                quizId: quiz.id,
                currentQuestions: questions,
                desiredCount,
            })

            if (result.error) {
                console.error('Failed to load more questions:', result.error)
            } else if (result.data && result.data.length > 0) {
                setQuestions((prev: any[]) => [...prev, ...result.data])
            }
        } catch (error) {
            console.error('Failed to load more questions:', error)
        } finally {
            setIsLoadingMore(false)
        }
    }

    useEffect(() => {
        const remainingVisible = questions.length - currentIndex - 1
        if (remainingVisible <= 5 && questions.length < targetCount) {
            void ensureMoreQuestions()
        }
    }, [currentIndex, questions.length, targetCount])

    function handleSubmit() {
        startTransition(async () => {
             try {
                const resultId = await submitQuiz(
                    quiz.id,
                    answers,
                    questions,
                    Array.from(visitedQuestionIndexesRef.current).sort((a, b) => a - b),
                    checkedQuestions
                )
                router.push(`/dashboard/quiz/${quiz.id}/results?result_id=${resultId}`)
             } catch (e: any) {
                 console.error("Submission failed", e)
                 alert("Failed to submit quiz: " + e.message)
             }
        })
    }

    const isLast = currentIndex === total - 1
    const currentAnswer = answers[currentIndex]
    
    // Logic to check correctness for instant feedback
    let isCorrect = false
    if (isCurrentAnswerChecked && currentEvaluation) {
        isCorrect = currentEvaluation.rating >= 2.5
    }

    return (
        <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
            {/* Header / Progress */}
            <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex flex-col">
                        <span className="text-zinc-400 text-sm font-medium">
                            Question {currentIndex + 1} of {Math.max(total, targetCount)}
                        </span>
                        <span className="uppercase text-[10px] tracking-wider mt-1 px-2 py-0.5 rounded bg-white/5 border border-white/10 w-fit text-zinc-500">
                            {currentQuestion.difficulty_label || "Standard"}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        {isLoadingMore && (
                            <div className="flex items-center gap-2 text-xs text-blue-300">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Loading more
                            </div>
                        )}
                        <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="text-red-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 font-bold"
                        >
                            Finish Quiz
                        </Button>
                    </div>
                </div>
                
                {/* Navigation Grid */}
                <div className="flex flex-wrap gap-2">
                    {questions.map((q: any, i: number) => {
                        const isVisited = visitedQuestionIndexesRef.current.has(i)
                        const evalResult = checkedQuestions[i]
                        return (
                            <button
                                key={i}
                                onClick={() => setCurrentIndex(i)}
                                className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all border",
                                    currentIndex === i 
                                        ? "bg-blue-600 text-white border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] scale-110 z-10" 
                                        : evalResult 
                                            ? evalResult.rating >= 2.5 ? "bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30"
                                            : isVisited 
                                                ? "bg-white/10 text-white border-white/20 hover:bg-white/20" 
                                                : "bg-black/40 text-zinc-500 border-white/5 hover:border-white/10 hover:text-zinc-300"
                                )}
                            >
                                {i + 1}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Question Card */}
            <div className="bg-zinc-900/40 backdrop-blur-sm border border-white/10 rounded-3xl p-6 sm:p-10 mb-8 min-h-[350px] flex flex-col shadow-2xl relative overflow-hidden">
                {/* Status Overlay for Checked Answers */}
                {isCurrentAnswerChecked && (
                    <div className={cn(
                        "absolute top-0 right-0 px-6 py-2 rounded-bl-2xl flex items-center gap-2 font-bold text-sm tracking-wider uppercase",
                        isCorrect ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                    )}>
                        {isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        {isCorrect ? "Correct" : "Incorrect"}
                    </div>
                )}

                <h2 className="text-xl sm:text-2xl font-semibold text-white mb-8 leading-tight pr-20">
                    {currentQuestion.question}
                </h2>

                <div className="flex-1 flex flex-col justify-center">
                    <div className="space-y-4 h-full flex flex-col">
                        <Textarea 
                            autoFocus
                            disabled={isCurrentAnswerChecked || isChecking}
                            value={currentAnswer || ''}
                            onChange={(e) => handleTextInput(e.target.value)}
                            placeholder="Type your detailed answer here..."
                            className={cn(
                                "flex-1 min-h-[200px] bg-black/60 border-white/10 text-lg rounded-2xl p-6 shadow-inner transition-colors resize-none",
                                isCurrentAnswerChecked 
                                    ? isCorrect ? "border-green-500/50 text-green-400 focus-visible:ring-0" : "border-amber-500/50 text-amber-400 focus-visible:ring-0"
                                    : "text-white focus-visible:ring-blue-500",
                                isChecking && "opacity-50"
                            )}
                        />
                    </div>
                </div>

                {/* Instant Feedback Explanation */}
                {isCurrentAnswerChecked && currentEvaluation && (
                    <div className="mt-8 pt-6 border-t border-white/5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <BrainIcon className="w-5 h-5 text-blue-400" />
                                <h4 className="text-sm font-bold text-blue-400 uppercase tracking-wider">AI Evaluation</h4>
                            </div>
                            <div className={cn(
                                "px-4 py-1.5 rounded-full font-bold text-lg border",
                                currentEvaluation.overall_score >= 4 ? "bg-green-500/20 text-green-400 border-green-500/30" : 
                                currentEvaluation.overall_score >= 2.5 ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : 
                                "bg-red-500/20 text-red-400 border-red-500/30"
                            )}>
                                {Number(currentEvaluation.overall_score).toFixed(2)} / 5.00
                            </div>
                        </div>

                        {/* Multi-Axis Rubric */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                            {[
                                { label: "Accuracy", score: currentEvaluation.accuracy_score, color: "text-blue-400", bg: "bg-blue-500" },
                                { label: "Completeness", score: currentEvaluation.completeness_score, color: "text-purple-400", bg: "bg-purple-500" },
                                { label: "Clarity", score: currentEvaluation.clarity_score, color: "text-emerald-400", bg: "bg-emerald-500" }
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
                        {currentEvaluation.ideal_answer && (
                            <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-5 mb-6 shadow-inner">
                                <h5 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <BrainCircuit className="w-4 h-4" /> AI Baseline Expectation
                                </h5>
                                <p className="text-indigo-100/90 text-sm leading-relaxed">
                                    {currentEvaluation.ideal_answer}
                                </p>
                            </div>
                        )}

                        {/* Diagnostic Breakdown */}
                        {currentEvaluation.detailed_analysis && (
                            <div className="space-y-4 mb-6">
                                {(() => {
                                    const correctAspects = Array.isArray(currentEvaluation.detailed_analysis.correct_aspects) 
                                        ? currentEvaluation.detailed_analysis.correct_aspects 
                                        : typeof currentEvaluation.detailed_analysis.correct_aspects === 'string' 
                                            ? [currentEvaluation.detailed_analysis.correct_aspects] 
                                            : [];
                                    const missingConcepts = Array.isArray(currentEvaluation.detailed_analysis.missing_concepts)
                                        ? currentEvaluation.detailed_analysis.missing_concepts
                                        : typeof currentEvaluation.detailed_analysis.missing_concepts === 'string'
                                            ? [currentEvaluation.detailed_analysis.missing_concepts]
                                            : [];
                                    const misconceptions = Array.isArray(currentEvaluation.detailed_analysis.misconceptions)
                                        ? currentEvaluation.detailed_analysis.misconceptions
                                        : typeof currentEvaluation.detailed_analysis.misconceptions === 'string'
                                            ? [currentEvaluation.detailed_analysis.misconceptions]
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

                        <div className="bg-blue-600/5 border border-blue-500/20 rounded-2xl p-5 text-sm text-blue-100/90 leading-relaxed shadow-inner mb-4">
                            <span className="font-bold text-blue-400 uppercase tracking-wider text-xs block mb-2">Detailed Feedback</span>
                            {currentEvaluation.explanation}
                        </div>
                        
                        {currentEvaluation.improvement_suggestion && (
                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex gap-3 items-start">
                                <div className="mt-0.5 text-amber-500">💡</div>
                                <div>
                                    <h5 className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1">How to Improve</h5>
                                    <p className="text-sm text-amber-200/90 font-medium">"{currentEvaluation.improvement_suggestion}"</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Navigation Footer */}
            <div className="flex items-center justify-between gap-4">
                <Button 
                    variant="outline" 
                    onClick={handlePrev}
                    disabled={currentIndex === 0 || isSubmitting}
                    className="h-12 border-white/10 text-zinc-400 hover:text-white group px-6 rounded-xl hover:bg-white/5"
                >
                    <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                    Back
                </Button>

                <div className="flex gap-4">
                    {!isCurrentAnswerChecked && (
                        <Button 
                            onClick={handleCheckCurrentAnswer}
                            disabled={!currentAnswer || currentAnswer.trim() === '' || isChecking}
                            className="h-12 bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-900/20 group px-10 rounded-xl font-bold transition-all hover:scale-105 active:scale-95 disabled:scale-100"
                        >
                            {isChecking ? <Loader2 className="w-5 h-5 animate-spin" /> : "Evaluate Answer"}
                            {!isChecking && <CheckCircle2 className="w-4 h-4 ml-2 transition-transform group-hover:scale-110" />}
                        </Button>
                    )}

                    {currentIndex < total - 1 ? (
                        <Button 
                            onClick={handleNext}
                            variant={isCurrentAnswerChecked ? "default" : "outline"}
                            className={cn(
                                "h-12 group px-8 rounded-xl font-bold transition-all hover:scale-105 active:scale-95",
                                isCurrentAnswerChecked 
                                    ? "bg-white text-black hover:bg-zinc-200" 
                                    : "border-white/10 text-zinc-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            {isCurrentAnswerChecked ? "Next Question" : "Skip/Next"}
                            <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                        </Button>
                    ) : (
                        <Button 
                            onClick={questions.length < targetCount ? ensureMoreQuestions : handleSubmit}
                            disabled={isSubmitting || isLoadingMore}
                            className="h-12 bg-green-600 hover:bg-green-500 text-white shadow-xl shadow-green-900/20 group px-10 rounded-xl font-bold transition-all hover:scale-105 active:scale-95"
                        >
                            {isSubmitting || isLoadingMore ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    {isLoadingMore ? 'Loading More...' : 'Finalizing...'}
                                </>
                            ) : (
                                <>
                                    {questions.length < targetCount ? 'Load Next Questions' : 'Complete Quiz'}
                                    <CheckCircle2 className="w-4 h-4 ml-2 transition-transform group-hover:scale-110" />
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}

function XCircle(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <path d="m15 9-6 6" />
            <path d="m9 9 6 6" />
        </svg>
    )
}

function BrainIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
            <path d="M14.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1 4.96.44 2.5 2.5 0 0 1 2.96-3.08 3 3 0 0 1 .34-5.58 2.5 2.5 0 0 1-1.32-4.24 2.5 2.5 0 0 1-1.98-3A2.5 2.5 0 0 1 14.5 2Z" />
        </svg>
    )
}
