import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = "AIzaSyCr8EfkCh9yWQUQgFu7Ftq3YtTJXs5TdkU";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const chatWithGemini = async (messages: ChatMessage[], systemPrompt: string = ""): Promise<string> => {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: systemPrompt
  });

  // Convert messages to Google's format
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const lastMessage = messages[messages.length - 1].content;

  const chat = model.startChat({
    history: history,
  });

  const result = await chat.sendMessage(lastMessage);
  const response = await result.response;
  return response.text();
};
