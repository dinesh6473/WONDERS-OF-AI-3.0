import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function getSafeNextPath(value: string | null, fallback = "/dashboard") {
    if (!value || !value.startsWith("/") || value.startsWith("//")) {
        return fallback;
    }

    return value;
}

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));

    if (!code) {
        return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error?error=missing_code`);
    }

    const cookieStore = await cookies();
    let responseCookies: { name: string; value: string; options: CookieOptions }[] = [];

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    responseCookies = cookiesToSet;

                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // Route handlers can expose a read-only cookie store during some flows.
                    }
                },
            },
        }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
        return NextResponse.redirect(
            `${requestUrl.origin}/auth/auth-code-error?error=${encodeURIComponent(error.message)}`
        );
    }

    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    const baseUrl = forwardedHost
        ? `${forwardedProto}://${forwardedHost}`
        : requestUrl.origin.replace("http://", "https://");

    const response = NextResponse.redirect(`${baseUrl}${nextPath}`);

    responseCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
    });

    return response;
}
