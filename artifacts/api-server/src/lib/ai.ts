import { GoogleGenAI } from "@google/genai";

const baseUrl = process.env["AI_INTEGRATIONS_GEMINI_BASE_URL"];
const apiKey = process.env["AI_INTEGRATIONS_GEMINI_API_KEY"];
const ollamaUrl = process.env["AI_OLLAMA_BASE_URL"];
const ollamaModel = process.env["AI_OLLAMA_MODEL"] ?? "qwen2.5:7b";

let client: GoogleGenAI | null = null;

function ollamaClient() {
  return {
    models: {
      async generateContent({ model: _m, contents, config }: any) {
        const messages: Array<{ role: string; content: string }> = [];
        if (config?.systemInstruction) {
          messages.push({ role: "system", content: String(config.systemInstruction) });
        }
        for (const c of contents ?? []) {
          const role = c.role === "model" ? "assistant" : c.role === "assistant" ? "assistant" : "user";
          const text = Array.isArray(c.parts) ? c.parts.map((p: any) => p?.text ?? "").join("") : "";
          messages.push({ role, content: text });
        }
        const res = await fetch(`${ollamaUrl}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: ollamaModel,
            messages,
            temperature: config?.temperature ?? 0.6,
            max_tokens: config?.maxOutputTokens ?? 2048,
            stream: false,
          }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`Ollama error ${res.status}: ${body}`);
        }
        const data: any = await res.json();
        return { text: data?.choices?.[0]?.message?.content ?? "" };
      },
    },
  };
}

export function getAiClient(): GoogleGenAI | null {
  if (baseUrl && apiKey) {
    if (!client) {
      client = new GoogleGenAI({
        apiKey,
        httpOptions: { baseUrl, apiVersion: "" },
      });
    }
    return client;
  }
  if (ollamaUrl) return ollamaClient() as unknown as GoogleGenAI;
  return null;
}
