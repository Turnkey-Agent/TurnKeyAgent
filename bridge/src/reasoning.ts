import { GoogleGenAI } from "@google/genai";
import { config } from "./config.js";

const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

interface Quote {
  vendor_id: string;
  vendor_name?: string;
  amount: number;
  eta_days: number;
  notes?: string;
  rating?: number;
  total_jobs?: number;
}

interface Recommendation {
  selected_vendor_id: string;
  reasoning: string;
  summary: string;
}

/**
 * Analyze vendor quotes and recommend the best option.
 * Uses Gemini 3.1 Flash for reasoning (text-based, not audio).
 */
export async function analyzeQuotes(
  quotes: Quote[],
  incidentDescription: string,
  maintenanceHistory?: string
): Promise<Recommendation> {
  const prompt = `You are an AI property management advisor. Analyze these vendor quotes for a maintenance emergency and recommend the best option.

## Incident
${incidentDescription}

${maintenanceHistory ? `## Relevant Maintenance History\n${maintenanceHistory}` : ""}

## Quotes Received
${quotes
  .map(
    (q, i) => `
### Vendor ${i + 1}: ${q.vendor_name || q.vendor_id}
- Cost: $${q.amount}
- ETA: ${q.eta_days} day(s)
- Rating: ${q.rating || "N/A"}/5
- Previous jobs at this property: ${q.total_jobs || "N/A"}
- Notes: ${q.notes || "None"}
`
  )
  .join("\n")}

## Instructions
Compare the quotes on: price, speed, vendor reliability, and familiarity with the property.
Return your response as JSON:
{
  "selected_vendor_id": "the vendor_id of your recommendation",
  "reasoning": "2-3 sentences explaining why this vendor is the best choice",
  "summary": "One sentence summary for the landlord phone call"
}`;

  const response = await ai.models.generateContent({
    model: config.geminiReasoningModel,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  const text = response.text ?? "";
  try {
    return JSON.parse(text) as Recommendation;
  } catch {
    // Fallback: pick cheapest vendor
    const cheapest = quotes.reduce((a, b) => (a.amount < b.amount ? a : b));
    return {
      selected_vendor_id: cheapest.vendor_id,
      reasoning: `Selected based on lowest price ($${cheapest.amount}) with ${cheapest.eta_days} day ETA.`,
      summary: `I recommend the vendor at $${cheapest.amount} — cheapest and available in ${cheapest.eta_days} days.`,
    };
  }
}

/**
 * Assess urgency of a maintenance issue.
 */
export async function assessUrgency(
  description: string
): Promise<{ urgency: string; reasoning: string }> {
  const response = await ai.models.generateContent({
    model: config.geminiReasoningModel,
    contents: `Assess the urgency of this maintenance issue on a scale of: low, medium, high, emergency.

Issue: ${description}

Return JSON: { "urgency": "low|medium|high|emergency", "reasoning": "brief explanation" }`,
    config: {
      responseMimeType: "application/json",
    },
  });

  const text = response.text ?? "";
  try {
    return JSON.parse(text);
  } catch {
    return { urgency: "medium", reasoning: "Unable to assess — defaulting to medium" };
  }
}
