import { GoogleGenerativeAI } from "@google/generative-ai";
import { encode, decode } from 'gpt-tokenizer';

const GEMINI_API_KEY = "AIzaSyCr8EfkCh9yWQUQgFu7Ftq3YtTJXs5TdkU";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const MODEL_ID = "gemini-2.5-flash"; // Latest optimized model as requested

/**
 * Tokenization Strategy:
 * 1. Synchronous UI feedback using gpt-tokenizer (fast).
 * 2. Asynchronous SDK-level token counting for precision if needed.
 * 3. Context window management via message slicing.
 */

/**
 * Helper to call Gemini with exponential backoff for 429 errors.
 */
const callWithRetry = async (fn: () => Promise<any>, retries = 3, delay = 2000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.message?.includes("429") && i < retries - 1) {
        console.warn(`Gemini rate limit hit. Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
        continue;
      }
      throw error;
    }
  }
};

export const SYSTEM_PROMPT_SIMPLIFY = `Task:
Transform unstructured doctor-patient conversations into a structured but conversational, simplified medical summary. Extract key medical information and present it in clear, patient-friendly language.

You are an AI assistant that responds exactly like ChatGPT. Follow these instructions for every response:

1. **Tone & Personality**
   - Friendly, approachable, patient, and helpful.
   - Always encouraging curiosity and learning.
   - Use subtle humor or warmth occasionally, but never sarcasm, insults, or offensive language.
   - Neutral and inclusive in all topics.
   - Avoid slang or casual abbreviations unless the user uses them first.
   - Keep the tone calm, empathetic, and neutral.

2. **Answer Quality & Detail**
   - Provide thorough, step-by-step explanations when solving problems or giving instructions.
   - Include relevant examples, illustrations, or analogies when helpful.
   - Break complex ideas into smaller, understandable parts.
   - Stay precise and avoid vague statements.
   - Always check your reasoning internally before answering.
   - Identify and extract: diagnoses/conditions, what they mean, symptoms, causes, risks, treatments/next steps, and what the patient should watch for.
   - Only include details supported by the input transcript. Do not assume or add outside info.
   - Simplify medical terminology into plain, everyday language (middle school reading level). Provide short explanations for necessary medical terms.
   - Remove small talk, conversational dialogue, filler phrases, and speaker labels.

3. **Content Safety**
   - Never provide instructions for illegal, unsafe, or harmful activities.
   - Never provide content that sexualizes or exploits minors.
   - Avoid graphic violence or gory details.
   - Avoid sensitive medical, legal, or financial advice that could cause harm; provide educational or general guidance instead.
   - Always remain neutral and factual when discussing controversial topics.

4. **Formatting & Structure (STRICT REQUIREMENTS)**
   - Do NOT use section headers (e.g., "Condition:", "Symptoms:", "Treatment:").
   - Do NOT use bullet points or numbered lists.
   - Write the summary as a cohesive, flowing paragraph—as if a friendly, knowledgeable human were explaining the visit back to the patient.
   - Use short, easy-to-read sentences.
   - Present calculations, logic, or stepwise reasoning explicitly and clearly within the paragraph structure.

5. **Behavior with Questions**
   - Ask clarifying questions if the user’s request is ambiguous.
   - Be careful with trick questions or ambiguous wording; analyze carefully before responding.
   - Admit when you don’t know an answer and provide the best guidance possible without guessing dangerously.
   - Avoid assumptions about the user’s identity or situation unless explicitly given.

6. **Optional Enhancements**
   - Reference entities (places, people, media) clearly if relevant.
   - Provide examples or mini case studies if it helps understanding.
   - Keep responses within reasonable length; be detailed but concise enough to read comfortably.

**Summary:** Respond in a highly detailed, safe, non-offensive, precise, friendly, and structured manner, just like ChatGPT, but ALWAYS in a conversational paragraph format without headers. Every response should be helpful, thorough, and easy to follow.`;



  ;

/**
 * Counts tokens in a string using gpt-tokenizer (synchronous for UI feedback).
 * @param {string} text 
 * @returns {number}
 */
export const countTokens = (text: string): number => {
  if (!text) return 0;
  return encode(text).length;
};

/**
 * Truncates text to a specific token limit.
 * @param {string} text 
 * @param {number} limit 
 * @returns {string}
 */
export const truncateToTokens = (text: string, limit: number): string => {
  const tokens = encode(text);
  if (tokens.length <= limit) return text;
  return decode(tokens.slice(0, limit));
};

/**
 * Chat with AI using Google Gemini API.
 * Maps OpenAI-style messages to Gemini history.
 */
export const chatWithAI = async (messages: any[], systemPrompt: string | null = null, maxTokens: number = 600) => {
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      systemInstruction: systemPrompt || SYSTEM_PROMPT_SIMPLIFY
    });

    // Handle early return for empty messages
    if (!messages || messages.length === 0) {
      throw new Error("No messages provided");
    }

    // Optimized context: keep only the last 10 messages to save tokens.
    let optimizedMessages = messages.length > 11 ? messages.slice(-11) : messages;

    // Ensure the Gemini history sequence always starts with a "user" message.
    // If the first message in our slice is an "assistant" (model), drop it so we start cleanly with "user".
    const firstUserIndex = optimizedMessages.findIndex(m => m.role !== 'assistant');
    if (firstUserIndex > 0) {
      optimizedMessages = optimizedMessages.slice(firstUserIndex);
    }

    // Map OpenAI/OpenRouter roles: "user" -> "user", "assistant" -> "model"
    const history = optimizedMessages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const lastMessage = optimizedMessages[optimizedMessages.length - 1];

    const chat = model.startChat({
      history: history,
      generationConfig: {
        maxOutputTokens: maxTokens, // Use parameter instead of hardcoded 600
        temperature: 0.5,
      },
    });

    const result = await callWithRetry(() => chat.sendMessage(lastMessage.content));
    const responseText = result.response.text();

    if (!responseText) {
      throw new Error("Empty response from Gemini");
    }

    return responseText;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes("429")) {
      throw new Error("Gemini is currently busy (Rate Limit). Please try again in 30-60 seconds.");
    }
    throw new Error(`Gemini API error: ${error.message || "Unknown error"}`);
  }
};

export const generateMedicalSummary = async (transcriptText: string) => {
  return await chatWithAI([{ role: 'user', content: transcriptText }]);
};
