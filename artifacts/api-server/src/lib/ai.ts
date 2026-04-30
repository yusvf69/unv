import { GoogleGenAI } from "@google/genai";

const baseUrl = process.env["AI_INTEGRATIONS_GEMINI_BASE_URL"];
const apiKey = process.env["AI_INTEGRATIONS_GEMINI_API_KEY"];

let client: GoogleGenAI | null = null;

export function getAiClient(): GoogleGenAI | null {
  if (!baseUrl || !apiKey) return null;
  if (!client) {
    client = new GoogleGenAI({
      apiKey,
      httpOptions: { baseUrl, apiVersion: "" },
    });
  }
  return client;
}
