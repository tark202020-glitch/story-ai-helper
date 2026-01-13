'use client';

import { useState, useEffect } from 'react';
import { Upload, CheckCircle, AlertCircle, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
// import { supabase } from '@/lib/supabase'; // No longer needed for listing if using GCS

export default function KnowledgePage() {
    const [isUploading, setIsUploading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [files, setFiles] = useState<any[]>([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(true);

    useEffect(() => {
        fetchFiles();
    }, []);

    async function fetchFiles() {
        setIsLoadingFiles(true);
        try {
            const res = await fetch('/api/knowledge/list');
            if (res.ok) {
                const data = await res.json();
                setFiles(data.files || []);
            } else {
                console.error('Failed to fetch files');
                setFiles([]);
            }
        } catch (error) {
            console.error('Error fetching files:', error);
            setFiles([]);
        } finally {
            setIsLoadingFiles(false);
        }
    }

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setStatus(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/knowledge/upload', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) throw new Error('Upload failed');

            setStatus({ type: 'success', message: 'Knowledge successfully uploaded and indexed.' });
            fetchFiles(); // Refresh list
        } catch (error) {
            console.error(error);
            setStatus({ type: 'error', message: 'Failed to upload knowledge.' });
        } finally {
            setIsUploading(false);
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
                <p className="text-muted-foreground mt-2">
                    Upload reference materials, theories, and background knowledge for the AI to learn.
                </p>
            </div>

            <div className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center space-y-4 hover:bg-accent/50 transition-colors">
                <div className="p-4 rounded-full bg-secondary">
                    <Upload className="w-8 h-8 text-secondary-foreground" />
                </div>
                <div className="text-center">
                    <h3 className="text-lg font-semibold">Upload Knowledge File</h3>
                    <p className="text-sm text-muted-foreground">PDF, TXT supported</p>
                </div>
                <input
                    type="file"
                    accept=".pdf,.txt" // Guide says PDF, TXT
                    className="hidden"
                    id="knowledge-upload"
                    onChange={handleUpload}
                    disabled={isUploading}
                />
                <label
                    htmlFor="knowledge-upload"
                    className={cn(
                        "cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                        "bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2",
                        isUploading && "opacity-50 cursor-not-allowed"
                    )}
                >
                    {isUploading ? 'Uploading...' : 'Select File'}
                </label>
            </div>

            {status && (
                <div className={cn(
                    "p-4 rounded-lg flex items-center gap-2",
                    status.type === 'success' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                )}>
                    {status.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    {status.message}
                </div>
            )}

            <div className="space-y-4">
                <h2 className="text-xl font-semibold">Uploaded Files (GCS)</h2>
                {isLoadingFiles ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading files...
                    </div>
                ) : files.length === 0 ? (
                    <p className="text-muted-foreground">No files uploaded yet.</p>
                ) : (
                    <div className="grid gap-2">
                        {files.map((file) => (
                            <div key={file.name} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded bg-secondary/50">
                                        <FileText className="w-4 h-4 text-primary" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm">{file.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {(file.size / 1024).toFixed(1)} KB • {new Date(file.updated).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
