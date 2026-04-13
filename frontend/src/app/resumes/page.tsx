"use client";

import { useState, useEffect, useRef } from "react";
import {
  listResumes,
  uploadResume,
  setDefaultResume,
  deleteResume,
  type ResumeMetadata,
} from "@/lib/api";

export default function ResumesPage() {
  const [resumes, setResumes] = useState<ResumeMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () =>
    listResumes().then((data) => {
      setResumes(data);
      setLoading(false);
    });

  useEffect(() => { refresh(); }, []);

  const handleUpload = async (file?: File) => {
    const f = file || fileRef.current?.files?.[0];
    if (!f) return;

    const uploadName = name.trim() || f.name.replace(/\.pdf$/i, "").replace(/[_-]/g, " ");

    setUploading(true);
    try {
      await uploadResume(f, uploadName);
      setName("");
      if (fileRef.current) fileRef.current.value = "";
      await refresh();
    } catch (e) {
      alert("Upload failed: " + (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.toLowerCase().endsWith(".pdf")) {
      handleUpload(file);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full p-8 pt-14 animate-fade-in">
      <div className="mb-10">
        <h1 className="heading-display text-3xl mb-2">Resumes</h1>
        <p className="text-sm text-muted-foreground font-light">
          Upload and manage your resumes. Set a default for quick access.
        </p>
      </div>

      {/* Upload area */}
      <div
        className={`rounded-2xl p-8 mb-10 text-center transition-all duration-200 border ${
          dragOver
            ? "border-primary bg-primary/5 scale-[1.005]"
            : "border-dashed border-card-border hover:border-muted/40"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {uploading ? (
          <div className="py-6 space-y-4">
            <div className="w-12 h-12 mx-auto rounded-xl bg-primary/10 flex items-center justify-center">
              <div className="w-5 h-5 border-[1.5px] border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <div>
              <p className="text-sm font-medium">Processing resume</p>
              <p className="text-xs text-muted-foreground font-light mt-1">Claude is reading your PDF...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 mx-auto rounded-xl bg-accent flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="text-sm font-medium mb-1">Drop a PDF here or click to browse</p>
            <p className="text-xs text-muted mb-5 font-light">PDF files only</p>
            <div className="flex gap-2 max-w-sm mx-auto">
              <input
                type="text"
                placeholder="Resume name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 bg-card border border-card-border rounded-xl px-3.5 py-2.5 text-sm focus-ring transition-all placeholder:text-muted/60 font-light"
              />
              <label className="btn-primary px-5 py-2.5 rounded-xl text-sm cursor-pointer">
                Upload
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={() => handleUpload()}
                />
              </label>
            </div>
          </>
        )}
      </div>

      {/* Resume list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-[72px] rounded-xl animate-shimmer" />
          ))}
        </div>
      ) : resumes.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-accent flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">No resumes yet</p>
          <p className="text-xs text-muted mt-1 font-light">Upload one above to get started</p>
        </div>
      ) : (
        <div className="space-y-2 stagger">
          {resumes.map((r) => (
            <div
              key={r.id}
              className={`rounded-xl p-4 flex items-center gap-4 transition-all group border ${
                r.is_default
                  ? "bg-primary/5 border-primary/15"
                  : "bg-card border-card-border hover:border-muted/30"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                r.is_default ? "bg-primary/10 text-primary" : "bg-accent text-muted"
              }`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{r.name}</p>
                  {r.is_default && (
                    <span className="chip bg-primary/10 text-primary">Default</span>
                  )}
                </div>
                <p className="text-xs text-muted truncate mt-0.5 font-light">{r.filename}</p>
              </div>

              <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {!r.is_default && (
                  <button
                    onClick={() => setDefaultResume(r.id).then(refresh)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-card-border text-muted-foreground hover:border-primary/30 hover:text-primary transition-all font-medium"
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => {
                    if (confirm("Delete this resume?")) deleteResume(r.id).then(refresh);
                  }}
                  className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger-subtle transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
