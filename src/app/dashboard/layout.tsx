import { AppSidebar } from "@/components/app-sidebar"
import { DashboardAssistant } from "@/components/dashboard-assistant"
import { DashboardHeader } from "@/components/dashboard-header"
import { getProfile } from "@/app/actions"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const profile = await getProfile()

    return (
        <div className="flex min-h-screen relative">
            <AppSidebar />

            <main className="flex-1 relative z-10 overflow-y-auto h-screen w-full flex flex-col no-scrollbar">
                <DashboardHeader profile={profile} />
                <div className="w-full px-4 sm:px-6 md:px-8 py-8 overflow-x-hidden text-left flex-1">
                    {children}
                </div>
            </main>

            <DashboardAssistant hasApiKey={profile?.hasKey} />
        </div>
    )
}
