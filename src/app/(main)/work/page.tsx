'use client';

import { useState, useEffect } from 'react';
import { Upload, CheckCircle, AlertCircle, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WorkPage() {
    const [activeTab, setActiveTab] = useState<'script' | 'treatment'>('script');
    const [isUploading, setIsUploading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [files, setFiles] = useState<any[]>([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);

    useEffect(() => {
        fetchFiles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    async function fetchFiles() {
        setIsLoadingFiles(true);
        try {
            const res = await fetch(`/api/work/list?type=${activeTab}`);
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
        formData.append('type', activeTab);

        try {
            const res = await fetch('/api/work/upload', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) throw new Error('Upload failed');

            setStatus({ type: 'success', message: 'Import Completed' });
            fetchFiles(); // Refresh list
        } catch (error) {
            console.error(error);
            setStatus({ type: 'error', message: 'Failed to upload work.' });
        } finally {
            setIsUploading(false);
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Writing Studio</h1>
                <p className="text-muted-foreground mt-2">
                    Manage your Scripts (Canon) and Treatments/Ideas.
                </p>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 rounded-lg bg-secondary p-1 w-fit">
                <button
                    onClick={() => { setActiveTab('script'); setStatus(null); }}
                    className={cn(
                        "px-4 py-2 text-sm font-medium rounded-md transition-all",
                        activeTab === 'script'
                            ? "bg-background text-foreground shadow"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    Completed Scripts
                </button>
                <button
                    onClick={() => { setActiveTab('treatment'); setStatus(null); }}
                    className={cn(
                        "px-4 py-2 text-sm font-medium rounded-md transition-all",
                        activeTab === 'treatment'
                            ? "bg-background text-foreground shadow"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    Treatments (In Progress)
                </button>
            </div>

            <div className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center space-y-4 hover:bg-accent/50 transition-colors">
                <div className="p-4 rounded-full bg-secondary">
                    <Upload className="w-8 h-8 text-secondary-foreground" />
                </div>
                <div className="text-center">
                    <h3 className="text-lg font-semibold">Upload {activeTab === 'script' ? 'Script' : 'Treatment'}</h3>
                    <p className="text-sm text-muted-foreground">PDF, TXT supported</p>
                </div>
                <input
                    type="file"
                    accept=".pdf,.txt"
                    className="hidden"
                    id="work-upload"
                    onChange={handleUpload}
                    disabled={isUploading}
                    key={activeTab} // Force visual reset on tab change
                />
                <label
                    htmlFor="work-upload"
                    className={cn(
                        "cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                        "bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2",
                        isUploading && "opacity-50 cursor-not-allowed"
                    )}
                >
                    {isUploading ? 'Importing...' : 'Select File'}
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
                <h2 className="text-xl font-semibold">Uploaded {activeTab === 'script' ? 'Scripts' : 'Treatments'}</h2>
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
