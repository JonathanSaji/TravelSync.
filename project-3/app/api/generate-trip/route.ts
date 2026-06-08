import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface GenerateTripBody {
  location?: unknown;
  days?: unknown;
  ideas?: unknown;
  plan?: unknown;
}

interface PlanInput {
  name: string;
  dates: string;
  group: string;
  budget: string;
}

function toTrimmedString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function toTripDays(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 3;
  return Math.min(14, Math.max(1, Math.round(value)));
}

function normalizeBudgetLabel(rawBudget: string): string {
  const b = rawBudget.toLowerCase();
  if (b.includes('lux')) return 'luxury';
  if (b.includes('budg')) return 'budget';
  return 'standard';
}

function parsePlan(input: unknown): PlanInput {
  const raw = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  return {
    name: toTrimmedString(raw.name, 'My Trip'),
    dates: toTrimmedString(raw.dates, 'Not specified'),
    group: toTrimmedString(raw.group, 'Not specified'),
    budget: normalizeBudgetLabel(toTrimmedString(raw.budget, 'standard')),
  };
}

function buildPromptText(body: GenerateTripBody): { text: string; tripName: string } {
  const location = toTrimmedString(body.location, 'your destination');
  const days = toTripDays(body.days);
  const ideasText = toTrimmedString(body.ideas, '(No sandbox ideas provided.)').slice(0, 12000);
  const plan = parsePlan(body.plan);

  const text = [
    'TRAVEL ITINERARY INPUT',
    '',
    'TRIP BASICS',
    `- Name: ${plan.name}`,
    `- Location: ${location}`,
    `- Duration (days): ${days}`,
    `- Dates: ${plan.dates}`,
    `- Friends / Group details: ${plan.group}`,
    `- Pricing point: ${plan.budget} (budget | standard | luxury)`,
    '',
    'SANDBOX IDEAS',
    'Each line may include priority level, time commitment, and dealbreakers.',
    ideasText,
  ].join('\n');

  return { text, tripName: plan.name };
}

function extractResponseText(response: OpenAI.Responses.Response): string {
  const direct = (response.output_text ?? '').trim();
  if (direct) return direct;

  const chunks: string[] = [];
  for (const outputItem of response.output ?? []) {
    if (outputItem.type !== 'message') continue;
    for (const content of outputItem.content ?? []) {
      if (content.type === 'output_text') {
        chunks.push(content.text);
      }
    }
  }

  return chunks.join('\n').trim();
}

function buildFallbackTrip(body: GenerateTripBody, promptData: { text: string; tripName: string }) {
  const location = toTrimmedString(body.location, 'your destination');
  const days = toTripDays(body.days);
  const ideaLines = toTrimmedString(body.ideas, '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^\d+\./.test(line))
    .map(line => line.replace(/^\d+\.\s*/, '').replace(/\s+\[.*$/, '').trim())
    .filter(Boolean)
    .slice(0, 8);

  const fallbackTripName = promptData.tripName || `Trip to ${location}`;

  const itinerary = Array.from({ length: days }, (_, index) => {
    const dayNumber = index + 1;
    const focus = ideaLines[index % Math.max(ideaLines.length, 1)] || `Explore ${location}`;
    return {
      day: dayNumber,
      theme: dayNumber === 1 ? `Arrival and set-up in ${location}` : `Day ${dayNumber} around ${location}`,
      activities: [
        {
          time: '9:00 AM',
          name: `Coffee and plan the day`,
          description: `Start slow and map out the best spots around ${location}.`,
          tags: ['easy-start', 'fallback'],
        },
        {
          time: '12:00 PM',
          name: focus,
          description: `A flexible stop based on your sandbox ideas and trip context.`,
          tags: ['idea', 'fallback'],
        },
        {
          time: '4:00 PM',
          name: `Explore more of ${location}`,
          description: `Leave space for photos, food, and anything the group wants to add.`,
          tags: ['explore', 'fallback'],
        },
      ],
    }
  });

  return {
    tripName: fallbackTripName,
    harmonyPlan: {
      note: 'Fallback itinerary generated locally because the AI service was unavailable.',
      conflicts: [],
    },
    itinerary,
  };
}

export async function POST(req: Request) {
  const body = (await req.json()) as GenerateTripBody;

  try {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is missing on the server.' }, { status: 500 });
    }

    const promptData = buildPromptText(body);

    const response = await openai.responses.create({
      model: 'o3-mini',
      input: [
        {
          role: 'system',
          content:
            'You are an itinerary generator. Return only valid JSON with no markdown. Output schema: {"tripName": string, "harmonyPlan": {"note": string, "conflicts": [{"title": string, "sides": string[], "why": string, "resolution": {"strategy": "both"|"split"|"new_idea", "plan": string}, "splitSuggestion"?: {"groupA": string, "groupB": string}}]}, "itinerary": [{"day": number, "theme": string, "activities": [{"time": string, "name": string, "description": string, "tags": string[]}]}]}. Use real named places, geographically coherent sequencing, and include harmonyPlan even when there are no conflicts. Sandbox lines may contain tags: [custom_event: yes], [must_include: yes|no], [event_location: ...], [event_link: ...], [event_time: ...], [event_time_mode: fixed|flexible]. Rules: 1) Any idea tagged [must_include: yes] must appear in itinerary. 2) If [event_time_mode: fixed], schedule at the provided time (or nearest practical same-block wording). 3) If [event_time_mode: flexible], place it wherever fits best. 4) If [event_link] exists, incorporate details implied by that event in naming/description.',
        },
        {
          role: 'user',
          content: promptData.text,
        },
      ],
    });

    const rawText = extractResponseText(response);
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson) as Record<string, unknown>;

    if (typeof parsed.tripName !== 'string' || !parsed.tripName.trim()) {
      parsed.tripName = promptData.tripName;
    }

    if (!Array.isArray(parsed.itinerary)) {
      throw new Error('Model response missing itinerary array.');
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('AI Generation Error:', error);
    try {
      const promptData = buildPromptText(body);
      return NextResponse.json(buildFallbackTrip(body, promptData));
    } catch (fallbackError) {
      console.error('Fallback generation error:', fallbackError);
      return NextResponse.json(
        { error: 'Failed to generate trip. Please try again.' },
        { status: 500 },
      );
    }
  }
}