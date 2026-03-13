import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { QuizTakeFlow } from "@/components/quiz-take-flow"
import { AlertTriangle } from "lucide-react"
import Link from "next/link"

export default async function TakeQuizPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/login')
    }

    const { data: quiz, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', id)
        .single()

    if (error || !quiz) {
         return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 text-center">
                <AlertTriangle className="h-10 w-10 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Quiz Not Found</h1>
                <p className="text-zinc-400 mb-6">This quiz does not exist or you do not have permission to view it.</p>
                <Link href="/dashboard" className="px-6 py-2 bg-white text-black rounded-lg hover:bg-white/90">
                    Back to Dashboard
                </Link>
            </div>
        )
    }

    // Pass the quiz data to the client component that handles the interactive flow
    return <QuizTakeFlow quiz={quiz} />
}
