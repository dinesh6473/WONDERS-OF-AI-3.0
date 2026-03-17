import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Define public routes that don't require authentication
    const isPublicRoute =
        request.nextUrl.pathname === '/' ||
        request.nextUrl.pathname.startsWith('/login') ||
        request.nextUrl.pathname.startsWith('/signup') ||
        request.nextUrl.pathname.startsWith('/auth') ||
        request.nextUrl.pathname.startsWith('/android')

    // For public routes, just return immediately
    if (isPublicRoute) {
        return supabaseResponse
    }

    // For protected routes: validate the authenticated user instead of trusting the cookie payload alone.
    try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`
            url.searchParams.set('next', nextPath)
            return NextResponse.redirect(url)
        }
    } catch (error) {
        // If there's an error checking session, redirect to login
        console.error('[Middleware] Session check error:', error)
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`
        url.searchParams.set('next', nextPath)
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}
