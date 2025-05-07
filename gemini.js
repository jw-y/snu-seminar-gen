import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

function buildPrompt(ocrText, noticeText) {
    return `
  당신은 학술 세미나 내용을 요약하는 전문 요약가입니다.
  
  당신에게는 한 세미나에 대한 두 가지 자료가 주어집니다:
  - 하나는 포스터에서 OCR로 추출된 텍스트입니다. (형식 오류나 문장 누락 가능)
  - 다른 하나는 공식적인 공지문 혹은 강연 안내문입니다.
  
  당신의 작업은 다음과 같습니다:
  1. 두 자료를 주의 깊게 비교·분석하여 핵심 정보를 추출합니다.
  2. 세미나의 주제, 발표자, 주요 내용 및 청중의 학습 포인트를 바탕으로 두 개의 간결한 단락을 작성합니다.
  3. 결과는 다음 형식에 맞게 출력합니다:
  
  === 출력 형식 ===  
  제목:  
  [세미나 제목]

  연사:  
  [예: 박지우 박사]  

  간단한 요약:  
  [세미나의 주제, 발표자, 핵심 내용을 요약한 단락 (약 200자)]
  
  느낀점:  
  [세미나를 들은 후 참가자가 얻을 수 있었던 인사이트나 인상을 담은 단락 (약 200자)]
  
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
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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