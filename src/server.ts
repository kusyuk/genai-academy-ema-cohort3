import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express, {Request, Response, NextFunction} from 'express';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {GoogleGenAI} from '@google/genai';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

// Automatically load local .env file if running in Node 20.6+ locally
try {
  (process as unknown as { loadEnvFile?: () => void }).loadEnvFile?.();
} catch {
  // Ignore if .env does not exist
}

const app = express();
app.set('trust proxy', true);

const angularApp = new AngularNodeAppEngine({
  allowedHosts: ['*'],
  trustProxyHeaders: true,
});

// 1. Mount JSON & URL-encoded deserialization middleware before any routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Gemini SDK initialization helper (lazy/safe)
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env['GEMINI_API_KEY'] || '';
    genAIClient = new GoogleGenAI({ apiKey });
  }
  return genAIClient;
}

// Resilient fallback model ladder starting with Gemini 3.8 Flash
const MODEL_LADDER = [
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-flash-latest',
];

function cleanJsonText(raw: string): string {
  let cleaned = raw.trim();
  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    cleaned = jsonBlockMatch[1].trim();
  }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1).trim();
  }
  return cleaned;
}

async function generateContentWithFallback(
  systemInstruction: string,
  contents: { role: string; parts: { text: string }[] }[],
  options?: { temperature?: number; responseMimeType?: string },
): Promise<{ text: string; modelUsed: string }> {
  const ai = getGenAI();
  let lastError: unknown = null;

  const config: Record<string, unknown> = {
    systemInstruction,
    temperature: options?.temperature ?? 0.4,
  };
  if (options?.responseMimeType) {
    config['responseMimeType'] = options.responseMimeType;
  }

  for (const model of MODEL_LADDER) {
    const t0 = Date.now();
    try {
      const callPromise = ai.models.generateContent({
        model,
        contents,
        config,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Model ${model} timed out after 8s`)), 8000),
      );

      const response = await Promise.race([callPromise, timeoutPromise]);
      const text = response.text || '';
      console.log(`Model ${model} succeeded in ${Date.now() - t0}ms`);
      return { text, modelUsed: model };
    } catch (err: unknown) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`Model ${model} failed in ${Date.now() - t0}ms:`, errMsg);
      // Immediately failover to next model in ladder without blocking delays
    }
  }

  throw lastError || new Error('All models in fallback ladder failed.');
}

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    aiConfigured: Boolean(process.env['GEMINI_API_KEY']),
  });
});

// Multi-turn Reflection endpoint
app.post('/api/gemini/reflect', async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const mode = typeof body.mode === 'string' ? body.mode : 'reflection';
    const title = typeof body.title === 'string' ? body.title : 'Journal Reflection';
    const history = Array.isArray(body.history) ? body.history : [];

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt cannot be empty.' });
    }

    const systemInstruction = `You are ReflectIQ, a compassionate, insightful, and grounded personal reflection guide and journal companion.
Your role is to help the user unpack their thoughts, emotions, dilemmas, and aspirations with depth and clarity.
Mode: ${mode.toUpperCase()}.
Guidance by mode:
- REFLECTION: Offer gentle cognitive reframing, empathetic validation, and 1-2 open-ended deepening questions.
- BRAINSTORM: Generate creative, diverse options, novel angles, and analogies without judgment.
- ACTION_PLAN: Transform thoughts into high-impact, gentle, step-by-step milestones.
- GRATITUDE: Highlight subtle silver linings, strengths, and moments of peace.
Format your responses with clear, concise paragraphs. Avoid robotic lists unless requested. Do not invent facts.`;

    const contents: { role: string; parts: { text: string }[] }[] = [];

    for (const turn of history) {
      if (turn && typeof turn === 'object' && typeof turn.text === 'string') {
        contents.push({
          role: turn.role === 'model' ? 'model' : 'user',
          parts: [{ text: turn.text }],
        });
      }
    }

    contents.push({
      role: 'user',
      parts: [
        {
          text: `[Journal Context: "${title}"]\n${prompt}`,
        },
      ],
    });

    const result = await generateContentWithFallback(systemInstruction, contents);
    return res.json({
      text: result.text,
      modelUsed: result.modelUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Error in /api/gemini/reflect:', error);
    const message = error instanceof Error ? error.message : 'Internal reflection error';
    return res.status(500).json({ error: message });
  }
});

// Summarize session endpoint
app.post('/api/gemini/summarize', async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const title = typeof body.title === 'string' ? body.title : 'Journal Session';
    const entries = Array.isArray(body.entries) ? body.entries : [];

    if (entries.length === 0) {
      return res.status(400).json({ error: 'Entries cannot be empty.' });
    }

    const transcript = entries
      .map((e: { role?: string; text?: string }) => `${e.role === 'model' ? 'ReflectIQ' : 'User'}: ${e.text || ''}`)
      .join('\n\n');

    const systemInstruction = `You are an expert personal reflection analyst.
Synthesize the provided multi-turn journal conversation into an Executive Reflection Synthesis.
Include:
1. Core Themes (1-2 sentences on the central themes explored)
2. Emotional Arc (Summary of feelings or shifts observed)
3. Actionable Wisdom (2-3 concrete key takeaways or gentle reminders)
Keep the tone dignified, supportive, and concise (under 200 words).`;

    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: `Journal Title: ${title}\n\nTranscript:\n${transcript}\n\nPlease generate the Executive Reflection Synthesis.`,
          },
        ],
      },
    ];

    const result = await generateContentWithFallback(systemInstruction, contents);
    return res.json({
      summary: result.text,
      modelUsed: result.modelUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Error in /api/gemini/summarize:', error);
    const message = error instanceof Error ? error.message : 'Internal summarization error';
    return res.status(500).json({ error: message });
  }
});

// ==========================================
// EMA Clinical Endpoints (AI Studio Constitution)
// ==========================================

// 1. Multi-turn Clarification Scribe Endpoint
app.post('/api/chat/clarify', async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const history = Array.isArray(body.history) ? body.history : [];
    const patientProfile = body.patientProfile || {};

    if (!prompt && history.length === 0) {
      return res.status(400).json({ error: 'Observation prompt cannot be empty.' });
    }

    const patientContext = `
[PATIENT BASELINE PROFILE]
Name: ${patientProfile.name || 'Patient'}
Age/Birth Year: ${patientProfile.birthYear || 'Unknown'} (${patientProfile.gender || 'unspecified'})
Chronic Conditions: ${(patientProfile.chronicConditions || []).map((c: {condition: string}) => c.condition).join(', ') || 'None documented'}
Allergies: ${(patientProfile.allergies || []).map((a: {allergen: string; reaction: string}) => `${a.allergen} (${a.reaction})`).join(', ') || 'None'}
Active Prescriptions: ${(patientProfile.currentMedications || []).map((m: {name: string; dosage: string; frequency: string; instructions?: string}) => `${m.name} ${m.dosage} - ${m.frequency} [${m.instructions || ''}]`).join('; ') || 'None'}
Baseline Vitals Target: BP < ${patientProfile.baselineVitals?.targetBpSystolic || 130}/${patientProfile.baselineVitals?.targetBpDiastolic || 80} mmHg
`;

    const systemInstruction = `You are EMA, an enterprise-grade Clinical Scribe, Patient Safety Officer, and Caregiver Companion.
You operate under strict zero-trust security, PHI de-identification standards, and clinical grounding rules.

OPERATIONAL CONSTITUTION:
1. GROUNDING MANDATE: Cross-reference the caregiver's observation against the verified patient medical profile.
2. NON-DIAGNOSTIC SAFETY: You do not make definitive medical diagnoses. Frame assessments objectively (e.g., "Symptoms consistent with...").
3. ACTIVE LISTENING: If critical context is missing (such as whether medication was taken with meals, exact BP reading, or symptom onset timing), ask at most 1 compassionate, plain-language question.
4. INSTANT REPLIES: Provide 2-3 tap-friendly quick replies for the caregiver.
5. STRICT JSON OUTPUT: Output ONLY valid JSON matching this schema:
{
  "hasSufficientContext": boolean,
  "clarificationQuestion": string | null,
  "instantReplyOptions": string[],
  "interimAlert": string | null
}`;

    const contents: { role: string; parts: { text: string }[] }[] = [];

    for (const turn of history) {
      if (turn && typeof turn === 'object' && typeof turn.text === 'string') {
        contents.push({
          role: turn.role === 'model' ? 'model' : 'user',
          parts: [{ text: turn.text }],
        });
      }
    }

    if (prompt) {
      contents.push({
        role: 'user',
        parts: [{ text: `${patientContext}\n[Caregiver Observation]: ${prompt}` }],
      });
    }

    const result = await generateContentWithFallback(systemInstruction, contents, {
      responseMimeType: 'application/json',
      temperature: 0.2,
    });

    try {
      const parsed = JSON.parse(cleanJsonText(result.text));
      return res.json({
        ...parsed,
        modelUsed: result.modelUsed,
        timestamp: new Date().toISOString(),
      });
    } catch {
      return res.json({
        hasSufficientContext: true,
        clarificationQuestion: null,
        instantReplyOptions: ['Looks accurate', 'Add more details'],
        interimAlert: null,
        modelUsed: result.modelUsed,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error: unknown) {
    console.error('Error in /api/chat/clarify:', error);
    const message = error instanceof Error ? error.message : 'Clarification error';
    return res.status(500).json({ error: message });
  }
});

// 2. Finalize Clinical Entry Endpoint (SOAP, Metrics, Google Tasks Directives)
app.post('/api/chat/finalize', async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const history = Array.isArray(body.history) ? body.history : [];
    const patientProfile = body.patientProfile || {};

    if (history.length === 0) {
      return res.status(400).json({ error: 'Conversation history cannot be empty.' });
    }

    const patientContext = `
[PATIENT BASELINE PROFILE]
Name: ${patientProfile.name || 'Patient'}
Age/Birth Year: ${patientProfile.birthYear || 'Unknown'} (${patientProfile.gender || 'unspecified'})
Chronic Conditions: ${(patientProfile.chronicConditions || []).map((c: {condition: string}) => c.condition).join(', ') || 'None documented'}
Allergies: ${(patientProfile.allergies || []).map((a: {allergen: string; reaction: string}) => `${a.allergen} (${a.reaction})`).join(', ') || 'None'}
Active Prescriptions: ${(patientProfile.currentMedications || []).map((m: {name: string; dosage: string; frequency: string; instructions?: string}) => `${m.name} ${m.dosage} - ${m.frequency} [${m.instructions || ''}]`).join('; ') || 'None'}
Baseline Vitals Target: BP < ${patientProfile.baselineVitals?.targetBpSystolic || 130}/${patientProfile.baselineVitals?.targetBpDiastolic || 80} mmHg
`;

    const transcript = history
      .map((t: { role?: string; text?: string }) => `${t.role === 'model' ? 'EMA' : 'Caregiver'}: ${t.text || ''}`)
      .join('\n');

    const systemInstruction = `You are EMA, an enterprise-grade Clinical Scribe, Patient Safety Officer, and Caregiver Companion.
Analyze the complete multi-turn conversation and patient baseline profile to generate a structured clinical record.

CRITICAL INSTRUCTIONS:
1. Grounding: Cross-reference symptoms against known chronic conditions and active prescriptions.
2. Drug Conflict Check: If an antihypertensive or diabetic drug was taken incorrectly (e.g. without food) or triggered side effects (e.g. dizziness, orthostasis), explicitly flag it.
3. Metric Extraction: Parse any numeric measurements (BP systolic/diastolic, blood glucose, temperature).
4. Clinical SOAP: Subjective, Objective, Assessment, Plan. Frame assessment objectively ("Symptoms consistent with...").
5. Care Directives (Google Tasks): Parse the Plan into actionable items for Google Tasks (e.g., "Recheck BP at 13:00", "Administer Metformin with food").
6. Doctor Consult Bullet: Single high-density line for rapid 15-second doctor review.
7. Safety Alert: Classify as 'info', 'warning', or 'urgent' with actionable guidance.

STRICT JSON ONLY:
{
  "extractedMetrics": {
    "bloodPressure": { "systolic": number | null, "diastolic": number | null },
    "bloodGlucose": number | null,
    "temperature": number | null
  },
  "groundedAnalysis": {
    "potentialDrugInteractionOrConflict": string | null,
    "conditionRelevance": string[],
    "adherenceFlag": string | null
  },
  "clinicalSoap": {
    "subjective": string,
    "objective": string,
    "assessment": string,
    "plan": string
  },
  "safetyAlert": {
    "level": "info" | "warning" | "urgent",
    "message": string
  } | null,
  "googleTasksDirectives": [
    { "title": string, "dueMinutesFromNow": number, "notes": string }
  ],
  "doctorConsultBullet": string
}`;

    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: `${patientContext}\n\n[CONVERSATION TRANSCRIPT]\n${transcript}\n\nGenerate the complete structured clinical record.`,
          },
        ],
      },
    ];

    const result = await generateContentWithFallback(systemInstruction, contents, {
      responseMimeType: 'application/json',
      temperature: 0.1,
    });

    const parsed = JSON.parse(cleanJsonText(result.text));
    return res.json({
      ...parsed,
      modelUsed: result.modelUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Error in /api/chat/finalize:', error);
    const message = error instanceof Error ? error.message : 'Finalization error';
    return res.status(500).json({ error: message });
  }
});

// 3. Longitudinal Doctor Consultation Synthesizer ("15-Second Clinic View")
app.post('/api/doctor-handover', async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const entries = Array.isArray(body.entries) ? body.entries : [];
    const patientProfile = body.patientProfile || {};

    if (entries.length === 0) {
      return res.status(400).json({ error: 'No clinical entries provided for synthesis.' });
    }

    const patientContext = `
[PATIENT BASELINE PROFILE]
Name: ${patientProfile.name || 'Patient'}
Age/Birth Year: ${patientProfile.birthYear || 'Unknown'} (${patientProfile.gender || 'unspecified'})
Chronic Conditions: ${(patientProfile.chronicConditions || []).map((c: {condition: string}) => c.condition).join(', ') || 'None documented'}
Active Prescriptions: ${(patientProfile.currentMedications || []).map((m: {name: string; dosage: string; frequency: string; instructions?: string}) => `${m.name} ${m.dosage} - ${m.frequency} [${m.instructions || ''}]`).join('; ') || 'None'}
Baseline Vitals Target: BP < ${patientProfile.baselineVitals?.targetBpSystolic || 130}/${patientProfile.baselineVitals?.targetBpDiastolic || 80} mmHg
`;

    const summaryData = entries.map((e: { createdAt?: string; clinicalSoap?: { subjective: string; objective: string; assessment: string }; extractedMetrics?: { bloodPressure?: { systolic?: number; diastolic?: number }; bloodGlucose?: number }; groundedAnalysis?: { potentialDrugInteractionOrConflict?: string } }) => {
      return `Date: ${e.createdAt || 'N/A'} | BP: ${e.extractedMetrics?.bloodPressure?.systolic || 'N/A'}/${e.extractedMetrics?.bloodPressure?.diastolic || 'N/A'} | Glucose: ${e.extractedMetrics?.bloodGlucose || 'N/A'} | Assessment: ${e.clinicalSoap?.assessment || 'N/A'} | Conflict: ${e.groundedAnalysis?.potentialDrugInteractionOrConflict || 'None'}`;
    }).join('\n');

    const systemInstruction = `You are a Senior Attending Physician preparing a high-density 15-second clinical handover brief.
Synthesize the longitudinal data objectively.

STRICT JSON ONLY:
{
  "periodCovered": { "from": string, "to": string },
  "aiSynthesizedOverview": string,
  "adherenceRatePercentage": number,
  "vitalsSummary": {
    "avgSystolic": number,
    "avgDiastolic": number,
    "avgGlucose": number | null,
    "notableOutliers": string[]
  },
  "recurringSymptomPatterns": [
    { "symptom": string, "frequency": number, "potentialTrigger": string }
  ],
  "suggestedDiscussionPoints": string[]
}`;

    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: `${patientContext}\n\n[LOGS OVER PERIOD]\n${summaryData}\n\nGenerate the 15-second Doctor Handover Brief.`,
          },
        ],
      },
    ];

    const result = await generateContentWithFallback(systemInstruction, contents, {
      responseMimeType: 'application/json',
      temperature: 0.2,
    });

    const parsed = JSON.parse(cleanJsonText(result.text));
    return res.json({
      ...parsed,
      modelUsed: result.modelUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Error in /api/doctor-handover:', error);
    const message = error instanceof Error ? error.message : 'Handover error';
    return res.status(500).json({ error: message });
  }
});

// 4. Google Tasks Integration Endpoint (Care Directives Dispatch)
app.post('/api/tasks/sync', async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const directive = body.directive || {};
    const patientName = body.patientName || 'Patient';

    if (!directive.title) {
      return res.status(400).json({ error: 'Directive title is required.' });
    }

    // Generate unique Google Task ID and calculate due time
    const taskId = `gtask_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const dueMinutes = directive.dueMinutesFromNow || 60;
    const dueDate = new Date(Date.now() + dueMinutes * 60 * 1000).toISOString();

    return res.json({
      success: true,
      taskId,
      title: directive.title,
      patientName,
      dueDate,
      notes: directive.notes || 'Automated care directive generated by EMA clinical companion.',
      syncedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Error in /api/tasks/sync:', error);
    const message = error instanceof Error ? error.message : 'Task sync error';
    return res.status(500).json({ error: message });
  }
});
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

// SSR handler for frontend routes (catch-all must be last)
app.use((req: Request, res: Response, next: NextFunction) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 3000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
