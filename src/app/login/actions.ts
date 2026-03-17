'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

function normalizeEmail(value: FormDataEntryValue | null) {
    return String(value || '').trim().toLowerCase()
}

function normalizePassword(value: FormDataEntryValue | null) {
    return String(value || '')
}

function getSafeNextPath(value: FormDataEntryValue | string | null | undefined, fallback = '/dashboard') {
    const nextPath = String(value || '').trim()

    if (!nextPath.startsWith('/') || nextPath.startsWith('//')) {
        return fallback
    }

    return nextPath
}

function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isStrongPassword(password: string) {
    return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)
}

async function getBaseUrl() {
    const headersList = await headers()
    const forwardedHost = headersList.get('x-forwarded-host')
    const forwardedProto = headersList.get('x-forwarded-proto')
    let host = forwardedHost || headersList.get('host') || 'localhost:3000'

    if (host.includes('0.0.0.0')) {
        host = 'localhost:3000'
    }

    const protocol = forwardedProto || (process.env.NODE_ENV === 'production' ? 'https' : 'http')
    return `${protocol}://${host}`
}

async function signInWithOAuthProvider(provider: 'github' | 'google', nextPathOrFormData?: string | FormData) {
    const supabase = await createClient()
    const baseUrl = await getBaseUrl()
    const nextPath = typeof nextPathOrFormData === 'string'
        ? nextPathOrFormData
        : nextPathOrFormData?.get('next')?.toString()
    const redirectUrl = `${baseUrl}/auth/callback?next=${encodeURIComponent(getSafeNextPath(nextPath))}`

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: redirectUrl,
            ...(provider === 'google'
                ? {
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                }
                : {}),
        },
    })

    if (error) {
        const providerName = provider === 'github' ? 'GitHub' : 'Google'
        return redirect(`/login?error=Could not authenticate with ${providerName}`)
    }

    if (data.url) {
        return redirect(data.url)
    }

    return redirect('/login?error=Authentication could not be started')
}

export async function login(formData: FormData) {
    const supabase = await createClient()
    const email = normalizeEmail(formData.get('email'))
    const password = normalizePassword(formData.get('password'))
    const nextPath = getSafeNextPath(formData.get('next'))

    if (!isValidEmail(email) || password.length === 0) {
        return redirect(`/login?error=${encodeURIComponent('Enter a valid email and password')}&next=${encodeURIComponent(nextPath)}`)
    }

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return redirect(`/login?error=${encodeURIComponent('Could not authenticate user')}&next=${encodeURIComponent(nextPath)}`)
    }

    revalidatePath('/', 'layout')
    return redirect(nextPath)
}

export async function signup(formData: FormData) {
    const supabase = await createClient()
    const email = normalizeEmail(formData.get('email'))
    const password = normalizePassword(formData.get('password'))
    const baseUrl = await getBaseUrl()

    if (!isValidEmail(email)) {
        return redirect(`/signup?error=${encodeURIComponent('Enter a valid email address')}`)
    }

    if (!isStrongPassword(password)) {
        return redirect(`/signup?error=${encodeURIComponent('Use at least 8 characters with letters and numbers')}`)
    }

    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: `${baseUrl}/auth/callback?next=/dashboard`,
        },
    })

    if (error) {
        return redirect(`/signup?error=${encodeURIComponent('Could not create user')}`)
    }

    revalidatePath('/', 'layout')
    return redirect(`/login?message=${encodeURIComponent('Check your email to confirm your account')}`)
}

export async function signInWithGithub(nextPathOrFormData?: string | FormData) {
    return signInWithOAuthProvider('github', nextPathOrFormData)
}

export async function signInWithGoogle(nextPathOrFormData?: string | FormData) {
    return signInWithOAuthProvider('google', nextPathOrFormData)
}
