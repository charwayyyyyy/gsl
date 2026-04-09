import { API_BASE_URL } from '@/config';

export const fetchAiResponse = async (userInput: string): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userInput }),
    });

    if (!response.ok) {
      return "Connection issue. Please try again.";
    }

    const data = await response.json();
    
    // In case fallback is triggered
    if (data.fallback) {
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Assistant is temporarily unavailable.";
    }

    // Google Gemini API typical nested structure
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sorry, I couldn’t process that.";

    return text;
  } catch (error) {
    console.error("AI Assistant Error:", error);
    return "Connection issue. Please try again.";
  }
};
