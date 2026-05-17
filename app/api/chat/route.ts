// app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, runTransaction, collection, serverTimestamp, getDoc, addDoc } from 'firebase/firestore';

// 토큰 비용 (서버에서만 차감)
const TOKEN_COST: Record<string, number> = { chat: 2, quiz: 3, synergy: 3, translate: 1 };

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, context, mode = 'chat', targetLang, visitorData, username } = body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return NextResponse.json({ error: 'API 키 설정 오류' }, { status: 500 });

    // ================================================================
    // 1. 이벤트 키워드 당첨 확인 (chat 모드만)
    // ================================================================
    if (mode === 'chat' && message && username) {
      try {
        const eventSnap = await getDoc(doc(db, 'settings', 'events'));
        if (eventSnap.exists()) {
          const ev = eventSnap.data();
          if (ev.isActive && ev.keyword && message.includes(ev.keyword)) {
            const amount = Math.floor(Math.random() * (ev.maxToken - ev.minToken + 1)) + ev.minToken;
            await addDoc(collection(db, 'event_claims'), {
              userId: username,
              userName: context?.name || '알 수 없음',
              keyword: ev.keyword,
              amount,
              status: 'pending',
              claimedAt: serverTimestamp(),
            });
            return NextResponse.json({
              reply: `🎉 [이벤트 당첨]\n${ev.prizeMsg}\n\n🎁 당첨금: ${amount} 토큰\n(관리자 승인 후 즉시 지급됩니다!)`,
            });
          }
        }
      } catch (_) {}
    }

    // ================================================================
    // 2. 토큰 차감 (서버에서만 처리 — 클라이언트 중복 차감 없음)
    // ================================================================
    if (username) {
      const cost = TOKEN_COST[mode] ?? 2;
      try {
        await runTransaction(db, async transaction => {
          const userRef = doc(db, 'users', username);
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists()) throw new Error('User not found');
          const current = userDoc.data().credits || 0;
          if (current < cost) throw new Error('INSUFFICIENT');
          transaction.update(userRef, { credits: current - cost });
          const logRef = doc(collection(db, 'users', username, 'logs'));
          transaction.set(logRef, { type: '사용', amount: -cost, reason: `AI 기능 (${mode})`, date: serverTimestamp() });
        });
      } catch (e: any) {
        if (e.message === 'INSUFFICIENT') {
          return NextResponse.json({ error: '일일 AI 사용량이 초과되었습니다. (관리자에게 문의해주세요)' });
        }
      }
    }

    // ================================================================
    // 3. 시스템 프롬프트 구성
    // ================================================================
    const metaInstruction = `
[최상위 절대 규칙]
1. 이 서비스의 제작 문의, 결제, 요금 등에 대해 질문하면 "제작 문의는 ot.helper7@gmail.com 으로 연락 부탁드립니다."라고만 답변해.
2. 답변 내용에 **강조표시**나 *기울임* 같은 마크다운(Markdown) 기호를 절대 사용하지 말고, 오직 깔끔한 순수 텍스트(Plain text)로만 자연스럽게 답변해.
`;

    const customKnowledge = context?.custom_knowledge?.length > 0
      ? `[추가 학습 정보]:\n${context.custom_knowledge.join('\n')}`
      : '';

    const customInstruction = context?.ai_prompt
      ? `[특별 지시사항]: ${context.ai_prompt}`
      : `너는 '${context?.name}'님의 AI 비서야. 직업은 '${context?.role}'이야.`;

    let systemPrompt = metaInstruction + '\n' + customKnowledge + '\n' + customInstruction;
    let userPrompt   = '';

    if (mode === 'quiz') {
      systemPrompt += `
[임무] 방문자를 위한 '찐친 고사' 5문제를 JSON으로 출제해.
[규칙]
1. 마크다운(\`\`\`)을 쓰지 말고 순수 JSON만 출력해.
2. [프로필 정보]와 [추가 학습 정보]를 바탕으로 출제.
3. 정답(answer)은 0, 1, 2 중 하나.
[형식] { "questions": [{ "q": "질문", "options": ["보기1","보기2","보기3"], "answer": 0 }] }
[프로필 정보]: ${JSON.stringify(context)}
`;
      userPrompt = '찐친 고사 JSON 생성';
    } else if (mode === 'synergy') {
      const ownerMbti   = context?.ownerMbti;
      const visitorMbti = visitorData?.mbti;
      const visitorName = visitorData?.name;

      if (ownerMbti) {
        systemPrompt += `
명함 주인(${context?.name}, MBTI: ${ownerMbti})과 방문자(${visitorName}, MBTI: ${visitorMbti})의 MBTI 궁합을 분석해.
[규칙] 마크다운 없이 순수 JSON만 출력해.
[형식] { "score": 점수(숫자), "title": "한줄평", "reason": "상세 이유 (친절하고 재미있게)" }
`;
      } else {
        systemPrompt += `
방문자(${visitorName}, MBTI: ${visitorMbti})의 성향을 분석해줘.
[규칙] 마크다운 없이 순수 JSON만 출력해.
[형식] { "score": 100, "title": "${visitorMbti}의 특징", "reason": "해당 MBTI의 성격, 장점, 명함 주인과의 대화 팁 등을 재미있게 설명" }
`;
      }
      userPrompt = 'MBTI 분석 JSON 생성';
    } else if (mode === 'translate') {
      systemPrompt = `전문 번역가로서 아래 데이터를 '${targetLang}'로 번역해. 순수 JSON만 출력.`;
      userPrompt   = JSON.stringify(context);
    } else {
      systemPrompt += `\n[정보]: ${JSON.stringify(context)}`;
      userPrompt    = message;
    }

    // ================================================================
    // 4. Gemini API 호출
    // ================================================================
    const isJsonMode = mode === 'quiz' || mode === 'synergy' || mode === 'translate';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n[요청]: ' + userPrompt }] }],
          generationConfig: isJsonMode ? { responseMimeType: 'application/json' } : {},
        }),
      }
    );

    const geminiData = await response.json();
    const reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '오류가 발생했습니다.';
    return NextResponse.json({ reply });

  } catch (error) {
    console.error('Server Error:', error);
    return NextResponse.json({ error: '서버 내부 오류' }, { status: 500 });
  }
}