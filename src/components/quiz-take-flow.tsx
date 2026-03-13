'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { submitQuiz } from '@/app/actions'
import { Loader2, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuizTakeFlowProps {
    quiz: any
}

export function QuizTakeFlow({ quiz }: QuizTakeFlowProps) {
    const router = useRouter()
    const [isSubmitting, startTransition] = useTransition()
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isCurrentAnswerChecked, setIsCurrentAnswerChecked] = useState(false)
    
    // Store user answers keyed by question index.
    // For single_mcq/fill_in: string. For multi_mcq: string[]
    const [answers, setAnswers] = useState<Record<number, any>>({})

    const questions = quiz.questions || []
    const total = questions.length
    
    // Short-circuit if empty
    if (total === 0) {
        return <div className="text-center p-8 text-zinc-400">This quiz has no questions.</div>
    }

    const currentQuestion = questions[currentIndex]

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
            setIsCurrentAnswerChecked(false)
        }
    }

    function handlePrev() {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1)
            setIsCurrentAnswerChecked(true) // If going back, we assume they checked it already
        }
    }

    function handleSubmit() {
        startTransition(async () => {
             try {
                const resultId = await submitQuiz(quiz.id, answers, questions)
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
    if (isCurrentAnswerChecked) {
        const normalizedUser = String(currentAnswer || "").trim().toLowerCase()
        const normalizedCorrect = String(currentQuestion.correct_answer || "").trim().toLowerCase()
        
        if (currentQuestion.type === 'multi_mcq') {
            const userArr = Array.isArray(currentAnswer) ? currentAnswer : []
            const correctArr = Array.isArray(currentQuestion.correct_answer) ? currentQuestion.correct_answer : []
            isCorrect = userArr.length === correctArr.length && userArr.every(val => correctArr.includes(val)) && userArr.length > 0
        } else {
            isCorrect = normalizedUser === normalizedCorrect && normalizedUser !== ""
        }
    }

    return (
        <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
            {/* Header / Progress */}
            <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex flex-col">
                        <span className="text-zinc-400 text-sm font-medium">Question {currentIndex + 1} of {total}</span>
                        <span className="uppercase text-[10px] tracking-wider mt-1 px-2 py-0.5 rounded bg-white/5 border border-white/10 w-fit text-zinc-500">
                            {currentQuestion.difficulty_label || "Standard"}
                        </span>
                    </div>
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
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-blue-500 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                        style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
                    />
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
                    {currentQuestion.type === 'single_mcq' && (
                        <div className="space-y-3">
                            {currentQuestion.options?.map((option: string, idx: number) => {
                                const isSelected = currentAnswer === option
                                const isKeyCorrect = option === currentQuestion.correct_answer
                                
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => handleSingleSelect(option)}
                                        disabled={isCurrentAnswerChecked}
                                        className={cn(
                                            "w-full text-left p-4 rounded-2xl border transition-all duration-200 group relative",
                                            isSelected 
                                                ? isCurrentAnswerChecked
                                                    ? isCorrect 
                                                        ? "bg-green-600/20 border-green-500 text-green-100 ring-1 ring-green-500"
                                                        : "bg-red-600/20 border-red-500 text-red-100 ring-1 ring-red-500"
                                                    : "bg-blue-600/20 border-blue-500 text-blue-100 ring-1 ring-blue-500" 
                                                : isCurrentAnswerChecked && isKeyCorrect
                                                    ? "bg-green-600/10 border-green-500/50 text-green-200/70"
                                                    : "bg-black/40 border-white/5 hover:border-white/20 hover:bg-white/5 text-zinc-400",
                                            isCurrentAnswerChecked && "cursor-default"
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                                                isSelected 
                                                    ? isCurrentAnswerChecked
                                                        ? isCorrect ? "border-green-500 bg-green-500" : "border-red-500 bg-red-500"
                                                        : "border-blue-500 bg-blue-500" 
                                                    : "border-zinc-700 group-hover:border-zinc-500"
                                            )}>
                                                {isSelected && <div className="w-2.5 h-2.5 bg-white rounded-full shadow-lg" />}
                                            </div>
                                            <span className="text-base">{option}</span>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {currentQuestion.type === 'multi_mcq' && (
                        <div className="space-y-3">
                            <p className="text-[10px] uppercase tracking-widest text-blue-400 mb-2 font-bold opacity-70">Multiple Selection</p>
                            {currentQuestion.options?.map((option: string, idx: number) => {
                                const selectedArr = Array.isArray(currentAnswer) ? currentAnswer : []
                                const isSelected = selectedArr.includes(option)
                                const isKeyCorrect = Array.isArray(currentQuestion.correct_answer) && currentQuestion.correct_answer.includes(option)
                                
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => handleMultiSelect(option)}
                                        disabled={isCurrentAnswerChecked}
                                        className={cn(
                                            "w-full text-left p-4 rounded-2xl border transition-all duration-200 group",
                                            isSelected 
                                                ? isCurrentAnswerChecked
                                                    ? isKeyCorrect 
                                                        ? "bg-green-600/20 border-green-500 text-green-100 ring-1 ring-green-500"
                                                        : "bg-red-600/20 border-red-500 text-red-100 ring-1 ring-red-500"
                                                    : "bg-indigo-600/20 border-indigo-500 text-indigo-100 ring-1 ring-indigo-500"
                                                : isCurrentAnswerChecked && isKeyCorrect
                                                    ? "bg-green-600/10 border-green-500/50 text-green-200/70"
                                                    : "bg-black/40 border-white/5 hover:border-white/20 hover:bg-white/5 text-zinc-400",
                                            isCurrentAnswerChecked && "cursor-default"
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors",
                                                isSelected 
                                                    ? isCurrentAnswerChecked
                                                        ? isKeyCorrect ? "border-green-500 bg-green-500" : "border-red-500 bg-red-500"
                                                        : "border-indigo-500 bg-indigo-500" 
                                                    : "border-zinc-700 group-hover:border-zinc-500"
                                            )}>
                                                {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                                            </div>
                                            <span className="text-base">{option}</span>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {currentQuestion.type === 'fill_in_blank' && (
                        <div className="space-y-4">
                            <p className="text-[10px] uppercase tracking-widest text-amber-500 mb-2 font-bold opacity-70">Input Required</p>
                            <Input 
                                autoFocus
                                disabled={isCurrentAnswerChecked}
                                value={currentAnswer || ''}
                                onChange={(e) => handleTextInput(e.target.value)}
                                placeholder="Type your answer here..."
                                className={cn(
                                    "h-16 bg-black/60 border-white/10 text-xl rounded-2xl px-8 shadow-inner transition-colors",
                                    isCurrentAnswerChecked 
                                        ? isCorrect ? "border-green-500/50 text-green-400" : "border-red-500/50 text-red-400"
                                        : "text-white focus-visible:ring-amber-500"
                                )}
                            />
                        </div>
                    )}
                </div>

                {/* Instant Feedback Explanation */}
                {isCurrentAnswerChecked && (
                    <div className="mt-8 pt-6 border-t border-white/5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-2 mb-3">
                            <BrainIcon className="w-5 h-5 text-blue-400" />
                            <h4 className="text-sm font-bold text-blue-400 uppercase tracking-wider">AI Explanation</h4>
                        </div>
                        <div className="bg-blue-600/5 border border-blue-500/20 rounded-2xl p-5 text-sm text-blue-100/80 leading-relaxed shadow-inner">
                            {!isCorrect && <p className="text-red-400/80 mb-2 font-medium italic">Correct Answer: {
                                Array.isArray(currentQuestion.correct_answer) 
                                ? currentQuestion.correct_answer.join(", ") 
                                : currentQuestion.correct_answer
                            }</p>}
                            {currentQuestion.explanation}
                        </div>
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
                    {/* Only show Submit if not yet checked */}
                    {!isCurrentAnswerChecked && (
                        <Button 
                            onClick={() => setIsCurrentAnswerChecked(true)}
                            disabled={!currentAnswer || (Array.isArray(currentAnswer) && currentAnswer.length === 0)}
                            className="h-12 bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-900/20 group px-10 rounded-xl font-bold transition-all hover:scale-105 active:scale-95"
                        >
                            Check Answer
                            <CheckCircle2 className="w-4 h-4 ml-2 transition-transform group-hover:scale-110" />
                        </Button>
                    )}

                    {!isLast ? (
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
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="h-12 bg-green-600 hover:bg-green-500 text-white shadow-xl shadow-green-900/20 group px-10 rounded-xl font-bold transition-all hover:scale-105 active:scale-95"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Finalizing...
                                </>
                            ) : (
                                <>
                                    Complete Quiz
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
