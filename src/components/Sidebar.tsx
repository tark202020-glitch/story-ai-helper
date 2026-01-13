'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, PenTool, MessageSquare, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
    { href: '/', label: 'Home', icon: Home }, // Landing page
    { href: '/knowledge', label: 'Knowledge Base', icon: BookOpen },
    { href: '/work', label: 'Writing Studio', icon: PenTool },
    { href: '/chat', label: 'Assistant Chat', icon: MessageSquare },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 border-r border-border bg-card text-card-foreground flex flex-col h-screen fixed top-0 left-0 overflow-y-auto z-40">
            <div className="p-6 border-b border-border">
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    StoryAI Helper
                </h1>
            </div>
            <nav className="flex-1 p-4 space-y-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                                isActive ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"
                            )}
                        >
                            <item.icon className="w-5 h-5" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>
            <div className="p-4 border-t border-border">
                <div className="text-xs text-muted-foreground text-center">
                    Powered by Vertex AI
                </div>
            </div>
        </aside>
    );
}
