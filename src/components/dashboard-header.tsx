'use client'

import Link from 'next/link'
import { User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DashboardHeaderProps {
    profile: any
}

export function DashboardHeader({ profile }: DashboardHeaderProps) {
    const initials = profile?.full_name
        ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
        : 'U'

    return (
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-white/10 bg-black/50 backdrop-blur-xl px-6">
            <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold text-white">Dashboard</h1>
            </div>

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
        </header>
    )
}
