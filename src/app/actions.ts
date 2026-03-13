'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Polyfill for DOMMatrix required by pdf-parse in Node.js/Next.js edge environments
if (typeof global !== 'undefined' && !(global as any).DOMMatrix) {
    (global as any).DOMMatrix = class DOMMatrix { };
}
const pdf = require('pdf-parse');

// === AUTH & SETTINGS ===

export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
}

export async function getProfile() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, gemini_api_key, occupation, education_level, learning_style, learning_schedule')
        .eq('id', user.id)
        .single()

    // Attempt to seed profile if missing (resilience)
    if (!profile) return { full_name: user.user_metadata?.full_name || user.email, hasKey: false }

    return {
        full_name: profile.full_name || user.user_metadata?.full_name || user.email,
        hasKey: !!profile.gemini_api_key,
        occupation: profile.occupation,
        education_level: profile.education_level,
        learning_style: profile.learning_style,
        learning_schedule: profile.learning_schedule
    }
}

export async function updateProfile(data: {
    full_name?: string;
    gemini_api_key?: string;
    occupation?: string;
    education_level?: string;
    learning_style?: string;
    learning_schedule?: string;
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const updates: any = { updated_at: new Date().toISOString() }
    if (data.full_name !== undefined) updates.full_name = data.full_name
    if (data.gemini_api_key !== undefined) updates.gemini_api_key = data.gemini_api_key
    if (data.occupation !== undefined) updates.occupation = data.occupation
    if (data.education_level !== undefined) updates.education_level = data.education_level
    if (data.learning_style !== undefined) updates.learning_style = data.learning_style
    if (data.learning_schedule !== undefined) updates.learning_schedule = data.learning_schedule

    const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, ...updates })

    if (error) throw error
    revalidatePath('/dashboard')
}

export async function deleteGeminiKey() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    await supabase.from('profiles').update({ gemini_api_key: null }).eq('id', user.id)

    // Also clear cookie for good measure if it exists
    const cookieStore = await cookies()
    cookieStore.delete('gemini_api_key')

    revalidatePath('/dashboard')
}

async function getApiKeyInternal() {
    // 1. Try DB ONLY - Security: Do not allow loose cookies or env vars to bypass user settings
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
        const { data } = await supabase.from('profiles').select('gemini_api_key').eq('id', user.id).single()
        if (data?.gemini_api_key) return data.gemini_api_key
    }

    return null
}

async function getApiKeyForUserId(userId: string) {
    const supabase = await createClient()
    const { data } = await supabase
        .from('profiles')
        .select('gemini_api_key')
        .eq('id', userId)
        .single()

    return data?.gemini_api_key || null
}

type GeneratedQuizQuestion = {
    type: 'single_mcq' | 'multi_mcq' | 'fill_in_blank'
    question: string
    options: string[]
    correct_answer: string | string[]
    explanation: string
    difficulty_label: 'Easy' | 'Medium' | 'Hard'
}

function normalizeQuestionKey(question: string) {
    return question
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '')
        .trim()
}

function parseGeneratedQuizResponse(text: string): { questions: GeneratedQuizQuestion[] } {
    let normalizedText = text

    const firstBrace = normalizedText.indexOf('{')
    const lastBrace = normalizedText.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        normalizedText = normalizedText.substring(firstBrace, lastBrace + 1)
    }

    const jsonStr = normalizedText.replace(/```json\n|\n```/g, "").replace(/```/g, "").trim()

    try {
        return JSON.parse(jsonStr)
    } catch {
        if (normalizedText.trim().startsWith('[')) {
            const firstBracket = normalizedText.indexOf('[')
            const lastBracket = normalizedText.lastIndexOf(']')
            const arrayStr = normalizedText.substring(firstBracket, lastBracket + 1)
            const directArray = JSON.parse(arrayStr)
            if (Array.isArray(directArray)) {
                return { questions: directArray as GeneratedQuizQuestion[] }
            }
        }
        throw new Error("AI returned invalid JSON formatting. Please try again.")
    }
}

async function generateUniqueQuizQuestions(params: {
    model: any
    subjectName: string
    topics: string
    difficulty: number
    count: number
    blockedQuestions: string[]
    seenDifficultyLabels?: string[]
}) {
    const finalQuestions: GeneratedQuizQuestion[] = []
    const generatedKeys = new Set<string>()
    const blockedQuestionKeys = new Set(params.blockedQuestions.map(normalizeQuestionKey))
    const batchSize = Math.min(16, Math.max(6, Math.ceil(params.count / 4)))
    const concurrency = params.count >= 40 ? 3 : 2
    const maxRounds = Math.max(4, Math.ceil(params.count / batchSize) * 3)

    const createPrompt = (
        requestCount: number,
        blockedCurrent: string[],
        blockedPrevious: string[],
        strict: boolean
    ) => `
Generate exactly ${requestCount} UNIQUE quiz questions as raw JSON.

Subject: ${params.subjectName}
Topics: ${params.topics || "General coverage"}
Difficulty: ${params.difficulty}/5
Seen difficulty labels so far: ${JSON.stringify(params.seenDifficultyLabels || [])}

${strict ? `Never repeat or closely paraphrase questions from these blocked sets:
Existing bank: ${JSON.stringify(blockedPrevious)}
Current batch: ${JSON.stringify(blockedCurrent)}` : `Avoid obvious duplicates and keep every question meaningfully different from the others in this response.`}

Use a balanced mix of:
- single_mcq: exactly 4 options, one correct answer
- multi_mcq: 4 or 5 options, multiple correct answers
- fill_in_blank: use "_____", options must be []

Return only:
{"questions":[{"type":"single_mcq|multi_mcq|fill_in_blank","question":"...","options":["..."],"correct_answer":"..." ,"explanation":"Brief but clear explanation.","difficulty_label":"Easy|Medium|Hard"}]}

Rules:
- no markdown
- no extra text
- factually correct
- match requested difficulty
- keep explanations concise
- every question must be meaningfully different
    `

    for (let round = 0; round < maxRounds && finalQuestions.length < params.count; round++) {
        const remaining = params.count - finalQuestions.length
        const strictMode = round < Math.max(2, Math.ceil(maxRounds / 2))
        const previousBlocked = strictMode ? params.blockedQuestions.slice(-24) : []
        const currentBlocked = strictMode ? finalQuestions.slice(-16).map(q => q.question) : []
        const jobs: Promise<{ questions: GeneratedQuizQuestion[] } | null>[] = []
        let remainingForRound = remaining

        for (let slot = 0; slot < concurrency && remainingForRound > 0; slot++) {
            const requestCount = Math.min(batchSize, remainingForRound)
            remainingForRound -= requestCount
            const prompt = createPrompt(requestCount, currentBlocked, previousBlocked, strictMode)

            jobs.push(
                params.model.generateContent(prompt)
                    .then((result: any) => result.response)
                    .then((response: any) => parseGeneratedQuizResponse(response.text()))
                    .catch((error: unknown) => {
                        console.warn("Quiz generation batch failed", error)
                        return null
                    })
            )
        }

        const batchResults = await Promise.all(jobs)

        for (const batchResult of batchResults) {
            if (!batchResult?.questions || !Array.isArray(batchResult.questions)) continue

            for (const rawQuestion of batchResult.questions) {
                if (!rawQuestion || typeof rawQuestion.question !== 'string') continue
                const key = normalizeQuestionKey(rawQuestion.question)
                if (!key || blockedQuestionKeys.has(key) || generatedKeys.has(key)) continue

                generatedKeys.add(key)
                finalQuestions.push(rawQuestion)

                if (finalQuestions.length === params.count) {
                    break
                }
            }

            if (finalQuestions.length === params.count) break
        }
    }

    if (finalQuestions.length === 0) {
        const fallbackPrompt = `
Generate exactly ${params.count} quiz questions as raw JSON.

Subject: ${params.subjectName}
Topics: ${params.topics || "General coverage"}
Difficulty: ${params.difficulty}/5
Seen difficulty labels so far: ${JSON.stringify(params.seenDifficultyLabels || [])}

Return only:
{"questions":[{"type":"single_mcq|multi_mcq|fill_in_blank","question":"...","options":["..."],"correct_answer":"..." ,"explanation":"Brief but clear explanation.","difficulty_label":"Easy|Medium|Hard"}]}

Rules:
- no markdown
- no extra text
- factually correct
- every question must be clearly distinct from the others
- keep explanations concise
        `

        const fallbackResult = await params.model.generateContent(fallbackPrompt)
        const fallbackResponse = await fallbackResult.response
        const fallbackQuizData = parseGeneratedQuizResponse(fallbackResponse.text())

        for (const rawQuestion of fallbackQuizData.questions || []) {
            if (!rawQuestion || typeof rawQuestion.question !== 'string') continue
            const key = normalizeQuestionKey(rawQuestion.question)
            if (!key || blockedQuestionKeys.has(key) || generatedKeys.has(key)) continue
            generatedKeys.add(key)
            finalQuestions.push(rawQuestion)
            if (finalQuestions.length === params.count) break
        }
    }

    return finalQuestions
}

async function extractTextFromFile(file: File): Promise<string> {
    const buffer = Buffer.from(await file.arrayBuffer())
    const type = file.type
    const name = file.name.toLowerCase()

    try {
        if (type === 'application/pdf' || name.endsWith('.pdf')) {
            let extractedText = ""
            try {
                const data = await pdf(buffer)
                extractedText = data.text?.trim() || ""
            } catch (pdfErr) {
                console.warn("pdf-parse failed, falling back to OCR", pdfErr)
            }
            
            // Fallback to Gemini OCR if text is basically empty (e.g. scanned images)
            if (extractedText.length < 50) {
                console.log("PDF seems empty or scanned. Using Gemini Vision for OCR...")
                const apiKey = await getApiKeyInternal()
                if (apiKey) {
                    const genAI = new GoogleGenerativeAI(apiKey)
                    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
                    const prompt = "Extract all legible text from this document. Return ONLY the text, preserving the structure where possible."
                    const pdfPart = {
                        inlineData: {
                            data: buffer.toString('base64'),
                            mimeType: 'application/pdf'
                        }
                    }
                    try {
                        const result = await model.generateContent([prompt, pdfPart])
                        extractedText = (await result.response).text()
                    } catch (geminiErr) {
                        console.error("Gemini OCR failed:", geminiErr)
                    }
                } else {
                     console.warn("Skipping PDF OCR: No API Key found.")
                }
            }
            return extractedText
        }
        else if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx')) {
            const mammoth = await import('mammoth');
            const result = await mammoth.extractRawText({ buffer })
            return result.value
        }
        else if (type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) {
            return buffer.toString('utf-8')
        }
        else if (type.startsWith('image/')) {
            // Image extraction using Gemini Vision
            const apiKey = await getApiKeyInternal()
            if (!apiKey) {
                console.warn("Skipping image extraction: No API Key found.")
                return ""
            }

            const genAI = new GoogleGenerativeAI(apiKey)
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

            const prompt = "Extract all legible text from this image. Return ONLY the text, preserving the structure where possible."
            const imagePart = {
                inlineData: {
                    data: buffer.toString('base64'),
                    mimeType: type
                }
            }

            const result = await model.generateContent([prompt, imagePart])
            const response = await result.response
            return response.text()
        }
        return ""
    } catch (e) {
        console.error("File parsing error:", e)
        return ""
    }
}

// === SUBJECTS ===

export async function getSubjects() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return []

    const { data, error } = await supabase
        .from('subjects')
        .select(`
            *,
            topics (status)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching subjects:', error)
        return []
    }

    // Calculate progress
    return data.map((subject: any) => {
        const total = subject.topics.length
        const completed = subject.topics.filter((t: any) => t.status === 'COMPLETED').length
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0
        return { ...subject, progress }
    })
}

export async function createSubject(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const file = formData.get('file') as File | null

    let sourceText = ""

    if (file && file.size > 0) {
        console.log(`Processing file: ${file.name}, Size: ${file.size}, Type: ${file.type}`);
        try {
            sourceText = await extractTextFromFile(file)
            if (!sourceText || sourceText.trim().length === 0) {
                console.warn(`Text extraction returned empty string for file: ${file.name}`);
                throw new Error("Could not extract text from this file. It might be empty or scanned images without OCR.");
            }
            console.log(`Extracted text length: ${sourceText.length}`);
        } catch (error: any) {
            console.error("Text extraction failed:", error)
            throw new Error(`File processing failed: ${error.message}`);
        }
    }

    // Auto-generate title if missing but text exists
    let finalTitle = title
    let finalDesc = description

    if (!finalTitle && sourceText) {
        // AI Auto-Title Generation
        try {
            const apiKey = await getApiKeyInternal()
            if (apiKey) {
                const genAI = new GoogleGenerativeAI(apiKey)
                const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
                const titlePrompt = `Analyze this text and provide specific Subject Name (max 5 words). Text sample: ${sourceText.slice(0, 1000)}... Return ONLY the subject name.`
                const result = await model.generateContent(titlePrompt)
                const response = await result.response
                finalTitle = response.text().trim()
            }
        } catch (e) {
            console.error("Auto-title failed:", e)
        }

        // Fallback if AI fails or no key
        if (!finalTitle) {
            finalTitle = (file as File).name.split('.')[0]
        }
    }

    if (!finalTitle) throw new Error('Title is required')

    const { data, error } = await supabase
        .from('subjects')
        .insert({
            user_id: user.id,
            title: finalTitle,
            description: finalDesc,
            source_text: sourceText,
            is_public: true, // Auto-public by default to encourage community sharing
        })
        .select()

    if (error) {
        console.error('Error creating subject:', error)
        throw new Error(`Failed to create subject: ${error.message}`)
    }

    if (!data || data.length === 0) {
        throw new Error('Subject created but no data returned.')
    }

    revalidatePath('/dashboard')
    return data[0].id
}

export async function deleteSubject(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting subject:', error)
        throw new Error('Failed to delete subject')
    }

    revalidatePath('/dashboard')
}

export async function getSubject(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: "Authentication required. Please log in." }
    }

    // DEBUG: First try to find the subject IGNORING user_id to see if it exists at all
    const { data: globalSubject, error: globalError } = await supabase
        .from('subjects')
        .select('id, user_id, title, is_public')
        .eq('id', id)
        .single()

    if (globalError || !globalSubject) {
        return { error: `Subject ID ${id} does not exist in the database.` }
    }

    // Check ownership or public access
    if (globalSubject.user_id !== user.id && !globalSubject.is_public) {
        return { error: `Access Denied. Subject Owner: ${globalSubject.user_id}, Current User: ${user.id}` }
    }

    // If we get here, it exists and we own it. Fetch full data.
    return { data: globalSubject, error: null }
}

export async function toggleSubjectVisibility(id: string, isPublic: boolean) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
        .from('subjects')
        .update({ is_public: isPublic })
        .eq('id', id)
        .eq('user_id', user.id) // Ensure ownership

    if (error) throw new Error('Failed to update visibility')

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/community')
    revalidatePath(`/dashboard/subject/${id}`)
}

export async function getSubjectTopics(subjectId: string) {
    const supabase = await createClient()

    // Fetch Topics
    const { data: topics, error: topicsError } = await supabase
        .from('topics')
        .select('*')
        .eq('subject_id', subjectId)

    if (topicsError || !topics) {
        console.error('Error fetching topics:', topicsError)
        return { nodes: [], edges: [] }
    }

    // Construct Nodes
    const nodes = topics.map(t => ({
        id: t.id,
        type: 'topicNode',
        position: { x: t.x || 0, y: t.y || 0 },
        data: {
            label: t.title,
            status: t.status,
            level: t.level
        }
    }))

    // Fetch Dependencies
    const { data: edgesData } = await supabase
        .from('topic_dependencies')
        .select('*')
        .in('parent_topic_id', topics.map(t => t.id))

    const edges = edgesData ? edgesData.map(e => ({
        id: `${e.parent_topic_id}-${e.child_topic_id}`,
        source: e.parent_topic_id,
        target: e.child_topic_id,
        animated: true,
        style: { stroke: '#2563eb' }
    })) : []

    return { nodes, edges }
}

export async function updateNodePosition(topicId: string, x: number, y: number) {
    const supabase = await createClient()

    await supabase
        .from('topics')
        .update({ x, y })
        .eq('id', topicId)
}

// === AI FEATURES ===

export async function generateTopics(subjectId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // 1. Get Subject Details
    const { data: subject } = await supabase.from('subjects').select('title, description, source_text').eq('id', subjectId).single()
    if (!subject) throw new Error('Subject not found')

    // 2. Get API Key
    const apiKey = await getApiKeyInternal()
    if (!apiKey) throw new Error('API Key missing. Please set it in Settings.')

    // 2.5 Check Existing Topics to prevent duplicates
    const { data: existingTopics } = await supabase.from('topics').select('title').eq('subject_id', subjectId)
    const existingTitles = existingTopics?.map(t => t.title) || []
    const existingContext = existingTitles.length > 0
        ? `\n\nEXCLUDE_LIST: The following topics already exist. DO NOT generate them again. Focus on missing concepts or deeper layers:\n${existingTitles.join(', ')}`
        : ""

    // 3. Call Gemini
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    const prompt = `
        Act as a **University Professor and Expert Curriculum Designer**.
        Create a **comprehensive, advanced-level knowledge graph** for the subject: "${subject.title}".
        Context: ${subject.description || "In-depth academic exploration."}
        ${subject.source_text ? `\nSOURCE MATERIAL:\n${subject.source_text.slice(0, 50000)}... [Truncated for prompt]\n\nINSTRUCTION: USE THE SOURCE MATERIAL AS GROUND TRUTH. Structure the topics to mirror the flow and depth of this document.` : ""}
        ${existingContext}
        
        Your goal is to structure a rigorous learning path that matches a top-tier university syllabus.
        
        Return a JSON object with a list of "topics" and their "dependencies".
        
        Requirements:
        1. "topics": Array of objects { "id": "t1", "title": "Topic Name", "description": "Academic summary", "level": "Beginner|Intermediate|Advanced|Expert", "x": 0, "y": 0 }
           - **CRITICAL: DYNAMIC COUNT**: 
             - If source material is **SHORT** (e.g. single image, < 500 words), generate **ONLY 5-10 topics**. Do NOT hallucinate extra topics.
             - If source material is **MEDIUM** (e.g. chapter, 500-2000 words), generate **15-25 topics**.
             - If source material is **LARGE** (e.g. full book, > 2000 words), generate **30-50 topics**.
           - Ensure granular breakdown of complex concepts.
           - "x" and "y": Assign logical coordinates for a directed acyclic graph (DAG) layout. Flow from top (y=0) to bottom. Spread x for branches.
           - "id": Use simple strings like "t1", "t2".
        
        2. "dependencies": Array of objects { "from": "t1", "to": "t2" }
           - "from" is the prerequisite for "to".
           - Ensure a logical academic progression.
           - No circular dependencies.
        
        RETURN JSON ONLY. NO MARKDOWN.
    `

    try {
        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()
        const jsonStr = text.replace(/```json\n|\n```/g, "").replace(/```/g, "").trim()
        const data = JSON.parse(jsonStr)

        if (!data.topics || !Array.isArray(data.topics)) throw new Error('Invalid AI response')

        // 4. Insert into DB (Batch)
        const idMap = new Map<string, string>() // t1 -> uuid

        // Propagate UUIDs
        const topicsToInsert = data.topics.map((t: any) => {
            const uuid = crypto.randomUUID()
            idMap.set(t.id, uuid)
            return {
                id: uuid,
                subject_id: subjectId,
                title: t.title,
                description: t.description || "",
                level: t.level || 'Beginner',
                status: 'LOCKED',
                x: t.x || 0,
                y: t.y || 0
            }
        })

        // Identify Roots (No dependencies pointing TO them)
        const childIds = new Set(data.dependencies?.map((d: any) => d.to) || [])
        
        topicsToInsert.forEach((t: any) => {
            const tempId = data.topics.find((topic: any) => topic.title === t.title)?.id
            if (tempId && !childIds.has(tempId)) {
                t.status = 'AVAILABLE'
            } else {
                t.status = 'LOCKED'
            }
        })

        // Remove duplicates on insert just in case (checking against existingTitles strictly matches)
        const finalTopicsToInsert = topicsToInsert.filter((t: any) => !existingTitles.includes(t.title))

        if (finalTopicsToInsert.length === 0) {
            // Nothing new generated
            return
        }

        const { error: insertError } = await supabase.from('topics').insert(finalTopicsToInsert)
        if (insertError) throw insertError

        // Insert Dependencies
        if (data.dependencies && data.dependencies.length > 0) {
            const depsToInsert = data.dependencies.map((d: any) => ({
                parent_topic_id: idMap.get(d.from),
                child_topic_id: idMap.get(d.to)
            })).filter((d: any) => d.parent_topic_id && d.child_topic_id)

            if (depsToInsert.length > 0) {
                const { error: depsError } = await supabase.from('topic_dependencies').insert(depsToInsert)
                if (depsError) console.error("Error saving dependencies:", depsError)
            }
        }

        revalidatePath(`/dashboard/subject/${subjectId}`)

    } catch (error: any) {
        console.error("AI Generation Error:", error)
        const keySuffix = apiKey ? apiKey.slice(-4) : "NONE"
        throw new Error(`${error.message || "Failed to generate curriculum."} (Key used: ...${keySuffix})`)
    }
}

export async function generateContent(topicId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // 1. Get Topic & Subject Context
    const { data: topic } = await supabase
        .from('topics')
        .select('*, subjects(title, description)')
        .eq('id', topicId)
        .single()

    if (!topic) throw new Error('Topic not found')

    // 2. Get API Key
    const apiKey = await getApiKeyInternal()
    if (!apiKey) throw new Error('API Key missing. Please set it in Settings.')

    // 3. Call Gemini
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    const prompt = `
        Act as a **Senior Subject Matter Expert** and **Pedagogue**.
        Generate a **Comprehensive Textbook Chapter** for the topic: "${topic.title}".
        Subject: "${topic.subjects.title}".
        Context: "${topic.subjects.description}".
        Level: "${topic.level}".

        **Goal:** Create a high-quality, concise learning resource. It should be punchy and directed, avoiding fluff.

        **Structure Requirements (JSON):**
        Return a JSON object with this EXACT structure:
        {
            "overview": "A calm, 2 paragraph introduction setting the context. Why does this matter? What will we learn?",
            "learning_outcomes": ["Outcome 1", "Outcome 2"],
            "sections": [
                {
                    "type": "concept",
                    "heading": "1. [Concept Name]",
                    "content": "Concise, clear explanation (approx. 100-150 words). Focus on the core idea. Avoid wall of text.",
                    "example": "A concrete, real-world example illustrating this specific concept effectively.",
                    "diagram": "OPTIONAL: A valid Mermaid.js flowchart string. CRITICAL: You MUST wrap ALL node labels in double quotes (e.g., A[\"My Label\"] or B{\"Decision?\"}). Do NOT use parentheses inside the quote unless really needed, and prefer simpler labels if possible. Example: graph TD; A[\"Start\"] --> B[\"Process\"];",
                    "table": { "headers": ["Col 1", "Col 2"], "rows": [["Val 1", "Val 2"]] } // OPTIONAL: Only if a comparison is needed here.
                },
                {
                    "type": "concept",
                    "heading": "2. [Next Concept]",
                    "content": "Continue the narrative...",
                    "example": "Another relevant example...",
                    "diagram": "..." 
                }
            ],
            "real_world_application": {
                "title": "Applied Engineering/Business Scenario",
                "description": "A detailed case study or application of the concepts."
            },
            "summary_bullets": ["Key Takeaway 1", "Key Takeaway 2"],
            "flashcards": [
                { "front": "Deep, critical thinking question?", "back": "Comprehensive answer." }
            ]
        }

        **Constraints:**
        1. **Conciseness:** Keep each section tight (around 6-7 lines). Get straight to the point.
        2. **Visuals:** You MUST include at least **2 diagrams** (Mermaid) and **1 table** across the sections.
        3. **Flow:** ensure the sections transition logically.
        4. **Tone:** Academic, patient, and authoritative.
        5. **Quantity:** Generate exactly **7 flashcards** covering key concepts.

        RETURN JSON ONLY.
    `

    // Retry logic for 429 Rate Limits
    let result;
    let attempt = 0;
    const maxRetries = 3;

    while (attempt < maxRetries) {
        try {
            result = await model.generateContent(prompt)
            break; // Success
        } catch (error: any) {
            if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
                attempt++;
                if (attempt === maxRetries) throw error;

                // Exponential backoff: 2s, 4s, 8s
                const delay = 2000 * Math.pow(2, attempt - 1);
                console.log(`Rate limit hit. Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`)
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error; // Not a rate limit error
            }
        }
    }

    try {
        if (!result) throw new Error("Failed to get response after retries")
        const response = await result.response
        const text = response.text()
        const jsonStr = text.replace(/```json\n|\n```/g, "").replace(/```/g, "").trim()
        const content = JSON.parse(jsonStr)

        // 4. Save Content
        const { error: saveError } = await supabase
            .from('topic_content')
            .upsert({
                topic_id: topicId,
                content_json: content
            })

        if (saveError) throw saveError

        // 5. Update Status
        await supabase
            .from('topics')
            .update({ status: 'GENERATED' })
            .eq('id', topicId)

        // 6. Save Flashcards
        if (content.flashcards) {
            const flashcardsToInsert = content.flashcards.map((f: any) => ({
                topic_id: topicId,
                front: f.front,
                back: f.back
            }))
            await supabase.from('flashcards').delete().eq('topic_id', topicId) // Clear old
            await supabase.from('flashcards').insert(flashcardsToInsert)
        }

        revalidatePath(`/dashboard/learn/${topicId}`)
        return content

    } catch (error: any) {
        console.error("AI Content Generation Error:", error)
        const keySuffix = apiKey ? apiKey.slice(-4) : "NONE"
        throw new Error(`${error.message || "Failed to generate content."} (Key used: ...${keySuffix})`)
    }
}

export async function completeTopic(topicId: string) {
    const supabase = await createClient()

    // 1. Mark current as COMPLETED
    await supabase.from('topics').update({ status: 'COMPLETED' }).eq('id', topicId)

    // 1b. Update Streak
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        const today = new Date().toISOString().split('T')[0]

        const { data: profile } = await supabase
            .from('profiles')
            .select('streak_count, last_active_date')
            .eq('id', user.id)
            .single()

        if (profile) {
            let newStreak = profile.streak_count || 0
            const lastActive = profile.last_active_date

            if (lastActive !== today) {
                const yesterday = new Date()
                yesterday.setDate(yesterday.getDate() - 1)
                const yesterdayStr = yesterday.toISOString().split('T')[0]

                if (lastActive === yesterdayStr) {
                    newStreak += 1
                } else {
                    newStreak = 1 // Broken streak or first time
                }

                await supabase.from('profiles').update({
                    streak_count: newStreak,
                    last_active_date: today
                }).eq('id', user.id)
            }
        }
    }

    // 2. Find children (topics that depend on this one)
    const { data: childrenLinks } = await supabase
        .from('topic_dependencies')
        .select('child_topic_id')
        .eq('parent_topic_id', topicId)

    if (childrenLinks && childrenLinks.length > 0) {
        for (const link of childrenLinks) {
            const childId = link.child_topic_id

            // Check if ALL parents of this child are completed
            const { data: parents } = await supabase
                .from('topic_dependencies')
                .select('parent_topic_id')
                .eq('child_topic_id', childId)

            const parentIds = parents?.map(p => p.parent_topic_id) || []

            const { count } = await supabase
                .from('topics')
                .select('*', { count: 'exact', head: true })
                .in('id', parentIds)
                .neq('status', 'COMPLETED') // Count how many parents are NOT completed

            // If count is 0, it means all parents are completed
            if (count === 0) {
                await supabase
                    .from('topics')
                    .update({ status: 'AVAILABLE' })
                    .eq('id', childId)
                    // Only update if it was LOCKED. Don't overwrite if already GENERATED/COMPLETED
                    .eq('status', 'LOCKED')
            }
        }
    }

    revalidatePath('/dashboard')

    // Log Activity (15 mins per topic completion)
    // We already have topic context from line ~591 if we moved it up, or we can fetch it.
    // Actually completeTopic logic above used 'parents' but didn't fetch the *current* topic's subject_id explicitly early on.
    // Let's fetch it or use what we have.
    const { data: currentTopic } = await supabase.from('topics').select('subject_id').eq('id', topicId).single()
    if (currentTopic) {
        await incrementActivity(15, currentTopic.subject_id)
    }
}

export async function chatWithTutor(topicId: string, messages: { role: string, content: string }[]) {
    const supabase = await createClient()

    // 1. Context
    const { data: topic } = await supabase.from('topics').select('*, subjects(title, description)').eq('id', topicId).single()
    if (!topic) throw new Error("Topic not found")

    // 2. API Key
    const apiKey = await getApiKeyInternal()
    if (!apiKey) throw new Error('API Key missing.')

    // 3. Gemini Chat
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    // Construct history for Gemini
    // Ensure roles are mapped correctly (user -> user, model -> model)
    const history = messages.slice(0, -1).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
    }))

    const lastMessage = messages[messages.length - 1].content

    const chat = model.startChat({
        history: [
            {
                role: "user",
                parts: [{
                    text: `System Instruction: You are an expert AI Tutor for the topic: "${topic.title}" (Subject: ${topic.subjects.title}).
Context: ${topic.description}.
Level: ${topic.level}.
Your goal is to answer the user's questions about this topic clearly and concisely.
If they ask about something unrelated, politely steer them back to ${topic.title}.`
                }]
            },
            {
                role: "model",
                parts: [{ text: "Understood. I am ready to help you learn about " + topic.title + "." }]
            },
            ...history
        ]
    })

    try {
        const result = await chat.sendMessage(lastMessage)
        const response = await result.response
        const text = response.text()
        return { role: 'model', content: text }
    } catch (e: any) {
        console.error("Chat Error:", e)
        return { role: 'model', content: "I'm having trouble connecting right now. Please check your API key or try again." }
    }
}

export async function chatWithDashboardTutor(messages: { role: string, content: string }[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // 1. Get User Profile & Recent Subjects for Context
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single()
    const { data: recentSubjects } = await supabase
        .from('subjects')
        .select('title, description')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(5)

    const subjectContext = recentSubjects?.map(s => `- ${s.title}: ${s.description?.slice(0, 50)}...`).join('\n') || "No active subjects."

    // 2. API Key
    const apiKey = await getApiKeyInternal()
    if (!apiKey) throw new Error('API Key missing.')

    // 3. Gemini Chat
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    // Construct history
    const history = messages.slice(0, -1).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
    }))

    const lastMessage = messages[messages.length - 1].content

    const chat = model.startChat({
        history: [
            {
                role: "user",
                parts: [{
                    text: `System Instruction: You are a **Personal Learning Assistant** for the user.
                    
                    **User Profile:**
                    - Name: ${profile?.full_name || 'Student'}
                    - Education: ${profile?.education_level || 'Not specified'}
                    - Learning Style: ${profile?.learning_style || 'Not specified'}
                    
                    **Current Active Subjects:**
                    ${subjectContext}
                    
                    **Goal:**
                    - Answer ANY doubt the user has, primarily about their subjects but also general academic questions.
                    - Be proactive: suggested related concepts if they seem stuck.
                    - Use analogies and simple explanations.
                    - If they ask about a specific file they uploaded (e.g. "my OS notes"), assume they are referring to one of the active subjects context.
                    
                    Keep answers concise, encouraging, and highly educational. Avoid "As an AI" disclaimers.`
                }]
            },
            {
                role: "model",
                parts: [{ text: `Hello ${profile?.full_name || 'there'}! I'm ready to help you with your studies. What are we tackling today?` }]
            },
            ...history
        ]
    })

    try {
        const result = await chat.sendMessage(lastMessage)
        const response = await result.response
        const text = response.text()
        return { role: 'model', content: text }
    } catch (e: any) {
        console.error("Dashboard Chat Error:", e)
        return { role: 'model', content: "I'm having trouble connecting right now. Please check your API key." }
    }
}

export async function generateTopicQuiz(topicId: string) {
    const supabase = await createClient()

    // 1. Get Topic Details
    const { data: topic } = await supabase
        .from('topics')
        .select('*, subjects(*)')
        .eq('id', topicId)
        .single()

    if (!topic) throw new Error("Topic not found")

    // 2. Generate Quiz with Gemini
    const apiKey = await getApiKeyInternal()
    if (!apiKey) throw new Error("Gemini API key not configured")

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    const prompt = `
        Act as an expert tutor.
        Generate a short quiz for the topic: "${topic.title}".
        Subject: "${topic.subjects.title}".
        Context: "${topic.subjects.description}".

        Return a JSON object with a "questions" array (6-7 questions).
        Each question object must be:
        {
            "id": "q1",
            "question": "The actual question text?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctAnswer": "Option A",
            "explanation": "Why this is correct."
        }

        RETURN JSON ONLY. NO MARKDOWN.
    `

    try {
        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()
        const jsonStr = text.replace(/```json\n|\n```/g, "").replace(/```/g, "").trim()
        const data = JSON.parse(jsonStr)

        if (!data.questions || !Array.isArray(data.questions)) throw new Error('Invalid AI response')

        return data.questions
    } catch (error) {
        console.error('Quiz Generation Error:', error)
        return null // Handle error gracefully on client
    }
}

export async function simplifyContent(text: string) {
    const apiKey = await getApiKeyInternal()
    if (!apiKey) throw new Error("Gemini API key not configured. Please add it in Settings.")

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    const prompt = `
        You are an expert teacher helping a student.
        Rewrite the following text to be "explained like I'm 5" (ELI5).
        Make it simple, using analogies where possible, but keep it accurate.
        Keep the formatting strictly plain text or simple markdown.

        Original Text:
        "${text}"
    `

    try {
        const result = await model.generateContent(prompt)
        const response = await result.response
        return response.text()
    } catch (e: any) {
        console.error("Simplify Error:", e)
        throw new Error(e.message || "Failed to simplify content.")
    }
}

export async function getStreak() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { count: 0, active: false }

    const { data } = await supabase
        .from('profiles')
        .select('streak_count, last_active_date')
        .eq('id', user.id)
        .single()

    if (!data) return { count: 0, active: false }

    const today = new Date().toISOString().split('T')[0]
    const isActiveToday = data.last_active_date === today

    return {
        count: data.streak_count || 0,
        active: isActiveToday
    }
}


export async function incrementActivity(minutes: number, subjectId?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const today = new Date().toISOString().split('T')[0]

    // Fetch existing log for this user/subject/date
    // Note: If subjectId is undefined (global activity?), we might handle it differently.
    // But for now, let's assume all activity *should* belong to a subject if possible.
    // If subjectId is not provided, we might log it as 'null' subject (general).

    let query = supabase
        .from('activity_logs')
        .select('minutes_active')
        .eq('user_id', user.id)
        .eq('activity_date', today)

    if (subjectId) {
        query = query.eq('subject_id', subjectId)
    } else {
        query = query.is('subject_id', null)
    }

    const { data: text } = await query.single()

    const current = text ? text.minutes_active : 0

    await supabase.from('activity_logs').upsert({
        user_id: user.id,
        activity_date: today,
        subject_id: subjectId || null,
        minutes_active: current + minutes
    })
}

export async function getWeeklyActivity(subjectId?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    let query = supabase
        .from('activity_logs')
        .select('activity_date, minutes_active')
        .eq('user_id', user.id)
        .order('activity_date', { ascending: true })
    // .limit(7) // Limit behaves weirdly with date ranges if gaps exist, but ok for now

    if (subjectId) {
        query = query.eq('subject_id', subjectId)
    }
    // If no subjectId, we want ALL activity. 
    // However, we have potentially multiple rows per date (different subjects).
    // We need to aggregate them in JS because Supabase (PostgREST) aggregation is tricky without RPC.

    const { data } = await query

    if (!data) return []

    // Aggregate by date
    const activityMap = new Map<string, number>()

    // Initialize last 7 days with 0 (optional, but good for charts)
    for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        activityMap.set(dateStr, 0)
    }

    data.forEach((log: any) => {
        const current = activityMap.get(log.activity_date) || 0
        activityMap.set(log.activity_date, current + log.minutes_active)
    })

    // Convert back to array
    return Array.from(activityMap.entries()).map(([date, minutes]) => ({
        activity_date: date,
        minutes_active: minutes
    })).sort((a, b) => a.activity_date.localeCompare(b.activity_date))
}

export async function addTopic(subjectId: string, title: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    // Verify ownership
    const { data: subject } = await supabase
        .from('subjects')
        .select('id')
        .eq('id', subjectId)
        .eq('user_id', user.id)
        .single()

    if (!subject) throw new Error("Subject not found or access denied")

    const { error } = await supabase
        .from('topics')
        .insert({
            subject_id: subjectId,
            title: title,
            status: 'AVAILABLE'
        })

    if (error) throw error
    revalidatePath(`/dashboard/subject/${subjectId}`)
}
// Link Topics Feature
export async function getTopicsSimple(subjectId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const { data, error } = await supabase
        .from('topics')
        .select('id, title, status')
        .eq('subject_id', subjectId)
        .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
}

export async function linkTopics(parentTopicId: string, childTopicId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    // Check circular dependency (Basic check: Parent != Child)
    if (parentTopicId === childTopicId) {
        throw new Error("Cannot link a topic to itself")
    }

    // TODO: Advanced circular check could be added here (A->B->A)

    const { error } = await supabase
        .from('topic_dependencies')
        .insert({
            parent_topic_id: parentTopicId,
            child_topic_id: childTopicId
        })

    if (error) {
        if (error.code === '23505') throw new Error("These topics are already linked")
        throw error
    }

    // Revalidate to update graph
    // We need subjectId to revalidate path... but we only have topicIds.
    // We can fetch it or just rely on client refresh. 
    // Ideally fetch subjectId.
    const { data: topic } = await supabase.from('topics').select('subject_id').eq('id', parentTopicId).single()
    if (topic) {
        revalidatePath(`/dashboard/subject/${topic.subject_id}`)
    }
}

export async function getResumeTopic() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Find the most recently updated topic 
    const { data, error } = await supabase
        .from('topics')
        .select(`
            *,
            subjects (
                title
            )
        `)
        .eq('user_id', user.id)
        .in('status', ['IN_PROGRESS', 'GENERATED', 'COMPLETED'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

    if (error || !data) return null
    return data
}
// === COMMUNITY FEATURES ===

export async function getCommunitySubjects() {
    const supabase = await createClient()

    // Join with profiles to get author name
    const { data, error } = await supabase
        .from('subjects')
        .select('*, profiles(full_name)')
        .eq('is_public', true)
        .order('clones', { ascending: false })

    if (error) {
        console.error('Error fetching community subjects:', error)
        return []
    }

    return data
}

export async function cloneSubject(subjectId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // 1. Fetch Original Subject
    const { data: originalSubject, error: subjectError } = await supabase
        .from('subjects')
        .select('*')
        .eq('id', subjectId)
        .single()

    if (subjectError || !originalSubject) throw new Error('Subject not found')

    // 2. Create New Subject for User
    const { data: newSubject, error: createError } = await supabase
        .from('subjects')
        .insert({
            user_id: user.id,
            title: `Copy of ${originalSubject.title}`,
            description: originalSubject.description
        })
        .select()
        .single()

    if (createError) throw new Error('Failed to create subject copy')

    // 3. Increment Clone Count
    await supabase.from('subjects').update({ clones: (originalSubject.clones || 0) + 1 }).eq('id', subjectId)

    // 4. Copy Topics (Simplified: No recursion for deep structure yet, just topics + content)
    // Fetch original topics
    const { data: originalTopics } = await supabase.from('topics').select('*').eq('subject_id', subjectId)

    if (originalTopics && originalTopics.length > 0) {
        // Map old ID to new ID for dependencies
        const idMap = new Map<string, string>()

        for (const topic of originalTopics) {
            const { data: newTopic } = await supabase
                .from('topics')
                .insert({
                    subject_id: newSubject.id,
                    title: topic.title,
                    description: topic.description,
                    level: topic.level,
                    status: topic.status, // or reset to LOCKED? keeping status for now
                    x: topic.x,
                    y: topic.y,
                    order_index: topic.order_index
                })
                .select()
                .single()

            if (newTopic) {
                idMap.set(topic.id, newTopic.id)

                // Copy Content
                const { data: content } = await supabase.from('topic_content').select('*').eq('topic_id', topic.id).single()
                if (content) {
                    await supabase.from('topic_content').insert({
                        topic_id: newTopic.id,
                        content_json: content.content_json
                    })
                }
            }
        }

        // Copy Dependencies
        const { data: originalDeps } = await supabase
            .from('topic_dependencies')
            .select('*')
            .in('parent_topic_id', originalTopics.map(t => t.id))

        if (originalDeps) {
            const newDeps = originalDeps.map(d => ({
                parent_topic_id: idMap.get(d.parent_topic_id),
                child_topic_id: idMap.get(d.child_topic_id)
            })).filter(d => d.parent_topic_id && d.child_topic_id)

            if (newDeps.length > 0) {
                await supabase.from('topic_dependencies').insert(newDeps)
            }
        }
    }

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/community')
}

// === QUIZ SYSTEM ===

export async function generateQuiz(params: {
    subjectId?: string
    subjectName: string
    topics: string
    difficulty: number
    count: number
}) {
    const supabase = await createClient()
    const response = await supabase.auth.getUser()

    const user = response.data?.user
    if (!user) throw new Error('Not authenticated')
    if (!Number.isFinite(params.count) || params.count < 1) {
        throw new Error('Question count must be a positive number.')
    }

    const apiKey = await getApiKeyForUserId(user.id)
    if (!apiKey) throw new Error('API Key missing. Please set it in Settings.')

    // 1. Fetch previous questions to build an EXCLUDE_LIST
    // We only want to exclude questions from the same subject/topics to avoid getting too general.
    const existingQuestionSamples: string[] = []
    try {
        let query = supabase
            .from('quizzes')
            .select('questions')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(80)
        if (params.subjectName) {
            query = query.eq('subject_name', params.subjectName)
        }
        const { data: previousQuizzes } = await query
        
        if (previousQuizzes && previousQuizzes.length > 0) {
            previousQuizzes.forEach(quiz => {
                if (Array.isArray(quiz.questions)) {
                    quiz.questions.forEach((q) => {
                        if (q && typeof q === 'object' && 'question' in q && typeof q.question === 'string') {
                            if (existingQuestionSamples.length < 60) {
                                existingQuestionSamples.push(q.question)
                            }
                        }
                    })
                }
            })
        }
    } catch (e) {
        console.warn("Failed to fetch previous questions for exclusion", e)
    }

    // 2. Build AI Prompt
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    })

    try {
        const initialBatchCount = Math.min(params.count, 20)
        const initialQuestions = await generateUniqueQuizQuestions({
            model,
            subjectName: params.subjectName,
            topics: params.topics,
            difficulty: params.difficulty,
            count: initialBatchCount,
            blockedQuestions: existingQuestionSamples,
            seenDifficultyLabels: []
        })

        if (initialQuestions.length !== initialBatchCount) {
            throw new Error(`Could only generate ${initialQuestions.length} unique questions out of ${initialBatchCount}. Try again or reduce the count.`)
        }

        // 3. Save to DB
        const newQuizId = crypto.randomUUID()
        const { error: insertError } = await supabase
            .from('quizzes')
            .insert({
                id: newQuizId,
                user_id: user.id,
                subject_id: params.subjectId || null,
                subject_name: params.subjectName,
                difficulty: params.difficulty,
                topics: {
                    raw: params.topics,
                    target_count: params.count,
                    generation_mode: 'progressive',
                    initial_batch_size: initialBatchCount,
                },
                questions: initialQuestions
            })

        if (insertError) {
            console.error("DB Insert Error:", insertError)
            throw new Error(`Failed to save quiz: ${insertError.message}`)
        }

        return newQuizId

    } catch (e: any) {
        console.error("Quiz generation failed:", e)
        throw new Error(e.message || "Failed to communicate with AI.")
    }
}

export async function generateMoreQuizQuestions(params: {
    quizId: string
    currentQuestions: GeneratedQuizQuestion[]
    desiredCount: number
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: quiz, error } = await supabase
        .from('quizzes')
        .select('subject_name, difficulty, topics')
        .eq('id', params.quizId)
        .eq('user_id', user.id)
        .single()

    if (error || !quiz) {
        throw new Error('Quiz not found.')
    }

    const apiKey = await getApiKeyForUserId(user.id)
    if (!apiKey) throw new Error('API Key missing. Please set it in Settings.')

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    })

    const blockedQuestions = params.currentQuestions.map(q => q.question)
    const seenDifficultyLabels = params.currentQuestions.map(q => q.difficulty_label)
    const newQuestions = await generateUniqueQuizQuestions({
        model,
        subjectName: quiz.subject_name,
        topics: typeof quiz.topics === 'object' && quiz.topics !== null && 'raw' in quiz.topics
            ? String((quiz.topics as { raw?: unknown }).raw || '')
            : '',
        difficulty: quiz.difficulty,
        count: params.desiredCount,
        blockedQuestions,
        seenDifficultyLabels
    })

    if (newQuestions.length === 0) {
        throw new Error('Could not generate more unique questions right now. Please continue or try again.')
    }

    const updatedQuestions = [...params.currentQuestions, ...newQuestions]
    const { error: updateError } = await supabase
        .from('quizzes')
        .update({ questions: updatedQuestions })
        .eq('id', params.quizId)
        .eq('user_id', user.id)

    if (updateError) {
        throw new Error(`Failed to extend quiz: ${updateError.message}`)
    }

    return newQuestions
}

export async function submitQuiz(
    quizId: string,
    userAnswers: Record<number, any>,
    questions: any[],
    visitedQuestionIndexes: number[]
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    let score = 0
    const total = visitedQuestionIndexes.length

    const evaluatedQuestions = visitedQuestionIndexes
        .map(index => questions[index])
        .filter(Boolean)

    // Evaluate answers
    for (let i = 0; i < visitedQuestionIndexes.length; i++) {
        const questionIndex = visitedQuestionIndexes[i]
        const q = questions[questionIndex]
        const userAnswer = userAnswers[questionIndex]
        
        if (q.type === 'single_mcq' || q.type === 'fill_in_blank') {
            // Case-insensitive string matching for fill_in_blank just in case
            const normalizedUser = String(userAnswer || "").trim().toLowerCase()
            const normalizedCorrect = String(q.correct_answer || "").trim().toLowerCase()
            
            if (normalizedUser === normalizedCorrect && normalizedUser !== "") {
                score++
            }
        } else if (q.type === 'multi_mcq') {
            const userArr = Array.isArray(userAnswer) ? userAnswer : []
            const correctArr = Array.isArray(q.correct_answer) ? q.correct_answer : []
            
            // Exact match of arrays (independent of order)
            if (userArr.length === correctArr.length && userArr.length > 0) {
                const isMatch = userArr.every(val => correctArr.includes(val))
                if (isMatch) score++
            }
        }
    }

    // Save to DB
    const resultId = crypto.randomUUID()
    const { error } = await supabase
        .from('quiz_results')
        .insert({
            id: resultId,
            quiz_id: quizId,
            user_id: user.id,
            score: score,
            total_questions: total,
            user_answers: {
                answers: userAnswers,
                visited_question_indexes: visitedQuestionIndexes,
                evaluated_questions: evaluatedQuestions,
            }
        })

    if (error) {
        console.error("DB Insert Result Error:", error)
        throw new Error("Failed to save quiz results.")
    }

    return resultId
}
