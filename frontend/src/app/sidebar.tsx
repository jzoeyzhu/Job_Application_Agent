"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { listSessions, deleteSession, type SessionMetadata } from "@/lib/api";

function groupByDate(sessions: SessionMetadata[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; items: SessionMetadata[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "This Week", items: [] },
    { label: "Older", items: [] },
  ];

  for (const s of sessions) {
    const d = new Date(s.created_at);
    if (d >= today) groups[0].items.push(s);
    else if (d >= yesterday) groups[1].items.push(s);
    else if (d >= weekAgo) groups[2].items.push(s);
    else groups[3].items.push(s);
  }

  return groups.filter((g) => g.items.length > 0);
}

export function Sidebar() {
  const pathname = usePathname();
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  const refresh = () => {
    listSessions().then(setSessions);
  };

  useEffect(() => {
    refresh();
  }, [pathname]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this session?")) return;
    await deleteSession(id);
    refresh();
  };

  const statusDot: Record<string, string> = {
    completed: "bg-success",
    running: "bg-primary animate-pulse-dot",
    failed: "bg-danger",
  };

  const groups = groupByDate(sessions);

  return (
    <aside
      className={`shrink-0 border-r border-card-border bg-background-secondary flex flex-col transition-all duration-300 ${
        collapsed ? "w-[56px]" : "w-[260px]"
      }`}
    >
      {/* Logo */}
      <div className="px-4 h-14 flex items-center gap-3 shrink-0">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-[10px] bg-primary/10 border border-primary/15 flex items-center justify-center group-hover:bg-primary/15 group-hover:border-primary/25 transition-all">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          {!collapsed && (
            <span className="font-semibold text-[15px] tracking-tight text-foreground">
              Job Agent
            </span>
          )}
        </Link>
      </div>

      {/* Nav */}
      <div className="px-2.5 flex flex-col gap-0.5">
        <Link
          href="/"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
            pathname === "/" || pathname === "/analyze"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-card"
          }`}
        >
          <svg className="w-[16px] h-[16px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {!collapsed && <span>New Analysis</span>}
        </Link>
        <Link
          href="/resumes"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
            pathname === "/resumes"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-card"
          }`}
        >
          <svg className="w-[16px] h-[16px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          {!collapsed && <span>Resumes</span>}
        </Link>
      </div>

      {/* Divider */}
      <div className="mx-4 my-3 divider-accent" />

      {/* Session list — date grouped */}
      <div className="flex-1 overflow-y-auto px-2.5 pb-3">
        {sessions.length === 0 ? (
          !collapsed && (
            <div className="px-3 py-10 text-center">
              <div className="w-8 h-8 mx-auto mb-2.5 rounded-lg bg-accent flex items-center justify-center">
                <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-[11px] text-muted font-light">No history yet</p>
            </div>
          )
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.label}>
                {!collapsed && (
                  <p className="text-[10px] font-medium text-muted uppercase tracking-[0.1em] px-3 mb-1">
                    {group.label}
                  </p>
                )}
                <div className="space-y-px">
                  {group.items.map((s) => {
                    const isActive = pathname === `/sessions/${s.id}`;
                    return (
                      <Link
                        key={s.id}
                        href={`/sessions/${s.id}`}
                        className={`group flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all ${
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-card"
                        }`}
                        title={s.name}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[s.status] || statusDot.failed}`} />
                        {!collapsed && (
                          <>
                            <span className="truncate flex-1 text-[12.5px]">{s.name}</span>
                            <button
                              onClick={(e) => handleDelete(s.id, e)}
                              className="p-0.5 rounded text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-all shrink-0"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <div className="p-2.5 border-t border-card-border shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-card transition-all"
          title={collapsed ? "Expand" : "Collapse"}
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
