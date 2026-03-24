import jsPDF from 'jspdf';
import { chatWithAI } from './openrouter';

const BRAND_TEAL = [0, 109, 119] as const;
const DARK = [20, 29, 31] as const;
const MUTED = [62, 73, 74] as const;
const LIGHT_BG = [242, 251, 254] as const;
const SECTION_HEADER_BG = [0, 83, 91] as const;

function addWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

// Ask the AI to produce a structured clinical report about this specific transcript.
async function generateClinicalReport(transcriptText: string): Promise<{
  clinicalSummary: string;
  diagnosisIndicators: string;
  recommendedActions: string;
  followUp: string;
  additionalContext: string;
}> {
  const prompt = `You are a highly experienced clinical analyst and medical writer.
  
Analyze the following patient consultation transcript and produce a structured medical report.
Use your additional clinical knowledge to ENRICH the findings — don't just repeat the text.
Provide real medical context, explain why findings matter, and suggest evidence-based next steps.

TRANSCRIPT:
"""
${transcriptText}
"""

Respond in this EXACT JSON format (no markdown, just raw JSON):
{
  "clinicalSummary": "2-3 sentence narrative summary of the consultation in clinical language",
  "diagnosisIndicators": "List the key symptoms, signs, or mentions that suggest a diagnosis. Include clinical reasoning.",
  "recommendedActions": "Evidence-based clinical recommendations relevant to what was discussed (medications, tests, referrals, lifestyle changes). Use your medical knowledge.",
  "followUp": "Specific follow-up recommendations with suggested timelines",
  "additionalContext": "Add relevant clinical context, epidemiology, or patient education the clinician should be aware of based on what you found in the transcript"
}`;

  try {
    const rawResponse = await chatWithAI(
      [{ role: 'user', content: prompt }],
      'You are a senior clinical analyst. Produce structured, enriched medical reports. Always respond in valid JSON.'
    );
    // Strip any markdown code fences
    const clean = rawResponse.replace(/```json|```/gi, '').trim();
    const jsonStart = clean.indexOf('{');
    const jsonEnd = clean.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON found');
    return JSON.parse(clean.slice(jsonStart, jsonEnd + 1));
  } catch {
    return {
      clinicalSummary: 'Clinical summary could not be generated automatically.',
      diagnosisIndicators: 'Manual review of transcript required.',
      recommendedActions: 'Please consult the consultation transcript and apply standard clinical protocols.',
      followUp: 'Schedule a follow-up as clinically appropriate.',
      additionalContext: '',
    };
  }
}

export async function exportMedicalRecordPDF(options: {
  transcription: { title: string; text: string; created_at: string };
  clinicianEmail: string;
  onProgress?: (msg: string) => void;
}) {
  const { transcription, clinicianEmail, onProgress } = options;

  onProgress?.('Generating AI clinical report…');
  const report = await generateClinicalReport(transcription.text);
  onProgress?.('Building PDF…');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ── Header Bar ──────────────────────────────────────────────────────────────
  doc.setFillColor(...BRAND_TEAL);
  doc.rect(0, 0, pageW, 32, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('MedBridge', margin, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Clinical Intelligence Platform', margin, 23);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('AI-ENRICHED MEDICAL RECORD', pageW - margin, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('CONFIDENTIAL — For Clinical Use Only', pageW - margin, 20, { align: 'right' });
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - margin, 26, { align: 'right' });

  y = 44;

  // ── Record Identity Block ───────────────────────────────────────────────────
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(margin, y, contentW, 28, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...DARK);
  doc.text(transcription.title, margin + 6, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`Clinician: ${clinicianEmail}`, margin + 6, y + 18);
  doc.text(
    `Date: ${new Date(transcription.created_at).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })}  ·  ${new Date(transcription.created_at).toLocaleTimeString()}`,
    margin + 6,
    y + 24
  );

  y += 36;

  // ── Utilities ───────────────────────────────────────────────────────────────
  const checkNewPage = (spaceNeeded = 24) => {
    if (y + spaceNeeded > pageH - 20) {
      doc.addPage();
      y = margin;
    }
  };

  const addSection = (title: string) => {
    checkNewPage(14);
    doc.setFillColor(...SECTION_HEADER_BG);
    doc.rect(margin, y, contentW, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), margin + 4, y + 5.5);
    y += 12;
    doc.setTextColor(...DARK);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
  };

  const addBody = (text: string) => {
    checkNewPage(16);
    y = addWrappedText(doc, text, margin, y, contentW, 5.5);
    y += 8;
  };

  // ── 1. Clinical Summary ─────────────────────────────────────────────────────
  addSection('Clinical Summary');
  addBody(report.clinicalSummary);

  // ── 2. Diagnosis Indicators ─────────────────────────────────────────────────
  addSection('Diagnosis Indicators & Clinical Reasoning');
  addBody(report.diagnosisIndicators);

  // ── 3. Recommended Actions ──────────────────────────────────────────────────
  addSection('Recommended Clinical Actions');
  addBody(report.recommendedActions);

  // ── 4. Follow-Up Plan ───────────────────────────────────────────────────────
  addSection('Follow-Up Plan');
  addBody(report.followUp);

  // ── 5. Additional Context ───────────────────────────────────────────────────
  if (report.additionalContext) {
    addSection('Additional Clinical Context & Patient Education');
    addBody(report.additionalContext);
  }

  // ── 6. Source Transcript (collapsed/appended) ───────────────────────────────
  checkNewPage(20);
  doc.addPage();
  y = margin;
  addSection('Source Consultation Transcript (Verbatim)');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  y = addWrappedText(doc, transcription.text, margin, y, contentW, 4.8);

  // ── Footer on every page ────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(240, 240, 240);
    doc.rect(0, pageH - 11, pageW, 11, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      'Auto-generated by MedBridge AI · AI content may not replace professional medical judgment · Handle with strict confidentiality.',
      margin,
      pageH - 5
    );
    doc.text(`Page ${i} of ${totalPages}`, pageW - margin, pageH - 5, { align: 'right' });
  }

  const safeTitle = transcription.title.replace(/\s+/g, '_');
  doc.save(`MedBridge_Record_${safeTitle}_${Date.now()}.pdf`);
  onProgress?.('Done');
}
