import { GoogleGenerativeAI, SchemaType } from "https://esm.run/@google/generative-ai";

const DEFAULT_TARGET_MIN = 400;
const DEFAULT_TARGET_MAX = 500;
const MAX_PROMPT_SECTION_LENGTH = 1200;
const DEFAULT_PROMPT_SETTINGS = {
  instructions: [
    "역할: 너는 대학원 세미나 소감문 작성 보조자다.",
    "목표: 아래 입력(OCR, 공지문)을 근거로 title/speaker/summary/reflection을 작성한다.",
    "사용자 작성 규칙:",
    "1) title/speaker는 입력 원문 표기를 최대한 보존한다.",
    "2) summary는 발표 핵심(문제의식, 방법/데이터, 결과/의의)을 사실 중심으로 요약한다.",
    "3) reflection은 1인칭 관점의 학습 포인트와 한계/후속 과제를 균형 있게 쓴다.",
    "4) 동일 표현 반복, 과도한 수식어, 홍보성 문구를 피한다."
  ].join("\n")
};

const OPENAI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    speaker: { type: "string" },
    summary: { type: "string" },
    reflection: { type: "string" }
  },
  required: ["title", "speaker", "summary", "reflection"],
  additionalProperties: false
};

const GEMINI_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    speaker: { type: SchemaType.STRING },
    summary: { type: SchemaType.STRING },
    reflection: { type: SchemaType.STRING }
  },
  required: ["title", "speaker", "summary", "reflection"]
};

function nowMs() {
  return performance.now();
}

function normalizeSourceText(text) {
  return String(text || "")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !/^[A-Z0-9@#\[\]\-_=+\\/|!.,:;'"`~() ]{15,}$/.test(line))
    .join("\n");
}

function normalizeEditableSection(value, fallback, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return fallback;
  }
  if (normalized.length > MAX_PROMPT_SECTION_LENGTH) {
    throw new Error(`${label} is too long (max ${MAX_PROMPT_SECTION_LENGTH} chars).`);
  }
  return normalized;
}

function getPromptMetrics({ ocrText, noticeText, promptSettings, includeOutputFormat }) {
  const cleanOCR = normalizeSourceText(ocrText);
  const cleanNotice = normalizeSourceText(noticeText);
  const instructions = normalizeEditableSection(promptSettings?.instructions, DEFAULT_PROMPT_SETTINGS.instructions, "Instructions");
  const prompt = buildPrompt(ocrText, noticeText, promptSettings, { includeOutputFormat });
  return {
    cleanOCR,
    cleanNotice,
    instructions,
    prompt
  };
}

function resolveLengthRule(promptSettings = {}) {
  const targetMin = Number(promptSettings?.targetMin ?? DEFAULT_TARGET_MIN);
  const targetMax = Number(promptSettings?.targetMax ?? DEFAULT_TARGET_MAX);

  if (!Number.isInteger(targetMin) || !Number.isInteger(targetMax)) {
    throw new Error("Target Min/Max must be integers.");
  }
  if (targetMin < 50 || targetMax > 2000 || targetMin > targetMax) {
    throw new Error("Invalid target range. Use 50 <= min <= max <= 2000.");
  }
  return `${targetMin}~${targetMax}자`;
}

function buildPrompt(ocrText, noticeText, promptSettings = {}, options = {}) {
  const cleanOCR = normalizeSourceText(ocrText);
  const cleanNotice = normalizeSourceText(noticeText);
  const instructions = normalizeEditableSection(promptSettings.instructions, DEFAULT_PROMPT_SETTINGS.instructions, "Instructions");
  const lengthRuleText = resolveLengthRule(promptSettings);
  const includeOutputFormat = options.includeOutputFormat ?? true;

  const outputFormatBlock = includeOutputFormat
    ? `
출력 형식:
반드시 JSON 객체만 출력한다. 코드블록/설명문/주석 금지.

스키마:
{
  "title": "세미나 제목 (입력에서 추출)",
  "speaker": "연사 이름 (입력에서 추출)",
  "summary": "한국어 ${lengthRuleText}, 한 문단",
  "reflection": "한국어 ${lengthRuleText}, 한 문단"
}
`
    : "";

  return `
사용자 지시:
${instructions}

${outputFormatBlock}

고정 규칙:
1) 입력(OCR/NOTICE)에 없는 사실(소속, 수치, 성과)을 추가하지 않는다.
2) summary/reflection 모두 길이 ${lengthRuleText}를 반드시 지킨다.
3) title/speaker/summary/reflection 네 필드를 모두 채운다.

입력:
[OCR]
"""
${cleanOCR}
"""

[NOTICE]
"""
${cleanNotice}
"""
`.trim();
}

function normalizeModelText(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function parseModelJson(rawText) {
  const normalized = normalizeModelText(rawText);
  let parsed;
  try {
    parsed = JSON.parse(normalized);
  } catch (error) {
    throw new Error(`Failed to parse model response as JSON: ${error.message}`);
  }

  return {
    title: String(parsed?.title || "").trim(),
    speaker: String(parsed?.speaker || "").trim(),
    summary: String(parsed?.summary || "").trim(),
    reflection: String(parsed?.reflection || "").trim()
  };
}

function normalizeApiKeyForHeader(apiKey, providerLabel) {
  const raw = String(apiKey ?? "");
  const normalized = raw
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();

  if (!normalized) {
    throw new Error(`${providerLabel} API key is empty.`);
  }
  if (/[^\x00-\xFF]/.test(normalized)) {
    throw new Error(
      `${providerLabel} API key contains unsupported non-ASCII characters. Please re-enter the key manually.`
    );
  }
  if (/\s/.test(normalized)) {
    throw new Error(
      `${providerLabel} API key contains whitespace characters. Remove spaces/newlines and try again.`
    );
  }
  return normalized;
}

function formatOpenAIHttpError(status, payload, fallbackText = "") {
  const error = payload?.error;
  const code = String(error?.code || "").trim();
  const type = String(error?.type || "").trim();
  const message = String(error?.message || "").trim();

  if (code === "invalid_api_key") {
    return "OpenAI API key is invalid. Please verify the key and try again.";
  }

  if (status === 401) {
    return "OpenAI authentication failed (HTTP 401). Check your API key and project access.";
  }

  if (status === 429) {
    return "OpenAI rate limit exceeded (HTTP 429). Please retry shortly.";
  }

  const details = [code, type].filter(Boolean).join("/");
  if (details && message) {
    return `OpenAI request failed (HTTP ${status}, ${details}): ${message}`;
  }
  if (message) {
    return `OpenAI request failed (HTTP ${status}): ${message}`;
  }
  if (details) {
    return `OpenAI request failed (HTTP ${status}, ${details}).`;
  }
  if (fallbackText) {
    return `OpenAI request failed (HTTP ${status}): ${fallbackText}`;
  }
  return `OpenAI request failed (HTTP ${status}).`;
}

async function callGemini({ apiKey, model, ocrText, noticeText, promptSettings }) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const selectedModel = genAI.getGenerativeModel({ model });
  const { cleanOCR, cleanNotice, instructions, prompt } = getPromptMetrics({
    ocrText,
    noticeText,
    promptSettings,
    includeOutputFormat: true
  });

  const t0 = nowMs();
  console.log(
    `[ai][gemini] start model=${model} promptLen=${prompt.length} ocrLen=${cleanOCR.length} noticeLen=${cleanNotice.length} instructionsLen=${instructions.length}`
  );
  try {
    const firstResult = await selectedModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA
      }
    });
    return parseModelJson(firstResult.response.text());
  } catch (error) {
    console.error(`[ai][gemini] error model=${model}`, error);
    throw error;
  } finally {
    console.log(
      `[ai][gemini] done model=${model} ${(nowMs() - t0).toFixed(0)}ms promptLen=${prompt.length}`
    );
  }
}

async function callOpenAI({ apiKey, model, ocrText, noticeText, promptSettings }) {
  const normalizedApiKey = normalizeApiKeyForHeader(apiKey, "OpenAI");
  const { cleanOCR, cleanNotice, instructions, prompt } = getPromptMetrics({
    ocrText,
    noticeText,
    promptSettings,
    includeOutputFormat: false
  });
  const initialMessages = [{ role: "user", content: prompt }];

  const requestBody = {
    model,
    reasoning_effort: "minimal",
    messages: initialMessages,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "seminar_output",
        strict: true,
        schema: OPENAI_RESPONSE_SCHEMA
      }
    }
  };
  const requestBytes = JSON.stringify(requestBody).length;

  const t0 = nowMs();
  console.log(
    `[ai][openai] start model=${model} promptLen=${prompt.length} ocrLen=${cleanOCR.length} noticeLen=${cleanNotice.length} instructionsLen=${instructions.length} requestBytes=${requestBytes}`
  );
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${normalizedApiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const rawBody = await response.text();
      let payload = null;
      try {
        payload = rawBody ? JSON.parse(rawBody) : null;
      } catch {
        payload = null;
      }
      throw new Error(formatOpenAIHttpError(response.status, payload, rawBody));
    }

    const payload = await response.json();
    const text = payload?.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error("OpenAI response missing choices[0].message.content");
    }
    return parseModelJson(text);
  } catch (error) {
    console.error(`[ai][openai] error model=${model}`, error);
    throw error;
  } finally {
    console.log(
      `[ai][openai] done model=${model} ${(nowMs() - t0).toFixed(0)}ms promptLen=${prompt.length} requestBytes=${requestBytes}`
    );
  }
}

export async function generateSeminarFields({ provider, model, apiKey, ocrText, noticeText, promptSettings }) {
  if (provider === "gemini") {
    return callGemini({ apiKey, model, ocrText, noticeText, promptSettings });
  }
  if (provider === "openai") {
    return callOpenAI({ apiKey, model, ocrText, noticeText, promptSettings });
  }
  throw new Error(`Unsupported provider: ${provider}`);
}

export function getDefaultPromptSettings() {
  return { ...DEFAULT_PROMPT_SETTINGS };
}
