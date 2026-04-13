const API = "http://localhost:8000";

// --- Types ---

export interface ResumeMetadata {
  id: string;
  name: string;
  filename: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResumeDetail extends ResumeMetadata {
  content: string;
}

export interface SessionMetadata {
  id: string;
  name: string;
  resume_id: string;
  created_at: string;
  status: "running" | "completed" | "failed";
}

export interface SessionDetail extends SessionMetadata {
  jd_text: string;
  results: Record<string, unknown> | null;
}

// --- Resume API ---

export async function uploadResume(file: File, name: string): Promise<ResumeMetadata> {
  const form = new FormData();
  form.append("file", file);
  form.append("name", name);
  const res = await fetch(`${API}/api/resumes/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listResumes(): Promise<ResumeMetadata[]> {
  const res = await fetch(`${API}/api/resumes`);
  return res.json();
}

export async function setDefaultResume(id: string): Promise<ResumeMetadata> {
  const res = await fetch(`${API}/api/resumes/${id}/default`, { method: "PUT" });
  return res.json();
}

export async function deleteResume(id: string): Promise<void> {
  await fetch(`${API}/api/resumes/${id}`, { method: "DELETE" });
}

// --- Session API ---

export async function listSessions(): Promise<SessionMetadata[]> {
  const res = await fetch(`${API}/api/sessions`);
  return res.json();
}

export async function getSession(id: string): Promise<SessionDetail> {
  const res = await fetch(`${API}/api/sessions/${id}`);
  return res.json();
}

export async function deleteSession(id: string): Promise<void> {
  await fetch(`${API}/api/sessions/${id}`, { method: "DELETE" });
}

// --- Analyze (SSE) ---

export function analyzeSSE(
  jdText: string,
  resumeId: string,
  sessionName: string,
  onEvent: (event: string, data: Record<string, unknown>) => void,
  onDone?: () => void,
) {
  const body = JSON.stringify({
    jd_text: jdText,
    resume_id: resumeId,
    session_name: sessionName,
  });

  fetch(`${API}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  }).then(async (res) => {
    if (!res.ok || !res.body) {
      onEvent("error", { message: await res.text() });
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let currentEvent = "";
      for (const line of lines) {
        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          const data = line.slice(5).trim();
          if (data && currentEvent) {
            try {
              onEvent(currentEvent, JSON.parse(data));
            } catch {
              onEvent(currentEvent, { raw: data });
            }
          }
          currentEvent = "";
        }
      }
    }
    onDone?.();
  });
}
