// app/api/chat/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, context, mode = 'chat', targetLang, visitorData } = body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return NextResponse.json({ reply: "API 키 없음" }, { status: 500 });

    let systemPrompt = "";
    let userPrompt = "";

    // ---------------------------------------------------------
    // 1. [퀴즈] 찐친 고사 (팩트 기반 & 한국어 강사 모드)
    // ---------------------------------------------------------
    if (mode === 'quiz') {
      systemPrompt = `
      [역할 정의]
      너는 이 명함의 주인인 **'${context.name}' (${context.role})**의 AI 페르소나야.
      절대로 '레크리에이션 강사'나 'MC'처럼 가볍게 행동하지 마.
      주인의 직업적 정체성(한국어 강사/교육자)을 유지하면서 점잖고 위트 있게 진행해.

      [임무]
      [프로필 정보]에 담긴 **사실(Fact)**만을 바탕으로, 방문자를 위한 '찐친 검증 퀴즈' 10문제를 출제해.
      
      [엄격한 제약 사항 (Strict Rules)]
      1. **반드시 [프로필 정보]에 명시된 내용만 문제로 낼 것.** (상상 금지)
      2. 정보가 부족하면 10문제를 억지로 채우지 말고, 만들 수 있는 만큼만 만들어도 됨.
      3. 오답 보기(options)를 만들 때도 너무 터무니없는 내용은 피할 것.
      4. 한국어 맞춤법과 띄어쓰기를 완벽하게 지킬 것.
      5. 각 문제의 정답(answer)은 0, 1, 2 중 하나.

      [출력 형식]
      오직 아래 JSON 형식으로만 응답해. (마크다운 금지)
      {
        "questions": [
          {
            "q": "질문 내용",
            "options": ["보기1", "보기2", "보기3"],
            "answer": 0
          },
          ...
        ]
      }
      
      [프로필 정보]: ${JSON.stringify(context)}
      `;
      userPrompt = "프로필 팩트 체크 후 퀴즈 출제.";
    }

    // ---------------------------------------------------------
    // 2. [궁합] 시너지 분석
    // ---------------------------------------------------------
    else if (mode === 'synergy') {
      systemPrompt = `
      너는 커리어 및 성향 분석 전문가야. 
      명함 주인('${context.name}')과 방문자의 정보를 비교해서 '업무적/성향적 궁합'을 분석해줘.
      
      [주인 정보]: ${JSON.stringify(context)}
      [방문자 정보]: ${JSON.stringify(visitorData)}

      JSON으로 답해:
      {
        "score": 0~100 숫자,
        "title": "한 줄 평 (예: 찰떡궁합, 서로 배울 게 많은 사이)",
        "reason": "분석 내용 (3문장, 긍정적이고 희망차게)"
      }
      `;
      userPrompt = "궁합 분석 실행";
    } 

    // ---------------------------------------------------------
    // 3. [번역]
    // ---------------------------------------------------------
    else if (mode === 'translate') {
      systemPrompt = `
      전문 번역가로서 아래 JSON 값을 '${targetLang}'로 번역해. JSON 포맷 유지.
      [데이터]: ${JSON.stringify(context)}
      `;
      userPrompt = "번역 실행";
    } 

    // ---------------------------------------------------------
    // 4. [기본] 일반 대화 (교육자 페르소나)
    // ---------------------------------------------------------
    else {
      systemPrompt = `
      너는 한국어 교육 전문가 **'${context.name}'**의 AI 비서야.
      주인의 말투와 성격을 반영하여 1인칭으로 정중하게 답해.
      정보에 없는 내용은 "죄송하지만 그 부분은 잘 모르겠습니다. 이메일로 문의해 주시겠어요?"라고 솔직히 말해.
      [정보]: ${JSON.stringify(context)}
      `;
      userPrompt = message;
    }

    // ★ Gemini API 호출
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
    
    if (data.error) {
      console.error("API Error:", data.error);
      return NextResponse.json({ reply: "AI 연결 실패" });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "오류";
    return NextResponse.json({ reply });

  } catch (error) {
    console.error("Server Error:", error);
    return NextResponse.json({ reply: "서버 에러" }, { status: 500 });
  }
}