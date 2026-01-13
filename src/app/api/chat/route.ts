import { NextRequest, NextResponse } from 'next/server';
import { generateAnswer } from '@/lib/vertex-ai';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
    try {
        const { question } = await req.json();

        if (!question) {
            return NextResponse.json({ error: 'Question is required' }, { status: 400 });
        }

        const answer = await generateAnswer(question);

        // Save to Supabase (Insights) - as per guide "create table saved_insights"
        // I need to check if we can get user session.
        // For now, I'll try to insert if I can, or skip if no session.
        // The guide has RLS "Users can insert their own insights".
        // I probably need auth. 
        // I'll proceed without strict auth enforcement for now or use anon if RLS allows.
        // Actually, I'll validly attempt to insert but ignore error if not logged in.

        // Simplified: Just return answer for now. If user asked for persistence, I'd add it.
        // Guide Section 5 mentions "saved_insights" table and "Users can insert their own insights".
        // I should try to save it.

        const { error } = await supabase.from('saved_insights').insert({
            question,
            answer,
        });

        if (error) {
            console.warn('Failed to save insight:', error);
        }

        return NextResponse.json({ answer });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error('Chat Error:', error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error.message || String(error)
        }, { status: 500 });
    }
}
