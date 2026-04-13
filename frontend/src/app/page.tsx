"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { listResumes, type ResumeMetadata } from "@/lib/api";

export default function InputPage() {
  const router = useRouter();
  const [jdText, setJdText] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [resumes, setResumes] = useState<ResumeMetadata[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listResumes().then((data) => {
      setResumes(data);
      const def = data.find((r) => r.is_default);
      if (def) setSelectedResumeId(def.id);
      setLoading(false);
    });
  }, []);

  const ready = jdText.trim().length > 0 && selectedResumeId;

  const handleAnalyze = useCallback(() => {
    if (!jdText.trim() || !selectedResumeId) return;
    sessionStorage.setItem(
      "analyzeInput",
      JSON.stringify({
        jdText,
        resumeId: selectedResumeId,
        sessionName: sessionName.trim() || "Untitled Application",
      }),
    );
    router.push("/analyze");
  }, [jdText, selectedResumeId, sessionName, router]);

  // Keyboard shortcut: Cmd/Ctrl + Enter to analyze
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && ready) {
        e.preventDefault();
        handleAnalyze();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [ready, handleAnalyze]);

  const charCount = jdText.length;

  return (
    <div className="flex-1 flex flex-col animate-fade-in">
      {/* Hero */}
      <div className="px-12 pt-14 pb-8">
        <h1 className="heading-display text-[2.5rem] mb-3 leading-tight">
          Prepare for your next{" "}
          <span className="heading-display italic text-gradient-warm">opportunity</span>
        </h1>
        <p className="text-muted-foreground text-[15px] max-w-lg leading-relaxed font-light">
          Paste a job description and select your resume. Four AI agents will analyze the
          fit and prepare you for the interview.
        </p>
      </div>

      {/* Main */}
      <div className="flex-1 flex gap-8 px-12 pb-10 min-h-0">
        {/* Textarea */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.1em]">
              Job Description
            </label>
            {charCount > 0 && (
              <span className="text-[11px] text-muted tabular-nums font-mono">
                {charCount.toLocaleString()} chars
              </span>
            )}
          </div>
          <div className="flex-1 relative group">
            <textarea
              className="absolute inset-0 w-full h-full bg-card border border-card-border rounded-2xl p-6 text-[13.5px] leading-[1.75] resize-none focus-ring transition-all duration-200 placeholder:text-muted/50 group-hover:border-muted/25 font-light"
              placeholder="Paste the full job description here...

Include the role title, responsibilities, required qualifications, and preferred skills for the best analysis."
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="w-[280px] flex flex-col gap-5 shrink-0">
          {/* Session Name */}
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-[0.1em] mb-2">
              Session Name
            </label>
            <input
              type="text"
              placeholder="e.g. Google SWE L5"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="w-full bg-card border border-card-border rounded-xl px-4 py-2.5 text-sm focus-ring transition-all hover:border-muted/25 placeholder:text-muted/50 font-light"
            />
            <p className="text-[10px] text-muted mt-1.5 font-light">Optional — helps organize history</p>
          </div>

          {/* Resume */}
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-[0.1em] mb-2">
              Resume
            </label>
            {loading ? (
              <div className="h-11 rounded-xl animate-shimmer" />
            ) : resumes.length === 0 ? (
              <button
                onClick={() => router.push("/resumes")}
                className="w-full py-8 border border-dashed border-card-border rounded-2xl text-muted-foreground hover:border-primary/30 hover:text-primary transition-all text-sm group"
              >
                <svg className="w-6 h-6 mx-auto mb-2 text-muted group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <span className="font-light text-[13px]">Upload a resume</span>
              </button>
            ) : (
              <div>
                <div className="relative">
                  <select
                    className="w-full bg-card border border-card-border rounded-xl px-4 py-2.5 text-sm focus-ring transition-all hover:border-muted/25 appearance-none cursor-pointer"
                    value={selectedResumeId}
                    onChange={(e) => setSelectedResumeId(e.target.value)}
                  >
                    {resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}{r.is_default ? " (default)" : ""}
                      </option>
                    ))}
                  </select>
                  <svg className="w-4 h-4 text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <button
                  onClick={() => router.push("/resumes")}
                  className="text-[10px] text-muted hover:text-primary transition-colors mt-1.5 font-light"
                >
                  Manage resumes
                </button>
              </div>
            )}
          </div>

          <div className="flex-1" />

          {/* Deliverables */}
          <div className="glass-card rounded-2xl p-5">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-[0.12em] mb-3.5">
              Deliverables
            </p>
            <div className="space-y-2.5">
              {[
                { label: "Skills gap analysis", color: "text-success" },
                { label: "Tailored cover letter", color: "text-primary" },
                { label: "Behavioral prep (STAR)", color: "text-warning" },
                { label: "Technical questions", color: "text-danger" },
                { label: "LeetCode practice set", color: "text-muted-foreground" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2.5">
                  <span className={`w-1 h-1 rounded-full ${item.color.replace("text-", "bg-")}`} />
                  <span className="text-[12px] text-muted-foreground font-light">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={handleAnalyze}
            disabled={!ready}
            className="btn-primary w-full py-3 rounded-xl text-[13px] tracking-wide"
          >
            <span className="flex items-center justify-center gap-2.5">
              Analyze Application
              <span className="flex items-center gap-0.5 opacity-60">
                <span className="kbd">&#8984;</span>
                <span className="kbd">&#9166;</span>
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
