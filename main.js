import { Document, Packer, Paragraph, Table, TableRow, TableCell, AlignmentType, WidthType, HeightRule } from "https://cdn.jsdelivr.net/npm/docx@9.5.0/+esm";
import { callGemini } from "./gemini.js";

let latestOCR = "";
let latestNotice = "";

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

["summary", "reflection"].forEach(id => {
  document.getElementById(id).addEventListener('input', () =>
    updateCount(id, `${id}-count`)
  );
});

fetch('latest_news.html')
  .then(response => response.text())
  .then((htmlText) => {
    document.getElementById('latest').innerHTML = htmlText;

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    // OCR: English content block
    const ocrDiv = doc.querySelector('div[style*="white-space: pre-wrap"]');
    latestOCR = ocrDiv?.textContent.trim() || "";

    // Notice: Korean content block
    const noticeContainer = doc.querySelector('.page-container-content');
    const paragraphs = noticeContainer?.querySelectorAll('p') || [];
    latestNotice = Array.from(paragraphs).map(p => p.textContent.trim()).join('\n');
  })
  .catch(error => console.error("Failed to fetch latest_news.html:", error));

// Restore localStorage on load
document.addEventListener("DOMContentLoaded", () => {
  const fields = [
    "filename",
    "name",
    "studentId",
    "title",
    "speaker",
    "summary",
    "reflection",
    //"gemini_api_key" // ✅ include the API key
  ];
  fields.forEach(field => {
    const storedValue = localStorage.getItem(field);
    if (storedValue) {
      document.getElementById(field).value = storedValue;
    }
  });
  ["summary", "reflection"].forEach(id => {
    updateCount(id, `${id}-count`);
  });
});

function cell(text, width = undefined, columnSpan = 1, rowSpan=1) {
  const options = {
    columnSpan,
    rowSpan,
    verticalAlign: "center",
    children: [new Paragraph({ text, alignment: AlignmentType.CENTER })],
  };

  if (width !== undefined) {
    options.width = { size: width, type: WidthType.DXA };
  }

  return new TableCell(options);
}

function emptyCell(width, rowSpan=1) {
  const options = {
    rowSpan,
    verticalAlign: "center",
    children: [],
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
        emptyCell(20*TWP, 2)
      ]
    }),
    new TableRow({
      height: { value: 1.2 * 567, rule: HeightRule.AT_LEAST },
      children: [
        cell("연사", 14 * TWP), 
        cell(speaker, 22 * TWP), cell("일시", 15 * TWP), cell(formattedDate, 15 * TWP, 2), 
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


document.getElementById("seminarForm").addEventListener("submit", async function (event) {
  event.preventDefault();

  const data = {
    filename: document.getElementById("filename").value,
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

  const blob = await generateSeminarDoc(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = data.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

const button = document.getElementById("generateFromGemini");
const spinner = document.getElementById("genSpinner");
const buttonText = document.getElementById("genButtonText");

button.addEventListener("click", async () => {
  if (!latestOCR || !latestNotice) {
    alert("뉴스 데이터를 아직 불러오지 못했습니다.");
    return;
  }

  const apiKey = document.getElementById("gemini_api_key").value.trim();
  if (!apiKey) {
    alert("Gemini API Key를 입력해주세요.");
    return;
  }

  // ✅ Save the API key locally
  //localStorage.setItem("gemini_api_key", apiKey);

  // ✅ Show spinner + disable button
  toggleSpinner(true);

  try {
    const { title, speaker, summary, reflection } = await callGemini(apiKey, latestOCR, latestNotice);

    document.getElementById("title").value = title;
    document.getElementById("speaker").value = speaker;
    document.getElementById("summary").value = summary;
    document.getElementById("reflection").value = reflection;

    updateCount("summary", "summary-count");
    updateCount("reflection", "reflection-count");
  } catch (err) {
    console.error(err);
    alert("Gemini 요약 중 오류 발생");
  } finally {
    // ✅ Hide spinner + re-enable button
    toggleSpinner(false);
  }
});

// ✅ Helper to show/hide spinner
function toggleSpinner(show) {
  spinner.style.display = show ? "inline-block" : "none";
  button.disabled = show;
  buttonText.textContent = show ? "Generating... " : "Generate";
}