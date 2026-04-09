import { API_BASE_URL } from '@/config';

export interface DictionarySource {
  gloss: string;
  english: string;
  page: number;
  description: string;
  images: string[];
}

export interface AssistantResponse {
  answer: string;
  sources: DictionarySource[];
  used_fallback: boolean;
}

export const fetchAiResponse = async (userInput: string): Promise<AssistantResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userInput }),
    });

    if (!response.ok) {
      return {
        answer: "Connection issue. Please try again.",
        sources: [],
        used_fallback: true
      };
    }

    const data = await response.json();
    return data as AssistantResponse;

  } catch (error) {
    console.error("AI Assistant Error:", error);
    return {
      answer: "Connection issue. Please try again.",
      sources: [],
      used_fallback: true
    };
  }
};
