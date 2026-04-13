"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { analyzeSSE } from "@/lib/api";

type AgentStatus = "pending" | "running" | "done";

const AGENTS = [
  { key: "gap_analyzer", label: "Gap Analyzer", desc: "Mapping resume to each requirement" },
  { key: "cover_letter_writer", label: "Cover Letter", desc: "Writing a tailored, genuine letter" },
  { key: "interview_coach", label: "Interview Coach", desc: "Generating questions & coding set" },
];

export default function AnalyzePage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Record<string, AgentStatus>>({
    gap_analyzer: "pending",
    cover_letter_writer: "pending",
    interview_coach: "pending",
  });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pipelineDone, setPipelineDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const raw = sessionStorage.getItem("analyzeInput");
    if (!raw) { router.push("/"); return; }

    // Start timer
    timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);

    const { jdText, resumeId, sessionName } = JSON.parse(raw);

    analyzeSSE(jdText, resumeId, sessionName, (event, data) => {
      if (event === "error") {
        setError(String(data.message || "Unknown error"));
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }
      if (event === "session_created") {
        setSessionId(data.session_id as string);
      } else if (event === "agent_start") {
        setAgents((prev) => ({ ...prev, [data.agent as string]: "running" }));
      } else if (event === "agent_done") {
        setAgents((prev) => ({ ...prev, [data.agent as string]: "done" }));
      } else if (event === "pipeline_done") {
        setPipelineDone(true);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    });

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [router]);

  const doneCount = Object.values(agents).filter((s) => s === "done").length;
  const progress = (doneCount / 3) * 100;
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="flex-1 flex items-center justify-center p-8 animate-fade-in">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-10">
          <div className={`w-14 h-14 mx-auto mb-5 rounded-2xl flex items-center justify-center transition-all duration-700 ${
            pipelineDone
              ? "bg-success/10 border border-success/20 animate-confetti"
              : "bg-primary/10 border border-primary/15 animate-pulse-glow"
          }`}>
            {pipelineDone ? (
              <svg className="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path className="animate-check" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            )}
          </div>
          <h1 className="heading-display text-2xl mb-1.5">
            {pipelineDone ? "Analysis complete" : "Analyzing application"}
          </h1>
          <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground font-light">
            <span>{pipelineDone ? "3 of 3" : `${doneCount} of 3`} agents</span>
            <span className="w-px h-3 bg-card-border" />
            <span className="font-mono text-xs tabular-nums text-muted">
              {minutes > 0 ? `${minutes}m ` : ""}{seconds}s
            </span>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="gauge-track">
            <div
              className={`gauge-fill transition-all duration-1000 ease-out ${pipelineDone ? "bg-success" : "bg-primary"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="bg-danger-subtle border border-danger/15 rounded-xl p-4 mb-6 text-[13px] text-danger flex items-start gap-3 font-light">
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}

        {/* Agent steps with connector */}
        <div className="relative">
          {/* Vertical connector line */}
          <div className="absolute left-[23px] top-[20px] bottom-[20px] w-px bg-card-border" />

          <div className="space-y-1">
            {AGENTS.map(({ key, label, desc }, i) => {
              const status = agents[key];
              const isParallel = i >= 2;
              return (
                <div key={key} className="relative">
                  {/* Parallel indicator */}
                  {i === 1 && (
                    <div className="ml-12 mb-1.5 mt-1">
                      <span className="text-[10px] text-muted font-mono uppercase tracking-wider">parallel</span>
                    </div>
                  )}
                  <div
                    className={`rounded-xl py-3 px-4 flex items-center gap-3.5 transition-all duration-500 ${
                      status === "running"
                        ? "bg-primary/5"
                        : status === "done"
                          ? ""
                          : "opacity-30"
                    } ${isParallel && i === 3 ? "" : ""}`}
                  >
                    {/* Node */}
                    <div className={`relative z-10 w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 transition-all duration-500 ring-2 ${
                      status === "done"
                        ? "bg-success ring-success/20"
                        : status === "running"
                          ? "bg-primary ring-primary/20"
                          : "bg-accent ring-card-border"
                    }`}>
                      {status === "done" && (
                        <svg className="w-2.5 h-2.5 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {status === "running" && (
                        <div className="w-1.5 h-1.5 bg-background rounded-full" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-medium ${status === "done" ? "text-foreground" : status === "running" ? "text-primary" : "text-muted"}`}>
                        {label}
                      </p>
                      <p className="text-[11px] text-muted font-light truncate">{desc}</p>
                    </div>

                    {status === "running" && (
                      <div className="w-3.5 h-3.5 border-[1.5px] border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        {pipelineDone && sessionId && (
          <button
            onClick={() => router.push(`/sessions/${sessionId}`)}
            className="btn-primary mt-10 w-full py-3 rounded-xl text-[13px] tracking-wide animate-fade-in"
          >
            View Results
          </button>
        )}
      </div>
    </div>
  );
}
