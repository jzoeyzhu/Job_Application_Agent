"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { getSession, type SessionDetail } from "@/lib/api";

interface SkillMatch {
  skill: string;
  status: string;
  evidence: string;
  bridge_suggestion: string;
}

interface BehavioralQ {
  question: string;
  why_they_ask: string;
  resume_story_to_use: string;
  star_talking_points: { situation: string; task: string; action: string; result: string };
}

interface TechnicalQ {
  question: string;
  what_theyre_testing: string;
  ideal_answer_direction: string;
  difficulty: string;
}

interface CodingQ {
  leetcode_number: number;
  title: string;
  difficulty: string;
  url: string;
  why_relevant: string;
}

type Tab = "gap" | "cover" | "behavioral" | "technical" | "coding";

export default function SessionResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [tab, setTab] = useState<Tab>("gap");
  const [expandedQ, setExpandedQ] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getSession(id).then(setSession);
  }, [id]);

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-4 h-4 border-[1.5px] border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session.results || session.status === "failed") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground font-light mb-4 text-sm">
            {session.status === "failed" ? "Analysis failed" : "Analysis still running..."}
          </p>
          <button onClick={() => router.push("/")} className="text-primary text-sm hover:underline font-light">
            Back to home
          </button>
        </div>
      </div>
    );
  }

  const results = session.results as Record<string, Record<string, unknown>>;
  const gap_report = results.gap_report;
  const cover_letter = results.cover_letter;
  const interview_prep = results.interview_prep;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "gap", label: "Gap Analysis", count: (gap_report?.skill_matches as SkillMatch[])?.length },
    { key: "cover", label: "Cover Letter" },
    { key: "behavioral", label: "Behavioral", count: (interview_prep?.behavioral_questions as BehavioralQ[])?.length },
    { key: "technical", label: "Technical", count: (interview_prep?.technical_questions as TechnicalQ[])?.length },
    { key: "coding", label: "LeetCode", count: (interview_prep?.coding_questions as CodingQ[])?.length },
  ];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const skillMatches = (gap_report?.skill_matches as SkillMatch[]) || [];
  const strongCount = skillMatches.filter((m) => m.status === "strong_match").length;
  const adjacentCount = skillMatches.filter((m) => m.status === "adjacent_match").length;
  const gapCount = skillMatches.filter((m) => m.status === "gap").length;
  const totalSkills = skillMatches.length;
  const matchPercent = totalSkills > 0 ? Math.round(((strongCount + adjacentCount * 0.5) / totalSkills) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto p-8 pt-8 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push("/")}
          className="text-[11px] text-muted hover:text-foreground mb-3 flex items-center gap-1.5 font-light transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="heading-display text-3xl mb-1">{session.name}</h1>
        <p className="text-[13px] text-muted font-light">
          {new Date(session.created_at).toLocaleDateString("en-US", {
            month: "long", day: "numeric", year: "numeric",
          })}
        </p>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 mb-8 p-4 rounded-xl bg-card border border-card-border">
        {/* Match score ring */}
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11">
            <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke="var(--accent)" strokeWidth="3" />
              <circle
                cx="22" cy="22" r="18" fill="none"
                stroke={matchPercent >= 70 ? "var(--success)" : matchPercent >= 40 ? "var(--warning)" : "var(--danger)"}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${(matchPercent / 100) * 113} 113`}
                className="transition-all duration-1000"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums">
              {matchPercent}
            </span>
          </div>
          <div>
            <p className="text-[11px] text-muted font-light">Match</p>
            <p className={`text-sm font-semibold ${matchPercent >= 70 ? "text-success" : matchPercent >= 40 ? "text-warning" : "text-danger"}`}>
              {String(gap_report?.overall_match_score || "—")}
            </p>
          </div>
        </div>

        <div className="w-px h-8 bg-card-border" />

        {/* Skill breakdown */}
        <div className="flex gap-5 text-center">
          <div>
            <p className="text-lg font-semibold text-success tabular-nums">{strongCount}</p>
            <p className="text-[10px] text-muted font-light uppercase tracking-wider">Strong</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-warning tabular-nums">{adjacentCount}</p>
            <p className="text-[10px] text-muted font-light uppercase tracking-wider">Adjacent</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-danger tabular-nums">{gapCount}</p>
            <p className="text-[10px] text-muted font-light uppercase tracking-wider">Gap</p>
          </div>
        </div>

        <div className="w-px h-8 bg-card-border" />

        <div className="flex-1" />
      </div>

      {/* Tabs */}
      <div className="flex gap-px mb-6 border-b border-card-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setExpandedQ(null); }}
            className={`px-4 py-2.5 text-[13px] font-medium transition-all relative ${
              tab === t.key
                ? "text-primary"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`ml-1 text-[11px] ${tab === t.key ? "text-primary/50" : "text-muted/60"}`}>
                {t.count}
              </span>
            )}
            {tab === t.key && (
              <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* === Gap Analysis === */}
      {tab === "gap" && gap_report && (
        <div className="stagger">
          <div className="glass-card rounded-2xl p-5 mb-5">
            <p className="text-[13px] leading-relaxed text-muted-foreground font-light">
              {gap_report.summary as string}
            </p>
          </div>

          <div className="space-y-1.5">
            {skillMatches.map((m, i) => {
              const gaugeWidth = m.status === "strong_match" ? 100 : m.status === "adjacent_match" ? 55 : 15;
              const gaugeColor = m.status === "strong_match" ? "bg-success" : m.status === "adjacent_match" ? "bg-warning" : "bg-danger";
              return (
                <div key={i} className="bg-card border border-card-border rounded-xl p-4 hover:border-muted/15 transition-all group">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-medium text-[13px] flex-1">{m.skill}</span>
                    <span className={`chip text-[10px] ${
                      m.status === "strong_match" ? "bg-success-subtle text-success" :
                      m.status === "adjacent_match" ? "bg-warning-subtle text-warning" :
                      "bg-danger-subtle text-danger"
                    }`}>
                      {m.status === "strong_match" ? "Strong" :
                       m.status === "adjacent_match" ? "Adjacent" : "Gap"}
                    </span>
                  </div>
                  {/* Gauge */}
                  <div className="gauge-track mb-2">
                    <div
                      className={`gauge-fill ${gaugeColor}`}
                      style={{ width: `${gaugeWidth}%`, animationDelay: `${i * 60}ms` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground font-light leading-relaxed">{m.evidence}</p>
                  {m.bridge_suggestion && (
                    <p className="text-[11px] text-primary/70 mt-1.5 font-light flex items-start gap-1.5">
                      <svg className="w-3 h-3 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                      </svg>
                      {m.bridge_suggestion}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === Cover Letter === */}
      {tab === "cover" && cover_letter && (
        <div className="animate-fade-in">
          <div className="cover-letter-paper p-8 pl-14">
            <div className="max-w-none whitespace-pre-wrap text-[13.5px] leading-[1.85] font-light text-foreground/85">
              {cover_letter.cover_letter as string}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={() => handleCopy(cover_letter.cover_letter as string)}
              className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${
                copied
                  ? "bg-success/10 text-success border border-success/20"
                  : "btn-primary"
              }`}
            >
              {copied ? (
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Copied
                </span>
              ) : "Copy to Clipboard"}
            </button>
            <span className="text-[11px] text-muted font-mono tabular-nums">
              {cover_letter.word_count as number} words
            </span>
          </div>
        </div>
      )}

      {/* === Behavioral === */}
      {tab === "behavioral" && interview_prep && (
        <div className="space-y-1.5 stagger">
          {(interview_prep.behavioral_questions as BehavioralQ[])?.map((q, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl overflow-hidden hover:border-muted/15 transition-all">
              <button
                onClick={() => setExpandedQ(expandedQ === i ? null : i)}
                className="w-full text-left p-4 flex items-start gap-3 hover:bg-card-hover/50 transition-colors"
              >
                <span className="w-5 h-5 rounded-md bg-accent flex items-center justify-center text-[10px] font-mono font-bold text-muted shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="font-medium text-[13px] flex-1 leading-relaxed">{q.question}</span>
                <svg
                  className={`w-3.5 h-3.5 text-muted shrink-0 mt-1 transition-transform duration-200 ${expandedQ === i ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {expandedQ === i && (
                <div className="px-4 pb-5 ml-8 space-y-3.5 animate-scale-in">
                  <div>
                    <p className="text-[10px] font-medium text-muted uppercase tracking-[0.1em] mb-1">Why they ask</p>
                    <p className="text-[12.5px] text-muted-foreground font-light leading-relaxed">{q.why_they_ask}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-muted uppercase tracking-[0.1em] mb-1">Your story</p>
                    <p className="text-[12.5px] font-light leading-relaxed">{q.resume_story_to_use}</p>
                  </div>
                  {/* STAR cards */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { letter: "S", label: "Situation", text: q.star_talking_points.situation },
                      { letter: "T", label: "Task", text: q.star_talking_points.task },
                      { letter: "A", label: "Action", text: q.star_talking_points.action },
                      { letter: "R", label: "Result", text: q.star_talking_points.result },
                    ].map((s) => (
                      <div key={s.letter} className="bg-background-secondary rounded-lg p-3 border border-card-border">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-[11px] font-bold text-primary font-mono">{s.letter}</span>
                          <span className="text-[10px] text-muted uppercase tracking-wider">{s.label}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground font-light leading-relaxed">{s.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* === Technical === */}
      {tab === "technical" && interview_prep && (
        <div className="space-y-1.5 stagger">
          {(interview_prep.technical_questions as TechnicalQ[])?.map((q, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl overflow-hidden hover:border-muted/15 transition-all">
              <button
                onClick={() => setExpandedQ(expandedQ === i ? null : i)}
                className="w-full text-left p-4 flex items-start gap-3 hover:bg-card-hover/50 transition-colors"
              >
                <span className="w-5 h-5 rounded-md bg-accent flex items-center justify-center text-[10px] font-mono font-bold text-muted shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="font-medium text-[13px] flex-1 leading-relaxed">{q.question}</span>
                <span className={`chip text-[10px] shrink-0 ${
                  q.difficulty === "senior" ? "bg-danger-subtle text-danger" :
                  q.difficulty === "mid" ? "bg-warning-subtle text-warning" :
                  "bg-success-subtle text-success"
                }`}>{q.difficulty}</span>
              </button>
              {expandedQ === i && (
                <div className="px-4 pb-5 ml-8 space-y-3 animate-scale-in">
                  <div>
                    <p className="text-[10px] font-medium text-muted uppercase tracking-[0.1em] mb-1">Testing</p>
                    <p className="text-[12.5px] text-muted-foreground font-light leading-relaxed">{q.what_theyre_testing}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-muted uppercase tracking-[0.1em] mb-1">Answer direction</p>
                    <p className="text-[12.5px] font-light leading-relaxed">{q.ideal_answer_direction}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* === LeetCode === */}
      {tab === "coding" && interview_prep && (
        <div className="space-y-1.5 stagger">
          {(interview_prep.coding_questions as CodingQ[])?.map((q, i) => (
            <a
              key={i}
              href={q.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-card border border-card-border rounded-xl p-4 hover:border-primary/20 hover:bg-card-hover/30 transition-all group"
            >
              <div className="flex items-center gap-3 mb-1.5">
                <span className="text-[13px] font-mono text-muted font-medium">#{q.leetcode_number}</span>
                <span className="font-medium text-[13px] group-hover:text-primary transition-colors">
                  {q.title}
                </span>
                <span className={`ml-auto chip text-[10px] ${
                  q.difficulty === "Hard" ? "bg-danger-subtle text-danger" :
                  q.difficulty === "Medium" ? "bg-warning-subtle text-warning" :
                  "bg-success-subtle text-success"
                }`}>{q.difficulty}</span>
                <svg className="w-3 h-3 text-muted opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>
              <p className="text-[11px] text-muted-foreground font-light leading-relaxed pl-0">{q.why_relevant}</p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
