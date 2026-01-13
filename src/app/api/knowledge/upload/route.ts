import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { supabase } from '@/lib/supabase';
import { importDocuments } from '@/lib/vertex-ai';

export const dynamic = 'force-dynamic';

const BUCKET_NAME = process.env.GOOGLE_STORAGE_BUCKET || 'default-bucket'; // User needs to set this

function getStorage() {
    return new Storage({
        projectId: process.env.GOOGLE_PROJECT_ID,
        credentials: {
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
    });
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = file.name;

        // 1. Upload to Supabase Storage (Visual/Backup)
        const { error: supabaseError } = await supabase.storage
            .from('knowledge')
            .upload(filename, buffer, { upsert: true, contentType: file.type });

        if (supabaseError) {
            console.error('Supabase Upload Error:', supabaseError);
            // Non-blocking? Maybe, but usually good to have.
        }

        // 2. Upload to Google Cloud Storage (Source of Truth for Vertex AI)
        const gcsPath = `database/${filename}`;
        const bucket = getStorage().bucket(BUCKET_NAME);
        const gcsFile = bucket.file(gcsPath);

        await gcsFile.save(buffer, {
            metadata: { contentType: file.type },
        });

        const gcsUri = `gs://${BUCKET_NAME}/${gcsPath}`;

        // 3. Trigger Vertex AI Import
        await importDocuments(gcsUri);

        return NextResponse.json({ success: true, gcsUri });
    } catch (error) {
        console.error('Upload Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
