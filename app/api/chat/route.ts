// app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';

const langMap: any = {
  en: "English",
  zh: "Chinese (Simplified)",
  ja: "Japanese"
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, context, mode = 'chat', targetLang, visitorData, username } = body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return NextResponse.json({ reply: "API 키 설정 오류" }, { status: 500 });

    // ---------------------------------------------------------
    // 🎉 [강화됨] 이벤트 키워드 감지 로직
    // ---------------------------------------------------------
    if (mode === 'chat' && username && message) {
        try {
            // 설정 불러오기
            const eventDoc = await getDoc(doc(db, "settings", "events"));
            
            if (eventDoc.exists()) {
                const eventData = eventDoc.data();
                
                // 1. 입력값과 정답의 공백 제거 및 소문자 변환 (유연한 비교)
                const cleanInput = message.toString().replace(/\s+/g, '').toLowerCase();
                const cleanTarget = (eventData.keyword || '').toString().replace(/\s+/g, '').toLowerCase();

                // 서버 로그로 확인 (터미널에서 확인 가능)
                console.log(`[EVENT CHECK] Input: "${cleanInput}" vs Target: "${cleanTarget}" / Active: ${eventData.isActive}`);

                // 2. 활성화 상태이고 키워드가 일치하면 당첨!
                if (eventData.isActive && cleanInput === cleanTarget) {
                    
                    const min = Number(eventData.minToken || 10);
                    const max = Number(eventData.maxToken || 100);
                    // 범위 내 랜덤 정수 생성
                    const randomAmount = Math.floor(Math.random() * (max - min + 1)) + min;

                    // 3. 당첨 접수 (DB 저장)
                    await addDoc(collection(db, "event_claims"), {
                        userId: username,
                        userName: context.name || '알 수 없음',
                        keyword: message, // 사용자가 입력한 원본 메시지 저장
                        amount: randomAmount,
                        status: 'pending', 
                        claimedAt: serverTimestamp()
                    });

                    // 4. ✨ AI 답변 대신 당첨 메시지 반환 (여기서 함수 종료)
                    const prizeMsg = eventData.prizeMsg || "축하합니다! 이벤트에 당첨되셨습니다.";
                    return NextResponse.json({ 
                        reply: `🎉 [이벤트 당첨] ${prizeMsg}\n\n(숨겨진 키워드: "${message}")\n\n🎁 당첨금: ${randomAmount} 토큰\n(관리자 승인 후 지급됩니다)` 
                    });
                }
            }
        } catch (e) {
            console.error("이벤트 체크 중 오류 발생:", e);
            // 오류가 나면 무시하고 아래 AI 로직으로 넘어감
        }
    }

    // ... (이벤트가 아니면 아래 AI 로직 수행) ...

    let systemPrompt = "";
    let userPrompt = "";

    // 1. [퀴즈]
    if (mode === 'quiz') {
      systemPrompt = `
      [역할] 너는 '${context.name}'의 AI 분신이야. 팩트 기반으로 찐친 퀴즈 10문제를 출제해.
      [제약] 무조건 10문제. 4지선다(0~3). JSON 포맷.
      [정보]: ${JSON.stringify(context)}
      `;
      userPrompt = "퀴즈 10문제 출제";
    }

    // 2. [궁합]
    else if (mode === 'synergy') {
      systemPrompt = `
      명함 주인('${context.name}')과 방문자의 궁합 분석. 긍정적이고 재미있게.
      [주인]: ${JSON.stringify(context)}
      [방문자]: ${JSON.stringify(visitorData)}
      JSON 출력: { score: 숫자, title: "한줄평", reason: "상세내용" }
      `;
      userPrompt = "궁합 분석";
    } 

    // 3. [번역]
    else if (mode === 'translate') {
      const langName = langMap[targetLang] || targetLang;
      systemPrompt = `
      You are a professional translator. 
      Translate the values of the provided JSON object into **${langName}**.
      Do NOT translate keys. Keep the JSON structure exactly the same.
      [Original Data]: ${JSON.stringify(context)}
      `;
      userPrompt = "Translate only the values.";
    } 

    // 4. [기본] 대화
    else {
      systemPrompt = `
      너는 **'${context.name}'**의 AI 비서야.
      주인의 자기소개("${context.intro}")와 말투를 반영해 1인칭으로 답해.
      정보에 없는 내용은 정중히 모른다고 답해.
      [정보]: ${JSON.stringify(context)}
      `;
      userPrompt = message;
    }

    const isJsonMode = (mode === 'quiz' || mode === 'synergy' || mode === 'translate');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\n[요청]: " + userPrompt }] }],
        generationConfig: isJsonMode ? { responseMimeType: "application/json" } : {}
      })
    });

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "AI 응답 오류";
    
    return NextResponse.json({ reply });

  } catch (error) {
    console.error("Server Error:", error);
    return NextResponse.json({ reply: "서버 에러 발생" }, { status: 500 });
  }
}