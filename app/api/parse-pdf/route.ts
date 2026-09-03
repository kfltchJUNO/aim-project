// app/api/parse-pdf/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, runTransaction, collection, serverTimestamp, arrayUnion } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const username = formData.get('username') as string | null;
    const textInput = formData.get('text') as string | null;

    if (!username) {
      return NextResponse.json({ error: '사용자 ID가 필요합니다.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API 키가 설정되지 않았습니다.' }, { status: 500 });
    }

    // 1. 토큰 잔액 확인 (최소 50토큰 필요)
    let hasCredits = false;
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', username);
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) throw new Error('존재하지 않는 유저입니다.');

      const currentCredits = userDoc.data().credits || 0;
      if (currentCredits < 50) {
        throw new Error('INSUFFICIENT');
      }
      hasCredits = true;
    }).catch((err) => {
      if (err.message === 'INSUFFICIENT') {
        hasCredits = false;
      } else {
        throw err;
      }
    });

    if (!hasCredits) {
      return NextResponse.json({ error: 'PDF/CV 파일 AI 학습은 50토큰이 필요합니다. (토큰이 부족합니다)' }, { status: 400 });
    }

    // 2. 파일 텍스트 읽기
    let contentToAnalyze = textInput || '';
    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      contentToAnalyze = buffer.toString('utf-8');

      // 바이너리 찌꺼기 제거 및 텍스트 정리
      contentToAnalyze = contentToAnalyze.replace(/[^\x20-\x7E\uAC00-\uD7A3\n\r\t]/g, ' ').slice(0, 15000);
    }

    if (!contentToAnalyze.trim()) {
      return NextResponse.json({ error: '파일에서 읽을 수 있는 텍스트를 찾지 못했습니다.' }, { status: 400 });
    }

    // 3. Gemini API 기반 텍스트 추출 및 요약
    const prompt = `
[임무] 아래 전달받은 논문/이력서/학술 자료 텍스트에서 명함 주인의 주요 연구 실적, 핵심 업적, 학술 활동, 경력을 추출해줘.
[규칙]
1. 3~5개의 깔끔하고 자세한 한국어 지식 문장으로 가공해.
2. 마크다운 기호 없이 순수 JSON만 출력해.
[형식] { "points": ["핵심 지식 1", "핵심 지식 2", "핵심 지식 3"] }

[자료 텍스트]:
${contentToAnalyze}
`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );

    const geminiData = await geminiRes.json();
    const rawReply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let extractedPoints: string[] = [];
    try {
      const parsed = JSON.parse(rawReply);
      if (Array.isArray(parsed.points)) {
        extractedPoints = parsed.points.filter((p: any) => typeof p === 'string' && p.trim().length > 0);
      }
    } catch (_) {
      if (rawReply.trim()) {
        extractedPoints = [rawReply.trim()];
      }
    }

    if (extractedPoints.length === 0) {
      return NextResponse.json({ error: 'AI 지식 추출에 실패했습니다.' }, { status: 500 });
    }

    // 4. Firestore 50토큰 차감 및 custom_knowledge 저장
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', username);
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) throw new Error('유저를 찾을 수 없습니다.');

      const currentCredits = userDoc.data().credits || 0;
      if (currentCredits < 50) throw new Error('INSUFFICIENT');

      transaction.update(userRef, {
        credits: currentCredits - 50,
        custom_knowledge: arrayUnion(...extractedPoints),
      });

      const logRef = doc(collection(db, 'users', username, 'logs'));
      transaction.set(logRef, {
        type: '사용',
        amount: -50,
        reason: `PDF/CV AI 자동 학습 (${file ? file.name : '문서'} 파일 분석)`,
        date: serverTimestamp(),
      });
    });

    return NextResponse.json({
      ok: true,
      message: 'PDF/CV AI 파일 학습 완료! 50토큰이 차감되었습니다.',
      extractedPoints,
    });
  } catch (error: any) {
    console.error('PDF AI Parse Error:', error);
    return NextResponse.json({ error: error.message || '서버 오류' }, { status: 500 });
  }
}
