import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { importDocuments } from '@/lib/vertex-ai';

export const dynamic = 'force-dynamic';

const BUCKET_NAME = process.env.GOOGLE_STORAGE_BUCKET || 'default-bucket';

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
        const type = formData.get('type') as string; // 'script' or 'treatment'

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }
        if (!type || !['script', 'treatment'].includes(type)) {
            return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = file.name;

        // Determine GCS path
        const folder = type === 'script' ? 'scripts' : 'treatments';
        const gcsPath = `work/${folder}/${filename}`;

        // Upload to Google Cloud Storage
        const bucket = getStorage().bucket(BUCKET_NAME);

        const gcsFile = bucket.file(gcsPath);

        await gcsFile.save(buffer, {
            metadata: { contentType: file.type },
        });

        const gcsUri = `gs://${BUCKET_NAME}/${gcsPath}`;

        // Trigger Vertex AI Import
        await importDocuments(gcsUri);

        return NextResponse.json({ success: true, gcsUri, type });
    } catch (error) {
        console.error('Work Upload Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
