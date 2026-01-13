import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

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

export async function GET() {
    try {
        const prefix = 'database/';

        const storage = getStorage();
        const bucket = storage.bucket(BUCKET_NAME);

        // Get files from the 'database/' folder
        const [files] = await bucket.getFiles({ prefix });

        const fileList = files
            .filter(file => file.name !== prefix) // Exclude the folder itself
            .map(file => ({
                name: file.name.replace(prefix, ''),
                size: file.metadata.size ? parseInt(file.metadata.size as string) : 0,
                updated: file.metadata.updated,
                contentType: file.metadata.contentType
            }));

        return NextResponse.json({ files: fileList });
    } catch (error) {
        console.error('List Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
