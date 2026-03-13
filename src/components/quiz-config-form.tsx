'use client'

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Sparkles } from "lucide-react"
import { generateQuiz } from "@/app/actions"

interface Topic {
    id: string
    title: string
}

interface Subject {
    id: string
    title: string
}

interface QuizConfigFormProps {
    initialSubject: Subject | null
    initialTopics: Topic[]
}

export function QuizConfigForm({ initialSubject, initialTopics }: QuizConfigFormProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    
    // Form state
    const [subjectName, setSubjectName] = useState(initialSubject?.title || "")
    const [globalTopics, setGlobalTopics] = useState("")
    const [selectedCourseTopics, setSelectedCourseTopics] = useState<string[]>([])
    const [difficulty, setDifficulty] = useState("3")
    const [questionCount, setQuestionCount] = useState("10")
    
    const isGlobal = !initialSubject

    function handleTopicToggle(topicTitle: string) {
        if (selectedCourseTopics.includes(topicTitle)) {
            setSelectedCourseTopics(prev => prev.filter(t => t !== topicTitle))
        } else {
            setSelectedCourseTopics(prev => [...prev, topicTitle])
        }
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setErrorMsg(null)

        startTransition(async () => {
            try {
                // Prepare topics
                let finalTopics = ""
                if (isGlobal) {
                    finalTopics = globalTopics
                } else {
                    finalTopics = selectedCourseTopics.length > 0 
                        ? selectedCourseTopics.join(", ") 
                        : "General Knowledge on " + subjectName
                }
                
                // Call server action
                const quizId = await generateQuiz({
                    subjectId: initialSubject?.id,
                    subjectName,
                    topics: finalTopics,
                    difficulty: parseInt(difficulty),
                    count: parseInt(questionCount)
                })

                if (quizId) {
                    router.push(`/dashboard/quiz/${quizId}/take`)
                }
            } catch (err: any) {
                console.error("Quiz generation failed:", err)
                setErrorMsg(err.message || "Failed to generate quiz. Check API Key or try again.")
            }
        })
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 bg-zinc-900/50 p-6 sm:p-8 rounded-2xl border border-white/5">
            {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg text-center">
                    {errorMsg}
                </div>
            )}

            <div className="space-y-4">
                <div className="grid gap-2">
                    <Label htmlFor="subject">Subject Name</Label>
                    <Input 
                        id="subject" 
                        disabled={!isGlobal}
                        required
                        value={subjectName}
                        onChange={(e) => setSubjectName(e.target.value)}
                        placeholder="e.g., Computer Science, Biology, Roman History"
                        className="bg-black/50 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-blue-500"
                    />
                </div>

                {isGlobal ? (
                    <div className="grid gap-2">
                        <Label htmlFor="topics">Specific Topics (Optional)</Label>
                        <Textarea 
                            id="topics"
                            value={globalTopics}
                            onChange={(e) => setGlobalTopics(e.target.value)}
                            placeholder="e.g., Data Structures, Quantum Mechanics, Machine Learning..."
                            className="bg-black/50 border-white/10 text-white placeholder:text-zinc-600 min-h-[100px] focus-visible:ring-blue-500"
                        />
                        <p className="text-xs text-zinc-500">List whatever concepts you want to test your memory on.</p>
                    </div>
                ) : (
                    <div className="grid gap-2">
                        <Label>Unlocked Topics</Label>
                        {initialTopics.length === 0 ? (
                            <div className="p-4 rounded-lg border border-dashed border-white/10 text-center text-sm text-zinc-500 bg-black/20">
                                You haven't unlocked any specific topics yet. We'll generate a general quiz for {initialSubject.title}.
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2 p-4 rounded-lg bg-black/20 border border-white/5 max-h-[200px] overflow-y-auto no-scrollbar">
                                {initialTopics.map((topic) => {
                                    const isSelected = selectedCourseTopics.includes(topic.title)
                                    return (
                                        <button
                                            key={topic.id}
                                            type="button"
                                            onClick={() => handleTopicToggle(topic.title)}
                                            className={`px-3 py-1.5 text-sm rounded-full transition-all border ${
                                                isSelected 
                                                ? "bg-blue-600/20 border-blue-500/50 text-blue-200 shadow-[0_0_10px_-2px_rgba(59,130,246,0.3)]" 
                                                : "bg-white/5 border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/10"
                                            }`}
                                        >
                                            {topic.title}
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                        <p className="text-xs text-zinc-500 mt-1">Select specific areas to focus on. Leave blank for a general test.</p>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                    <div className="grid gap-2">
                        <Label htmlFor="difficulty">Difficulty Level (1-5)</Label>
                        <div className="flex items-center gap-4">
                            <input 
                                type="range" 
                                min="1" 
                                max="5" 
                                step="1" 
                                id="difficulty"
                                value={difficulty} 
                                onChange={(e) => setDifficulty(e.target.value)}
                                className="w-full accent-blue-500"
                            />
                            <span className="flex items-center justify-center w-8 h-8 rounded-md bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">
                                {difficulty}
                            </span>
                        </div>
                        <div className="flex justify-between text-xs text-zinc-500 px-1">
                            <span>Easy</span>
                            <span>Hard</span>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="count">Number of Questions</Label>
                        <Input 
                            id="count"
                            type="number"
                            min="1"
                            required
                            value={questionCount}
                            onChange={(e) => setQuestionCount(e.target.value)}
                            className="bg-black/50 border-white/10 text-white focus-visible:ring-blue-500"
                        />
                        <p className="text-xs text-zinc-500">
                            Enter any positive number. We will keep generating until that exact count is reached with no duplicates.
                        </p>
                    </div>
                </div>
            </div>

            <Button 
                type="submit" 
                disabled={isPending || !subjectName}
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-900/20 transition-all hover:shadow-blue-900/40 hover:-translate-y-0.5"
            >
                {isPending ? (
                    <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Generating Unique Questions...
                    </>
                ) : (
                    <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Generate AI Quiz
                    </>
                )}
            </Button>
        </form>
    )
}
