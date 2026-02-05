// app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';

const TOKEN_COST = { chat: 2, quiz: 3, synergy: 3, translate: 1 };

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, context, mode = 'chat', targetLang, visitorData, username } = body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return NextResponse.json({ reply: "API 키 설정 오류" }, { status: 500 });

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
    // 🔥 [수정] 궁합 분석 (MBTI)
    else if (mode === 'synergy') {
      const ownerMbti = context.ownerMbti;
      const visitorMbti = visitorData.mbti;
      const visitorName = visitorData.name;

      if (ownerMbti) {
          // 1. 주인의 MBTI가 있을 때 -> 궁합 분석
          systemPrompt += `
          명함 주인(${context.name}, MBTI: ${ownerMbti})과 방문자(${visitorName}, MBTI: ${visitorMbti})의 MBTI 궁합을 분석해.
          [규칙] 마크다운 없이 순수 JSON만 출력해.
          [형식] { "score": 점수(숫자), "title": "한줄평", "reason": "상세 이유 (친절하고 재미있게)" }
          `;
      } else {
          // 2. 주인의 MBTI가 없을 때 -> 방문자 성향 분석
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