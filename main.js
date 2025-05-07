import { Document, Packer, Paragraph, Table, TableRow, TableCell, AlignmentType, WidthType, HeightRule } from "https://cdn.jsdelivr.net/npm/docx@9.2.0/+esm";
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
    "gemini_api_key" // ✅ include the API key
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

// Handle DOCX generation on form submission
document.getElementById("seminarForm").addEventListener("submit", function (event) {
  event.preventDefault();

  const filename = document.getElementById("filename").value;
  const name = document.getElementById("name").value;
  const studentId = document.getElementById("studentId").value;
  const title = document.getElementById("title").value;
  const speaker = document.getElementById("speaker").value;
  const summary = document.getElementById("summary").value;
  const reflection = document.getElementById("reflection").value;
  const today = new Date();
  const formattedDate = today.getFullYear() + "." +
    String(today.getMonth() + 1).padStart(2, "0") + "." +
    String(today.getDate()).padStart(2, "0");

  localStorage.setItem("filename", filename);
  localStorage.setItem("name", name);
  localStorage.setItem("studentId", studentId);
  localStorage.setItem("title", title);
  localStorage.setItem("speaker", speaker);
  localStorage.setItem("summary", summary);
  localStorage.setItem("reflection", reflection);

  const row0 = new TableRow({
    height: { value: 1.19 * 567, rule: HeightRule.EXACT },
    children: [
      new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, verticalAlign: "center", children: [new Paragraph({ text: "제출자", alignment: AlignmentType.CENTER })] }),
      new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, verticalAlign: "center", children: [new Paragraph({ text: "성명", alignment: AlignmentType.CENTER })] }),
      new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, columnSpan: 3, verticalAlign: "center", children: [new Paragraph({ text: name, alignment: AlignmentType.CENTER })] }),
      new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, verticalAlign: "center", children: [new Paragraph({ text: "학번", alignment: AlignmentType.CENTER })] }),
      new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, verticalAlign: "center", children: [new Paragraph({ text: studentId, alignment: AlignmentType.CENTER })] })
    ]
  });

  const row1 = new TableRow({
    height: { value: 1 * 567, rule: HeightRule.AT_LEAST },
    children: [
      new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, verticalMerge: "restart", verticalAlign: "center", children: [new Paragraph({ text: "세미나", alignment: AlignmentType.CENTER })] }),
      new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, verticalAlign: "center", children: [new Paragraph({ text: "제목", alignment: AlignmentType.CENTER })] }),
      new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, columnSpan: 4, verticalAlign: "center", children: [new Paragraph({ text: title, alignment: AlignmentType.CENTER })] }),
      new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, verticalMerge: "restart", verticalAlign: "center", children: [new Paragraph({ text: "", alignment: AlignmentType.CENTER })] })
    ]
  });

  const row2 = new TableRow({
    height: { value: 1.2 * 567, rule: HeightRule.AT_LEAST },
    children: [
      new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, verticalMerge: "continue", verticalAlign: "center", children: [] }),
      new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, verticalAlign: "center", children: [new Paragraph({ text: "연사", alignment: AlignmentType.CENTER })] }),
      new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, verticalAlign: "center", children: [new Paragraph({ text: speaker, alignment: AlignmentType.CENTER })] }),
      new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, verticalAlign: "center", children: [new Paragraph({ text: "일시", alignment: AlignmentType.CENTER })] }),
      new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, columnSpan: 2, verticalAlign: "center", children: [new Paragraph({ text: formattedDate, alignment: AlignmentType.CENTER })] }),
      new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, verticalMerge: "continue", verticalAlign: "center", children: [] })
    ]
  });

  const row3 = new TableRow({
    height: { value: 8.34 * 567, rule: HeightRule.AT_LEAST },
    children: [
      new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, verticalAlign: "center", children: [new Paragraph({ text: "요약", alignment: AlignmentType.CENTER })] }),
      new TableCell({ width: { size: 85, type: WidthType.PERCENTAGE }, columnSpan: 6, verticalAlign: "center", children: [new Paragraph(summary)] })
    ]
  });

  const row4 = new TableRow({
    height: { value: 8.04 * 567, rule: HeightRule.AT_LEAST },
    children: [
      new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, verticalAlign: "center", children: [new Paragraph({ text: "느낀점", alignment: AlignmentType.CENTER })] }),
      new TableCell({ width: { size: 85, type: WidthType.PERCENTAGE }, columnSpan: 6, verticalAlign: "center", children: [new Paragraph(reflection)] })
    ]
  });

  const row5 = new TableRow({
    height: { value: 2.94 * 567, rule: HeightRule.EXACT },
    children: [
      new TableCell({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnSpan: 7,
        verticalAlign: "center",
        children: [
          new Paragraph("** 간단한 요약과 느낀점을 각 200자 정도로 기술하여 주시기 바랍니다."),
          new Paragraph("** 본 소감문은 세미나 당일에 제출하여야 합니다.")
        ]
      })
    ]
  });

  const table = new Table({
    rows: [row0, row1, row2, row3, row4, row5],
    width: { size: 100, type: WidthType.PERCENTAGE }
  });

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "맑은 고딕",
            size: 22
          }
        }
      }
    },
    sections: [{ properties: {}, children: [table] }]
  });

  Packer.toBlob(doc).then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
});

const button = document.getElementById("generateFromGemini");
const spinner = document.getElementById("genSpinner");
const buttonText = document.getElementById("genButtonText");

button.addEventListener("click", async () => {
    if (!latestOCR || !latestNotice) return alert("뉴스 데이터를 아직 불러오지 못했습니다.");
  
    const apiKey = document.getElementById("gemini_api_key").value.trim();
    if (!apiKey) return alert("Gemini API Key를 입력해주세요.");
  
    // ✅ Store API key in localStorage
    localStorage.setItem("gemini_api_key", apiKey);
  
    // Show spinner
    spinner.style.display = "inline-block";
    button.disabled = true;
    buttonText.textContent = "Generating...";
  
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
      // Hide spinner
      spinner.style.display = "none";
      button.disabled = false;
      buttonText.textContent = "Generate";
    }
});