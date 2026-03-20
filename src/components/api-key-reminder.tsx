"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { KeyRound } from "lucide-react"

export function ApiKeyReminder() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Check if the reminder has already been surfaced during this login session
    const hasShown = sessionStorage.getItem("apiKeyReminderShown")
    if (!hasShown) {
      // Add a slight delay so it doesn't instantly jump scare the user upon successful login routing
      const timer = setTimeout(() => {
        setIsOpen(true)
        sessionStorage.setItem("apiKeyReminderShown", "true")
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [])

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="border-white/10 bg-zinc-950 sm:max-w-md">
        <DialogHeader className="flex flex-col items-center gap-2 pt-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 ring-8 ring-amber-500/5">
            <KeyRound className="h-8 w-8 text-amber-500" />
          </div>
          <DialogTitle className="text-xl font-bold text-white">
            API Key Checkup
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-zinc-400">
            Welcome back! For uninterrupted generation and security, please ensure your{" "}
            <strong className="text-zinc-200">Google Gemini API Key</strong> is still
            active. If your quota is exhausted or if you haven&apos;t replaced the key in many days, we heavily recommend updating it in your Account Settings.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 sm:justify-center">
          <Button
            onClick={() => setIsOpen(false)}
            className="w-full bg-white text-black hover:bg-zinc-200 sm:w-auto sm:px-8"
          >
            I Understand
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
