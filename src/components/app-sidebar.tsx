'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import {
    LayoutDashboard,
    Users,
    Settings,
    User,
    LogOut,
    Home,
    Menu,
    X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { logout } from '@/app/actions'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

const navigation = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Community', href: '/dashboard/community', icon: Users },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
    { name: 'Profile', href: '/dashboard/profile', icon: User },
]

export function AppSidebar() {
    const pathname = usePathname()
    const [isOpen, setIsOpen] = useState(false)
    const [isCollapsed, setIsCollapsed] = useState(true)
    const [showLogoutDialog, setShowLogoutDialog] = useState(false)

    return (
        <>
            {/* Mobile/Desktop Toggle Button */}
            <Button
                variant="ghost"
                size="icon"
                className={cn(
                    "fixed top-[calc(1rem+env(safe-area-inset-top))] left-4 z-50 text-white bg-zinc-900/50 backdrop-blur-md border border-white/10 transition-all duration-300",
                    "md:hidden", 
                    !isCollapsed && "md:left-[17rem]"
                )}
                onClick={() => setIsOpen(true)}
            >
                <Menu className="h-5 w-5" />
            </Button>

            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar Container */}
            <div className={cn(
                "flex flex-col h-screen z-50 transition-all duration-300 overflow-x-hidden",
                "bg-black/80 backdrop-blur-xl border-r border-white/10",
                // Mobile Styles
                "fixed top-0 left-0 w-64 shadow-2xl shadow-black",
                isOpen ? "translate-x-0" : "-translate-x-full",
                // Desktop Styles (Override Mobile)
                "md:sticky md:translate-x-0 md:top-0",
                isCollapsed ? "md:w-20" : "md:w-64 md:shadow-none"
            )}>

                {/* Mobile Close Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 md:hidden text-zinc-400 hover:text-white"
                    onClick={() => setIsOpen(false)}
                >
                    <X className="h-5 w-5" />
                </Button>

                {/* Desktop Toggle Button */}
                <div className={cn(
                    "hidden md:flex py-4 transition-all duration-300",
                    isCollapsed ? "justify-center px-0" : "justify-end px-4"
                )}>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-zinc-400 hover:text-white hover:bg-white/5 h-10 w-10"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                    >
                        <Menu className="h-5 w-5" />
                    </Button>
                </div>

                <div className={cn(
                    "mb-8 flex items-center w-full px-4 transition-all duration-300 mt-8 md:mt-0",
                    isCollapsed ? "justify-center" : "justify-start px-6"
                )}>
                    <img src="/logo.jpg" alt="LearnX Logo" className="h-10 w-10 min-w-[2.5rem] rounded-xl object-cover shadow-lg bg-white shrink-0" />
                    {/* Text: Visible on Mobile OR Desktop Expanded */}
                    <span className={cn(
                        "ml-4 font-bold text-xl text-white transition-all duration-300 whitespace-nowrap",
                        isCollapsed ? "md:opacity-0 md:w-0" : "md:opacity-100 md:w-auto",
                        "opacity-100" // Always visible on mobile drawer
                    )}>
                        LearnX
                    </span>
                </div>

                {/* Navigation Items */}
                <nav className="flex-1 w-full px-3 space-y-2 overflow-y-auto overflow-x-hidden no-scrollbar">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={() => setIsOpen(false)} // Close on navigate (mobile)
                            >
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "w-full flex items-center h-12 rounded-xl transition-all duration-200",
                                        isCollapsed ? "justify-center px-0" : "justify-start px-3",
                                        isActive
                                            ? "bg-blue-600/10 text-blue-400 hover:bg-blue-600/20"
                                            : "text-zinc-400 hover:text-white hover:bg-white/5",
                                        !isActive && !isCollapsed && "md:hover:pl-4"
                                    )}
                                >
                                    <item.icon className={cn("h-6 w-6 min-w-[1.5rem] shrink-0", isActive ? "text-blue-400" : "text-zinc-400")} />

                                    <span className={cn(
                                        "ml-4 font-medium transition-all duration-300 whitespace-nowrap",
                                        isCollapsed ? "md:opacity-0 md:w-0" : "md:opacity-100 md:w-auto",
                                        "opacity-100", // Mobile always visible
                                        isActive ? "text-white" : "text-zinc-400"
                                    )}>
                                        {item.name}
                                    </span>
                                </Button>
                            </Link>
                        )
                    })}
                </nav>

                {/* Footer Actions */}
                <div className="w-full px-3 mt-auto mb-8 space-y-2">
                    <Button
                        variant="ghost"
                        onClick={() => setShowLogoutDialog(true)}
                        className={cn(
                            "w-full flex items-center h-12 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-950/20",
                            isCollapsed ? "justify-center px-0" : "justify-start px-3"
                        )}
                    >
                        <LogOut className="h-6 w-6 min-w-[1.5rem] shrink-0" />
                        <span className={cn(
                            "ml-4 font-medium transition-all duration-300 whitespace-nowrap",
                            isCollapsed ? "md:opacity-0 md:w-0" : "md:opacity-100 md:w-auto",
                            "opacity-100"
                        )}>
                            Sign Out
                        </span>
                    </Button>
                </div>
            </div>

            {/* Logout Confirmation Dialog */}
            <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
                <DialogContent className="sm:max-w-[425px] bg-card border-border">
                    <DialogHeader>
                        <DialogTitle>Sign out</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to sign out of your account?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setShowLogoutDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={async () => {
                                await logout()
                                setShowLogoutDialog(false)
                            }}
                        >
                            Log Out
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
