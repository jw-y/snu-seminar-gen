import { Document, Packer, Paragraph, Table, TableRow, TableCell, AlignmentType, WidthType, HeightRule } from "https://cdn.jsdelivr.net/npm/docx@9.5.0/+esm";
import { generateSeminarFields, getDefaultPromptSettings } from "./ai.js";

let latestOCR = "";
let latestNotice = "";
const PERSISTED_FIELDS = [
  "filename",
  "name",
  "studentId",
  "title",
  "speaker",
  "summary",
  "reflection",
  "ai_provider",
  "ai_model",
  "ai_prompt_instructions",
  "ai_target_min",
  "ai_target_max"
];
const PROVIDER_MODELS = {
  gemini: ["gemini-2.5-flash", "gemini-2.5-pro"],
  openai: ["gpt-5-mini", "gpt-5"]
};

// Word count utilities
function countUnits(text) {
  const korean = (text.match(/[ㄱ-ㅎㅏ-ㅣ가-힣]/g) || []).length;
  const english = (text.match(/\b[a-zA-Z]+\b/g) || []).length;
  return korean + english;
}

function updateCount(textareaId, countId) {
  const text = document.getElementById(textareaId).value;
  const total = countUnits(text);
  document.getElementById(countId).textContent = `Word Count: ${total}`;
}

function setStatus(targetId, type, message) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.className = "status";
  if (!message) {
    target.textContent = "";
    return;
  }
  target.classList.add(type);
  target.textContent = message;
}

["summary", "reflection"].forEach(id => {
  document.getElementById(id).addEventListener("input", () =>
    updateCount(id, `${id}-count`)
  );
});

async function loadLatestNews() {
  try {
    const response = await fetch("latest_news.html", { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} while loading latest_news.html`);
    }

    const htmlText = await response.text();
    document.getElementById("latest").innerHTML = htmlText;

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");

    const ocrDiv = doc.querySelector('div[style*="white-space: pre-wrap"]');
    latestOCR = ocrDiv?.textContent.trim() || "";

    const noticeContainer = doc.querySelector(".page-container-content");
    const paragraphs = noticeContainer?.querySelectorAll("p") || [];
    latestNotice = Array.from(paragraphs).map(p => p.textContent.trim()).join("\n");
    setStatus("ai-status", "info", "최신 세미나 데이터를 불러왔습니다.");
  } catch (error) {
    latestOCR = "";
    latestNotice = "";
    console.error("Failed to load latest seminar data:", error);
    setStatus("ai-status", "error", "최신 세미나 데이터를 불러오지 못했습니다.");
  }
}

// Restore localStorage on load
document.addEventListener("DOMContentLoaded", () => {
  PERSISTED_FIELDS.forEach(field => {
    const storedValue = localStorage.getItem(field);
    const element = document.getElementById(field);
    if (storedValue && element) {
      if (field === "ai_model" || field === "ai_provider") {
        return;
      }
      document.getElementById(field).value = storedValue;
    }
  });
  ["summary", "reflection"].forEach(id => {
    updateCount(id, `${id}-count`);
  });

  const providerSelect = document.getElementById("ai_provider");
  const modelSelect = document.getElementById("ai_model");
  const promptInstructionsInput = document.getElementById("ai_prompt_instructions");
  const targetMinInput = document.getElementById("ai_target_min");
  const targetMaxInput = document.getElementById("ai_target_max");
  const resetPromptSettingsButton = document.getElementById("resetPromptSettings");
  const defaultPromptSettings = getDefaultPromptSettings();
  const initialProvider = localStorage.getItem("ai_provider") || "gemini";
  const initialModel = localStorage.getItem("ai_model") || "";
  const initialInstructions = localStorage.getItem("ai_prompt_instructions") || defaultPromptSettings.instructions;
  const initialTargetMin = localStorage.getItem("ai_target_min") || "400";
  const initialTargetMax = localStorage.getItem("ai_target_max") || "500";
  providerSelect.value = initialProvider;
  syncModelOptions(initialProvider, initialModel);
  promptInstructionsInput.value = initialInstructions;
  targetMinInput.value = initialTargetMin;
  targetMaxInput.value = initialTargetMax;

  providerSelect.addEventListener("change", () => {
    syncModelOptions(providerSelect.value);
    localStorage.setItem("ai_provider", providerSelect.value);
    localStorage.setItem("ai_model", modelSelect.value);
  });

  modelSelect.addEventListener("change", () => {
    localStorage.setItem("ai_model", modelSelect.value);
  });

  promptInstructionsInput.addEventListener("input", () => {
    localStorage.setItem("ai_prompt_instructions", promptInstructionsInput.value);
  });

  targetMinInput.addEventListener("input", () => {
    localStorage.setItem("ai_target_min", targetMinInput.value);
  });

  targetMaxInput.addEventListener("input", () => {
    localStorage.setItem("ai_target_max", targetMaxInput.value);
  });

  resetPromptSettingsButton.addEventListener("click", () => {
    const defaults = getDefaultPromptSettings();
    promptInstructionsInput.value = defaults.instructions;
    localStorage.setItem("ai_prompt_instructions", defaults.instructions);
    targetMinInput.value = "400";
    targetMaxInput.value = "500";
    localStorage.setItem("ai_target_min", "400");
    localStorage.setItem("ai_target_max", "500");
    setStatus("ai-status", "info", "프롬프트 설정을 기본값으로 복원했습니다.");
  });

  loadLatestNews();
});

function cell(text, width = undefined, columnSpan = 1, rowSpan = 1) {
  const options = {
    columnSpan,
    rowSpan,
    verticalAlign: "center",
    children: [new Paragraph({ text, alignment: AlignmentType.CENTER })]
  };

  if (width !== undefined) {
    options.width = { size: width, type: WidthType.DXA };
  }

  return new TableCell(options);
}

function emptyCell(width, rowSpan = 1) {
  const options = {
    rowSpan,
    verticalAlign: "center",
    children: []
  };
  if (width !== undefined) {
    options.width = { size: width, type: WidthType.DXA };
  }
  return new TableCell(options);
}

async function generateSeminarDoc({ filename, name, studentId, title, speaker, summary, reflection, date }) {
  const formattedDate = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  //const TABLE_WIDTH = 9360;
  const TABLE_WIDTH = 9027;
  const TWP = TABLE_WIDTH / 100;
  const COL0_W = 14 * TWP;

  const rows = [
    new TableRow({
      height: { value: 1.19 * 567, rule: HeightRule.AT_LEAST },
      children: [
        cell("제출자", COL0_W), cell("성명", 14 * TWP), cell(name, 43 * TWP, 3),
        cell("학번", 9 * TWP), cell(studentId, 20 * TWP)
      ]
    }),
    new TableRow({
      height: { value: 1 * 567, rule: HeightRule.AT_LEAST },
      children: [
        cell("세미나", COL0_W, 1, 2),
        cell("제목", 14 * TWP, 1), cell(title, 52 * TWP, 4),
        emptyCell(20 * TWP, 2)
      ]
    }),
    new TableRow({
      height: { value: 1.2 * 567, rule: HeightRule.AT_LEAST },
      children: [
        cell("연사", 14 * TWP),
        cell(speaker, 22 * TWP), cell("일시", 15 * TWP), cell(formattedDate, 15 * TWP, 2)
      ]
    }),
    new TableRow({
      height: { value: 8.34 * 567, rule: HeightRule.AT_LEAST },
      children: [
        cell("요약", COL0_W), cell(summary, 86 * TWP, 6)
      ]
    }),
    new TableRow({
      height: { value: 8.04 * 567, rule: HeightRule.AT_LEAST },
      children: [
        cell("느낀점", COL0_W), cell(reflection, 86 * TWP, 6)
      ]
    }),
    new TableRow({
      height: { value: 2.94 * 567, rule: HeightRule.AT_LEAST },
      children: [
        new TableCell({
          columnSpan: 7,
          verticalAlign: "center",
          children: [
            new Paragraph("** 간단한 요약과 느낀점을 각 200자 정도로 기술하여 주시기 바랍니다."),
            new Paragraph("** 본 소감문은 세미나 당일에 제출하여야 합니다.")
          ]
        })
      ]
    })
  ];

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "맑은 고딕", size: 22 } }
      }
    },
    sections: [{ properties: {}, children: [new Table({ rows, width: { size: TABLE_WIDTH, type: WidthType.DXA } })] }]
  });

  return await Packer.toBlob(doc);
}

function sanitizeFilename(filename) {
  const safe = filename.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
  if (!safe) return "seminar_statement.docx";
  return safe.endsWith(".docx") ? safe : `${safe}.docx`;
}

function syncModelOptions(provider, preferredModel = "") {
  const modelSelect = document.getElementById("ai_model");
  const models = PROVIDER_MODELS[provider] || [];
  modelSelect.innerHTML = "";

  models.forEach(model => {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    modelSelect.appendChild(option);
  });

  if (preferredModel && models.includes(preferredModel)) {
    modelSelect.value = preferredModel;
  } else if (models.length > 0) {
    modelSelect.value = models[0];
  }
}

document.getElementById("seminarForm").addEventListener("submit", async function (event) {
  event.preventDefault();
  setStatus("doc-status", "", "");

  const data = {
    filename: sanitizeFilename(document.getElementById("filename").value),
    name: document.getElementById("name").value,
    studentId: document.getElementById("studentId").value,
    title: document.getElementById("title").value,
    speaker: document.getElementById("speaker").value,
    summary: document.getElementById("summary").value,
    reflection: document.getElementById("reflection").value,
    date: new Date()
  };

  Object.entries(data).forEach(([key, value]) => {
    if (key !== "date") localStorage.setItem(key, value);
  });

  try {
    const blob = await generateSeminarDoc(data);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = data.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus("doc-status", "success", "문서 생성이 완료되었습니다.");
  } catch (error) {
    console.error("Failed to generate document:", error);
    setStatus("doc-status", "error", "문서 생성 중 오류가 발생했습니다.");
  }
});

const button = document.getElementById("generateFromAI");
const spinner = document.getElementById("genSpinner");
const buttonText = document.getElementById("genButtonText");

button.addEventListener("click", async () => {
  setStatus("ai-status", "", "");
  if (!latestOCR || !latestNotice) {
    console.warn("[ui] AI call skipped: latest OCR/NOTICE not ready");
    setStatus("ai-status", "error", "뉴스 데이터를 아직 불러오지 못했습니다.");
    return;
  }

  const apiKey = document.getElementById("ai_api_key").value.trim();
  const provider = document.getElementById("ai_provider").value;
  const model = document.getElementById("ai_model").value;
  const promptInstructions = document.getElementById("ai_prompt_instructions").value.trim();
  const targetMin = Number.parseInt(document.getElementById("ai_target_min").value, 10);
  const targetMax = Number.parseInt(document.getElementById("ai_target_max").value, 10);
  if (!apiKey) {
    console.warn("[ui] AI call skipped: API key missing");
    setStatus("ai-status", "error", "API Key를 입력해주세요.");
    return;
  }
  if (!provider || !model) {
    console.warn("[ui] AI call skipped: provider/model missing");
    setStatus("ai-status", "error", "Provider와 모델을 선택해주세요.");
    return;
  }
  if (!Number.isInteger(targetMin) || !Number.isInteger(targetMax) || targetMin < 50 || targetMax > 2000 || targetMin > targetMax) {
    setStatus("ai-status", "error", "Target Min/Max를 확인해주세요. (50 <= Min <= Max <= 2000)");
    return;
  }
  // Save the API key locally
  //localStorage.setItem("gemini_api_key", apiKey);

  // Show spinner + disable button
  toggleSpinner(true);
  const t0 = performance.now();

  try {
    const { title, speaker, summary, reflection } = await generateSeminarFields({
      provider,
      model,
      apiKey,
      ocrText: latestOCR,
      noticeText: latestNotice,
      promptSettings: {
        instructions: promptInstructions,
        targetMin,
        targetMax
      }
    });

    document.getElementById("title").value = title;
    document.getElementById("speaker").value = speaker;
    document.getElementById("summary").value = summary;
    document.getElementById("reflection").value = reflection;

    updateCount("summary", "summary-count");
    updateCount("reflection", "reflection-count");
    setStatus("ai-status", "success", `${provider} 생성 결과를 폼에 반영했습니다.`);
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : String(err);
    setStatus("ai-status", "error", message || "Unknown error");
  } finally {
    console.log(`[ui] generateSeminarFields total ${model}: ${(performance.now() - t0).toFixed(0)}ms provider=${provider}`);
    // Hide spinner + re-enable button
    toggleSpinner(false);
  }
});

// Helper to show/hide spinner
function toggleSpinner(show) {
  spinner.style.display = show ? "inline-block" : "none";
  button.disabled = show;
  buttonText.textContent = show ? "Generating... " : "Generate";
}
