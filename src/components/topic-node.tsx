'use client'

import { Handle, Position } from 'reactflow'
import { Lock, CheckCircle, PlayCircle, BookOpen, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export function TopicNode({ data }: { data: { label: string; status: 'LOCKED' | 'AVAILABLE' | 'GENERATED' | 'COMPLETED'; level: string } }) {

    const isLocked = data.status === 'LOCKED'
    const isCompleted = data.status === 'COMPLETED'
    const isAvailable = data.status === 'AVAILABLE' || data.status === 'GENERATED'

    return (
        <div className={cn(
            "relative px-5 py-4 rounded-2xl border transition-all duration-500 min-w-[220px] backdrop-blur-xl group",
            isLocked && "bg-zinc-900/40 border-zinc-800/50 text-zinc-600 grayscale",
            isAvailable && "bg-blue-600/10 border-blue-500/50 text-white shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:border-blue-400 hover:bg-blue-600/20",
            isCompleted && "bg-emerald-600/10 border-emerald-500/50 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.1)]",
            data.status === 'GENERATED' && "bg-amber-600/10 border-amber-500/50 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
        )}>
            {/* Connection Handles - Optimized for Snake Flow */}
            <Handle type="target" position={Position.Left} className="!opacity-0 !w-0 !h-0" />
            <Handle type="source" position={Position.Right} className="!opacity-0 !w-0 !h-0" />
            <Handle type="target" position={Position.Top} className="!opacity-0 !w-0 !h-0" />
            <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-0 !h-0" />

            <div className="flex items-center justify-between mb-3">
                <div className={cn(
                    "p-2 rounded-lg transition-colors border",
                    isLocked ? "bg-zinc-900 border-zinc-700 text-zinc-600" : 
                    isAvailable ? "bg-blue-500/20 border-blue-500/30 text-blue-400" :
                    isCompleted ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-amber-500/20 border-amber-500/30 text-amber-400"
                )}>
                    {isLocked ? <Lock className="h-4 w-4" /> : 
                     isCompleted ? <CheckCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/40 border border-white/5 shadow-inner">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">Lvl</span>
                    <span className="text-[10px] font-black text-zinc-400">{data.level || '5'}</span>
                </div>
            </div>

            <div className="flex flex-col gap-1">
                <h3 className={cn(
                    "font-bold text-sm leading-snug transition-colors",
                    isLocked ? "text-zinc-600" : "text-white group-hover:text-blue-200"
                )}>
                    {data.label}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                    <div className={cn(
                        "h-1 px-2 rounded-full overflow-hidden flex-1 bg-white/5",
                        isLocked && "opacity-20"
                    )}>
                        <div className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            isCompleted ? "w-full bg-emerald-500" : isAvailable ? "w-1/3 bg-blue-500" : "w-0"
                        )} />
                    </div>
                    <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{data.status}</span>
                </div>
            </div>

            {/* Glowing active indicator */}
            {isAvailable && (
                <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-blue-500/20 to-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity blur-[2px] pointer-events-none" />
            )}
        </div>
    )
}
