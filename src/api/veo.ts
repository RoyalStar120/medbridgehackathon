import { chatWithAI } from './openrouter';

const VEO_API_KEY = 'AIzaSyCr8EfkCh9yWQUQgFu7Ftq3YtTJXs5TdkU';
const VEO_MODEL = 'veo-3.1-generate-preview';

export interface GenerativeVideoResult {
  prompt: string;
  region: 'head' | 'chest' | 'abdomen' | 'arm' | 'leg' | 'full' | 'heart' | 'lungs' | 'liver' | 'brain' | 'stomach' | 'kidneys';
  explanation?: {
    condition: string;
    bodyPart: string;
    whatsHappening: string;
    whyItMatters: string;
    clinicalObservation?: string;
    visualPrompt?: string;
    whatHelps: string;
  };
  videoUrl?: string;
}

// ── Step 1: Generate Veo Prompt, Region & Explanation from Transcript ───────
export async function generateVideoAnalysis(transcript: string): Promise<GenerativeVideoResult> {
  const systemPrompt = `You are MedBridge 3D Analytics, a clinical AI specializing in localized anatomical explanations for patient education.

You will be given a patient consultation transcript.
Your job is to read it and output a JSON object containing:
1. "prompt": A 1-2 sentence description for a 3D environmental render.
2. "region": The primary anatomical region to zoom the camera into.
3. "explanation": A localized, easy-to-understand explanation of the specific condition discussed.

### EXPLANATION GENERATION RULES (CRITICAL)
- Generate a short, clear explanation focused on a specific body part.
- The output must be concise, visual, and easy to understand (maximum 60-80 words total).
- Replace medical terms with simple explanations.
- Prioritize quick understanding over completeness. Keep tone calm and neutral.
- Do NOT add new or unsupported medical information.

Include an "explanation" object with these exact keys:
- "condition": The short name of the diagnosis or issue.
- "bodyPart": The specific body part affected.
- "whatsHappening": 1-2 short sentences explaining what is physically happening.
- "whyItMatters": 1-2 short sentences explaining why this causes the symptoms or why it is important.
- "clinicalObservation": A deeper, more technical observation of the pathology (e.g. "Plaque buildup in the left anterior descending artery").
- "visualPrompt": A high-detail, artistic prompt for generating a clinical medical image (e.g. "Hyper-realistic medical illustration of arterial plaque clogging a heart vessel, golden light, high contrast, cinematic").
- "whatHelps": 1-2 short sentences on treatments or next steps.

### OUTPUT JSON FORMAT
Respond in this EXACT JSON format (no markdown code blocks, just raw JSON). The "region" MUST be strictly one of: "head", "chest", "abdomen", "arm", "leg", "full", "heart", "lungs", "liver", "brain", "stomach", "kidneys".

{
  "prompt": "A hyper-realistic 3D medical animation of the heart, showing irregular beating of the atria.",
  "region": "chest",
  "explanation": {
    "condition": "Atrial fibrillation",
    "bodyPart": "Heart",
    "whatsHappening": "The upper part of your heart is beating irregularly instead of pumping normally.",
    "whyItMatters": "This can cause blood to pool and form clots, increasing the risk of stroke.",
    "clinicalObservation": "Irregular electrical signals in the atria causing quivering rather than coordinated contraction.",
    "visualPrompt": "Detailed medical 3D render of a human heart with glowing electrical pathways showing chaotic, flickering signals in the upper chambers, dark background, cinematic teal lighting.",
    "whatHelps": "Medications or procedures can help control the rhythm and reduce the risk of clots."
  }
}`;

    let rawJSON = "";
    try {
      // Pass a high token limit (1500) because a detailed JSON medical summary easily exceeds the default 600 limit
      rawJSON = await chatWithAI([{ role: 'user', content: transcript }], systemPrompt, 1500);
      
      const jsonMatch = rawJSON.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`No JSON found. Raw Output: ${rawJSON.substring(0, 100)}...`);
      }
      
      const result = JSON.parse(jsonMatch[0]);
    
    return {
      prompt: result.prompt || 'A 3D medical visualization of human anatomy.',
      region: result.region || 'full',
      explanation: result.explanation,
      videoUrl: "https://v.ftcdn.net/06/15/80/74/700_F_615807466_WlkBst7o8W8X2P88WvN8f7XfB9B8bX8z_ST.mp4"
    };
  } catch (error) {
    console.error('Failed to generate 3D analysis via Gemini:', error);
    return {
      prompt: 'A 3D medical visualization of human anatomy.',
      region: 'full',
      explanation: {
         condition: "Error Generating Analysis",
         bodyPart: "System Error",
         whatsHappening: `The AI encountered a critical error: ${error instanceof Error ? error.message : String(error)}`,
         whyItMatters: "This prevents the dynamic zooming and clinical summary generation.",
         whatHelps: "Try generating the model again or check the console for details."
      },
      videoUrl: "https://v.ftcdn.net/06/15/80/74/700_F_615807466_WlkBst7o8W8X2P88WvN8f7XfB9B8bX8z_ST.mp4"
    };
  }
}
