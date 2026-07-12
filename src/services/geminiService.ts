
import { AIAnalysisResult, CATEGORIES } from "../types";

// FIX: AI service now calls backend endpoint instead of using client-side API_KEY
// The backend handles all Gemini API calls at /api/ai/parse and /api/ai/market-data

export const parseInputToTransaction = async (
  input: string | { data: string; mimeType: string },
  isMedia: boolean = false
): Promise<AIAnalysisResult | null> => {
  try {
    const response = await fetch('/api/ai/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ input, isMedia })
    });

    if (!response.ok) {
      console.error('AI parse error:', response.statusText);
      return null;
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Frontend AI Error:", error);
    return null;
  }
};

// FIX: Updated to use backend endpoint instead of direct API calls
export const parseStatementToTransactions = async (
  fileData: { data: string; mimeType: string }
): Promise<AIAnalysisResult[]> => {
  try {
    const response = await fetch('/api/ai/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ input: fileData, isMedia: true })
    });

    if (!response.ok) {
      console.error('Statement parse error:', response.statusText);
      return [];
    }

    const result = await response.json();
    return result ? [result] : [];
  } catch (error) {
    console.error("Statement Parsing Error:", error);
    return [];
  }
};
