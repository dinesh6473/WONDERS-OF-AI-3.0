'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DashboardHeaderProps {
    profile: {
        full_name?: string | null
        avatar_url?: string | null
    } | null
}

export function DashboardHeader({ profile }: DashboardHeaderProps) {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const initials = profile?.full_name
        ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
        : 'U'
    const isQuizDashboard = pathname === '/dashboard/quiz'
    const isAttemptView = searchParams.get('view') === 'attempt'
    const attemptParams = new URLSearchParams(searchParams.toString())
    attemptParams.set('view', 'attempt')
    const attemptHref = `/dashboard/quiz?${attemptParams.toString()}`

    return (
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-white/10 bg-black/50 backdrop-blur-xl px-6">
            <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold text-white">Dashboard</h1>
            </div>

            <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end hidden sm:flex">
                        <p className="text-sm font-medium text-white">{profile?.full_name || 'User'}</p>
                        <p className="text-xs text-zinc-500">Student</p>
                    </div>
                    
                    <Link 
                        href="/dashboard/profile"
                        className="group relative flex h-10 w-10 items-center justify-center rounded-full bg-blue-600/10 border border-blue-600/20 transition-all hover:bg-blue-600/20"
                    >
                        {profile?.avatar_url ? (
                            <img 
                                src={profile.avatar_url} 
                                alt={profile.full_name} 
                                className="h-full w-full rounded-full object-cover"
                            />
                        ) : (
                            <span className="text-sm font-bold text-blue-400">{initials}</span>
                        )}
                        <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-black bg-green-500" />
                    </Link>
                </div>

                {isQuizDashboard && !isAttemptView && (
                    <Link
                        href={attemptHref}
                        className={cn(
                            "inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-300 transition-all hover:bg-blue-500/20 hover:text-white"
                        )}
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                        Attempt Quiz
                    </Link>
                )}
            </div>
        </header>
    )
}
