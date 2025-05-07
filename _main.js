
/* word count */
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

['summary', 'reflection'].forEach(id => {
    document.getElementById(id).addEventListener('input', () =>
    updateCount(id, `${id}-count`)
    );
});

fetch('latest_news.html')
    .then(response => response.text())
    .then(data => {
    document.getElementById('latest').innerHTML = data;
    })
    .catch(error => console.log(error));
/*
const seminarListURL = 'https://gsds.snu.ac.kr/news/news-seminar/';
fetch(seminarListURL)
    .then(response => response.text())
    .then(html => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const firstArticle = doc.querySelector('.loop');

    if (firstArticle) {
        const titleElement = firstArticle.querySelector('.desc h4 a');
        const title = titleElement ? titleElement.innerText : 'No title found';
        const url = titleElement ? titleElement.href : 'No URL found';

        const targetDiv = document.getElementById('latest');
        targetDiv.innerHTML = firstArticle.outerHTML;

        console.log('First article title:', title);
        console.log('First article URL:', url);
    } else {
        console.log('No article found.');
    }
    });
*/

document.addEventListener("DOMContentLoaded", function () {
    const fields = ["filename", "name", "studentId", "title", "speaker", "summary", "reflection"];
    fields.forEach(function (field) {
    const storedValue = localStorage.getItem(field);
    if (storedValue) {
        document.getElementById(field).value = storedValue;
    }
    });
    ['summary', 'reflection'].forEach(id => {
    const countId = `${id}-count`;
    const textarea = document.getElementById(id);
    textarea.addEventListener('input', () => updateCount(id, countId));
    updateCount(id, countId); // ← ensures count shows immediately on load
    });
});

// Import required classes from the docx library
const { Document, Packer, Paragraph, Table, TableRow, TableCell, AlignmentType, WidthType, HeightRule } = docx;

// Listen for form submission
document.getElementById("seminarForm").addEventListener("submit", function (event) {
    event.preventDefault();

    // Gather form data
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

    // Build table rows following a layout similar to your Python code

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
        new TableCell({
        width: { size: 15, type: WidthType.PERCENTAGE },
        verticalAlign: "center",
        children: [
            new Paragraph({ text: "제출자", alignment: AlignmentType.CENTER })
        ]
        }),
        new TableCell({
        width: { size: 15, type: WidthType.PERCENTAGE },
        verticalAlign: "center",
        children: [
            new Paragraph({ text: "성명", alignment: AlignmentType.CENTER })
        ]
        }),
        new TableCell({
        width: { size: 35, type: WidthType.PERCENTAGE },
        columnSpan: 3,
        verticalAlign: "center",
        children: [
            new Paragraph({ text: name, alignment: AlignmentType.CENTER })
        ]
        }),
        new TableCell({
        width: { size: 15, type: WidthType.PERCENTAGE },
        verticalAlign: "center",
        children: [
            new Paragraph({ text: "학번", alignment: AlignmentType.CENTER })
        ]
        }),
        new TableCell({
        width: { size: 20, type: WidthType.PERCENTAGE },
        verticalAlign: "center",
        children: [
            new Paragraph({ text: studentId, alignment: AlignmentType.CENTER })
        ]
        })
    ]
    });

    const row1 = new TableRow({
    height: { value: 1 * 567, rule: HeightRule.AT_LEAST },
    children: [
        new TableCell({
        width: { size: 15, type: WidthType.PERCENTAGE },
        verticalMerge: "restart",
        verticalAlign: "center",
        children: [
            new Paragraph({ text: "세미나", alignment: AlignmentType.CENTER })
        ]
        }),
        new TableCell({
        width: { size: 15, type: WidthType.PERCENTAGE },
        verticalAlign: "center",
        children: [
            new Paragraph({ text: "제목", alignment: AlignmentType.CENTER })
        ]
        }),
        new TableCell({
        width: { size: 50, type: WidthType.PERCENTAGE },
        columnSpan: 4,
        verticalAlign: "center",
        children: [
            new Paragraph({ text: title, alignment: AlignmentType.CENTER })
        ]
        }),
        new TableCell({
        width: { size: 20, type: WidthType.PERCENTAGE },
        verticalMerge: "restart",
        verticalAlign: "center",
        children: [
            new Paragraph({ text: "", alignment: AlignmentType.CENTER })
        ]
        })
    ]
    });

    const row2 = new TableRow({
    height: { value: 1.2 * 567, rule: HeightRule.AT_LEAST },
    children: [
        new TableCell({
        width: { size: 15, type: WidthType.PERCENTAGE },
        verticalMerge: "continue",
        verticalAlign: "center",
        children: []
        }),
        new TableCell({
        width: { size: 15, type: WidthType.PERCENTAGE },
        verticalAlign: "center",
        children: [
            new Paragraph({ text: "연사", alignment: AlignmentType.CENTER })
        ]
        }),
        new TableCell({
        width: { size: 20, type: WidthType.PERCENTAGE },
        verticalAlign: "center",
        children: [
            new Paragraph({ text: speaker, alignment: AlignmentType.CENTER })
        ]
        }),
        new TableCell({
        width: { size: 15, type: WidthType.PERCENTAGE },
        verticalAlign: "center",
        children: [
            new Paragraph({ text: "일시", alignment: AlignmentType.CENTER })
        ]
        }),
        new TableCell({
        width: { size: 15, type: WidthType.PERCENTAGE },
        columnSpan: 2,
        verticalAlign: "center",
        children: [
            new Paragraph({ text: formattedDate, alignment: AlignmentType.CENTER })
        ]
        }),
        new TableCell({
        width: { size: 20, type: WidthType.PERCENTAGE },
        verticalMerge: "continue",
        verticalAlign: "center",
        children: []
        })
    ]
    });

    const row3 = new TableRow({
    height: { value: 8.34 * 567, rule: HeightRule.AT_LEAST },
    children: [
        new TableCell({
        width: { size: 15, type: WidthType.PERCENTAGE },
        verticalAlign: "center",
        children: [
            new Paragraph({ text: "요약", alignment: AlignmentType.CENTER })
        ]
        }),
        new TableCell({
        width: { size: 85, type: WidthType.PERCENTAGE },
        columnSpan: 6,
        verticalAlign: "center",
        children: [
            new Paragraph(summary)
        ]
        })
    ]
    });

    const row4 = new TableRow({
    height: { value: 8.04 * 567, rule: HeightRule.AT_LEAST },
    children: [
        new TableCell({
        width: { size: 15, type: WidthType.PERCENTAGE },
        verticalAlign: "center",
        children: [
            new Paragraph({ text: "느낀점", alignment: AlignmentType.CENTER })
        ]
        }),
        new TableCell({
        width: { size: 85, type: WidthType.PERCENTAGE },
        columnSpan: 6,
        verticalAlign: "center",
        children: [
            new Paragraph(reflection)
        ]
        })
    ]
    });


    // Row 5: Note row (merged across all 7 columns)
    const noteText1 = "** 간단한 요약과 느낀점을 각 200자 정도로 기술하여 주시기 바랍니다.";
    const noteText2 = "** 본 소감문은 세미나 당일에 제출하여야 합니다.";
    const row5 = new TableRow({
    height: { value: 2.94 * 567, rule: HeightRule.EXACT },
    children: [
        new TableCell({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnSpan: 7,
        verticalAlign: "center",
        children: [
            new Paragraph(noteText1),
            new Paragraph(noteText2),
        ]
        })
    ]
    });

    // Assemble the table with all rows
    const table = new Table({
    rows: [row0, row1, row2, row3, row4, row5],
    width: { size: 100, type: WidthType.PERCENTAGE }
    });

    // Create the document with one section containing the table
    const doc = new Document({
    styles: {
        default: {
        document: {
            run: {
            font: "맑은 고딕",
            size: 22,
            },
        },
        },
    },
    sections: [{
        properties: {},
        children: [table]
    }]
    });

    // Generate the document and trigger a download
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