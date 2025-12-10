import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

function buildPrompt(ocrText, noticeText) {
  return `
당신은 학술 세미나에 실제로 참석한 참가자이며, 전문적인 글쓰기 실력을 바탕으로 세미나 후기를 작성하고자 합니다.

당신에게는 세미나에서 배포된 두 가지 자료가 있습니다:
- 포스터에서 OCR로 추출된 텍스트 (형식 오류나 누락 가능)
- 공식적인 공지문 혹은 강연 안내문

당신의 작업은 다음과 같습니다:
1. 주어진 자료를 참고하되, 실제로 세미나를 **직접 들은 것처럼** 내용을 구성합니다.
2. 세미나의 **제목, 발표자, 주요 주제**, 그리고 **참가자로서 얻은 인사이트**를 중심으로 두 개의 단락을 작성합니다.
3. 아래 형식에 맞춰 작성합니다:

=== 출력 형식 ===  
제목:  
[세미나 제목]

연사:  
[예: 양정우 박사]

간단한 요약:  
[세미나에서 실제로 다룬 주제, 발표자의 논지, 핵심 내용을 요약한 단락 (약 200자)]

느낀점:  
[세미나에 참석한 후 얻은 통찰, 인상 깊었던 점, 향후 연구/학습에 도움이 된 부분 등 (약 200자)]

=== 입력 ===  
포스터 (OCR):  
"""  
${ocrText}
"""  

공지문:  
"""  
${noticeText}
"""
  `;
}
  

export async function callGemini(apiKey, ocrText, noticeText) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: buildPrompt(ocrText, noticeText) }] }]
  });

  const text = result.response.text();

  return {
    title: text.match(/제목:\s*(.+?)연사:/s)?.[1]?.trim() || "",
    speaker: text.match(/연사:\s*(.+?)간단한 요약:/s)?.[1]?.trim() || "",
    summary: text.match(/간단한 요약:\s*(.+?)느낀점:/s)?.[1]?.trim() || "",
    reflection: text.match(/느낀점:\s*(.+)/s)?.[1]?.trim() || ""
  };
}