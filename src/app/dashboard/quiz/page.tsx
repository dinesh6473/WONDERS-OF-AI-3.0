import { getSubject, getSubjectTopics } from "@/app/actions"
import { QuizConfigForm } from "@/components/quiz-config-form"
import { AlertTriangle, BookOpen } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"

export default async function QuizSetupPage(props: { searchParams: Promise<{ subject_id?: string }> }) {
    const searchParams = await props.searchParams
    const subjectId = searchParams.subject_id
    
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/login')
    }

    let subject = null
    let topics = []

    if (subjectId) {
        const { data, error } = await getSubject(subjectId)
        if (error || !data) {
            return (
                <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 text-center">
                    <AlertTriangle className="h-10 w-10 text-red-500 mb-4" />
                    <h1 className="text-2xl font-bold mb-2">Subject Not Found</h1>
                    <p className="text-zinc-400 mb-6">The subject you are trying to create a quiz for does not exist.</p>
                    <Link href="/dashboard" className="px-6 py-2 bg-white text-black rounded-lg hover:bg-white/90">
                        Back to Dashboard
                    </Link>
                </div>
            )
        }
        subject = data
        
        // Fetch topics and only allow unlocked ones
        const graphData = await getSubjectTopics(subjectId)
        topics = graphData.nodes
            .filter((n: any) => n.data.status === 'AVAILABLE' || n.data.status === 'COMPLETED' || n.data.status === 'GENERATED')
            .map((n: any) => ({ id: n.id, title: n.data.label }))
    }

    return (
        <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
            <div className="mb-8">
                <div className="flex items-center gap-3 text-blue-400 mb-2">
                    <BookOpen className="h-6 w-6" />
                    <h1 className="text-3xl font-bold text-white">Quiz Studio</h1>
                </div>
                <p className="text-zinc-400">
                    {subject 
                        ? `Configure a personalized quiz for ${subject.title}.` 
                        : "Create a custom quiz on any topic globally."}
                </p>
            </div>

            <QuizConfigForm initialSubject={subject} initialTopics={topics} />
        </div>
    )
}
