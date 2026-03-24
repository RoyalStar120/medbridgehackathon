declare module './api/assemblyai' {
  export function transcribeFile(file: File, onProgress?: (msg: string) => void): Promise<{ text: string }>;
}

declare module './api/openrouter' {
  export function chatWithAI(messages: { role: 'user' | 'assistant', content: string }[]): Promise<string>;
}
