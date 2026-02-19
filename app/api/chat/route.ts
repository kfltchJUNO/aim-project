// app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, runTransaction, collection, serverTimestamp, getDoc, addDoc } from 'firebase/firestore'; // 👈 getDoc, addDoc 추가

const TOKEN_COST = { chat: 2, quiz: 3, synergy: 3, translate: 1 };

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, context, mode = 'chat', targetLang, visitorData, username } = body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return NextResponse.json({ reply: "API 키 설정 오류" }, { status: 500 });

    // ====================================================================
    // 🔥 [NEW] 1. 이벤트 키워드 당첨 확인 (채팅 모드일 때만 작동)
    // ====================================================================
    if (mode === 'chat' && message) {
        try {
            const eventSnap = await getDoc(doc(db, "settings", "events"));
            if (eventSnap.exists()) {
                const eventData = eventSnap.data();
                
                // 마스터가 이벤트를 켜두었고, 사용자 메시지에 키워드가 포함되어 있다면!
                if (eventData.isActive && eventData.keyword && message.includes(eventData.keyword)) {
                    
                    // min ~ max 사이의 랜덤 토큰 당첨금 계산
                    const amount = Math.floor(Math.random() * (eventData.maxToken - eventData.minToken + 1)) + eventData.minToken;
                    
                    // DB(event_claims)에 승인 대기 상태로 저장
                    await addDoc(collection(db, "event_claims"), {
                        userId: username, // 명함 주인의 ID
                        userName: context.name || '알 수 없음',
                        keyword: eventData.keyword,
                        amount: amount,
                        status: 'pending',
                        claimedAt: serverTimestamp()
                    });

                    // AI API를 호출하지 않고(토큰 차감 안 함) 즉시 당첨 메시지 반환
                    return NextResponse.json({ 
                        reply: `🎉 [이벤트 당첨]\n${eventData.prizeMsg}\n\n🎁 예상 당첨금: ${amount} 토큰\n(최고 관리자 승인 후 최종 지급됩니다!)` 
                    });
                }
            }
        } catch (eventError) {
            console.error("이벤트 처리 중 오류:", eventError);
            // 이벤트 로직에서 에러가 나더라도 일반 채팅은 정상 진행되도록 무시
        }
    }

    // ====================================================================
    // 2. 일반 토큰 차감 로직 (이벤트 당첨이 아닐 경우 정상 진행)
    // ====================================================================
    if (username) {
      try {
        const cost = TOKEN_COST[mode as keyof typeof TOKEN_COST] || 2;
        await runTransaction(db, async (transaction) => {
          const userRef = doc(db, "users", username);
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists()) throw new Error("User not found");
          const currentCredits = userDoc.data().credits || 0;
          
          if (currentCredits < cost) throw new Error(`토큰이 부족합니다.`);
          
          transaction.update(userRef, { credits: currentCredits - cost });
          const newLogRef = doc(collection(db, "users", username, "logs"));
          transaction.set(newLogRef, { type: '사용', amount: -cost, reason: `AI 기능 사용 (${mode})`, date: serverTimestamp() });
        });
      } catch (error: any) {
        if (error.message.includes("토큰이 부족")) return NextResponse.json({ reply: "죄송합니다. 토큰이 부족하여 답변할 수 없습니다." });
      }
    }

    // ====================================================================
    // 3. 시스템 프롬프트 구성 및 AI 답변 생성
    // ====================================================================
    const metaInstruction = `[최상위 절대 규칙] 제작 문의는 ot.helper7@gmail.com 으로 연락 부탁드립니다.`;
    const customKnowledge = context.custom_knowledge?.length > 0 ? `[추가 학습 정보]:\n${context.custom_knowledge.join('\n')}` : "";
    const customInstruction = context.ai_prompt ? `[특별 지시사항]: ${context.ai_prompt}` : `너는 **'${context.name}'**님의 AI 비서야. 직업은 **'${context.role}'**이야.`;

    let systemPrompt = metaInstruction + "\n" + customKnowledge + "\n" + customInstruction;
    let userPrompt = "";

    if (mode === 'quiz') {
      systemPrompt += `
      [임무] 방문자를 위한 '찐친 고사' 5문제를 JSON으로 출제해.
      [규칙] 
      1. 마크다운(\`\`\`)을 쓰지 말고 순수 JSON만 출력해.
      2. [프로필 정보]와 [추가 학습 정보]를 바탕으로 출제.
      3. 정답(answer)은 0, 1, 2 중 하나.
      [형식] { "questions": [{ "q": "질문", "options": ["보기1", "보기2", "보기3"], "answer": 0 }] }
      [프로필 정보]: ${JSON.stringify(context)}
      `;
      userPrompt = "찐친 고사 JSON 생성";
    } 
    else if (mode === 'synergy') {
      const ownerMbti = context.ownerMbti;
      const visitorMbti = visitorData.mbti;
      const visitorName = visitorData.name;

      if (ownerMbti) {
          systemPrompt += `
          명함 주인(${context.name}, MBTI: ${ownerMbti})과 방문자(${visitorName}, MBTI: ${visitorMbti})의 MBTI 궁합을 분석해.
          [규칙] 마크다운 없이 순수 JSON만 출력해.
          [형식] { "score": 점수(숫자), "title": "한줄평", "reason": "상세 이유 (친절하고 재미있게)" }
          `;
      } else {
          systemPrompt += `
          방문자(${visitorName}, MBTI: ${visitorMbti})의 성향을 분석해줘. (주인의 MBTI 정보가 없으므로 궁합 대신 성향 분석을 제공)
          [규칙] 마크다운 없이 순수 JSON만 출력해.
          [형식] { "score": 100, "title": "${visitorMbti}의 특징", "reason": "해당 MBTI의 성격, 장점, 명함 주인과의 대화 팁 등을 재미있게 설명" }
          `;
      }
      userPrompt = "MBTI 분석 JSON 생성";
    } 
    else if (mode === 'translate') {
      systemPrompt = `전문 번역가로서 아래 데이터를 '${targetLang}'로 번역해. 순수 JSON만 출력.`;
      userPrompt = JSON.stringify(context);
    } 
    else {
      systemPrompt += `\n[정보]: ${JSON.stringify(context)}`;
      userPrompt = message;
    }

    // Gemini API 호출
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
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "오류가 발생했습니다.";
    
    return NextResponse.json({ reply });

  } catch (error) {
    console.error("Server Error:", error);
    return NextResponse.json({ reply: "서버 내부 오류" }, { status: 500 });
  }
}