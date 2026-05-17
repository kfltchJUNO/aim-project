// components/FunFeatures.tsx
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

type Props = {
  context: any;
  username: string;
  activeFeature: 'quiz' | 'synergy' | null;
  onClose: () => void;
};

export default function FunFeatures({ context, username, activeFeature, onClose }: Props) {
  const [loading, setLoading] = useState(false);

  // 퀴즈 상태
  const [quizVisitorName, setQuizVisitorName] = useState('');
  const [quizData, setQuizData]     = useState<any[]>([]);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [quizResult, setQuizResult] = useState<{ score: number; rank: string } | null>(null);

  // 궁합 상태
  const [visitorData, setVisitorData] = useState({ name: '', mbti: '', job: '' });
  const [synergyResult, setSynergyResult] = useState<any>(null);

  useEffect(() => {
    if (!activeFeature) {
      setQuizResult(null);
      setSynergyResult(null);
      setQuizData([]);
      setCurrentQIdx(0);
      setUserAnswers([]);
      setQuizVisitorName('');
      setVisitorData({ name: '', mbti: '', job: '' });
      setLoading(false);
    }
  }, [activeFeature]);

  // 토큰 차감 없이 API 직접 호출 (차감은 서버에서 처리)
  const callApi = async (mode: 'quiz' | 'synergy', additionalData?: any) => {
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, context, username, visitorData: additionalData }),
      });
      const data = await res.json();
      if (data.error) { alert(data.error); onClose(); return null; }
      return JSON.parse(data.reply);
    } catch (_) {
      alert('일시적인 오류가 발생했습니다.');
      onClose();
      return null;
    } finally {
      setLoading(false);
    }
  };

  // ── 퀴즈 시작 ────────────────────────────────────────────────────────────
  const startQuiz = async () => {
    if (!quizVisitorName.trim()) { alert('이름이나 닉네임을 입력해주세요!'); return; }
    const res = await callApi('quiz');
    if (res?.questions) setQuizData(res.questions);
  };

  const handleAnswer = async (choiceIdx: number) => {
    const newAns = [...userAnswers, choiceIdx];
    setUserAnswers(newAns);

    if (currentQIdx < quizData.length - 1) {
      setCurrentQIdx(currentQIdx + 1);
    } else {
      let correct = 0;
      quizData.forEach((q, i) => { if (q.answer === newAns[i]) correct++; });
      const score = Math.round((correct / quizData.length) * 100);
      let rank = '노력 요망 😅';
      if (score === 100) rank = '💖 영혼의 단짝';
      else if (score >= 80) rank = '🔥 찐친 인증';
      else if (score >= 60) rank = '🙂 친한 사이';

      setQuizResult({ score, rank });

      // 퀴즈 결과 Firestore 저장
      try {
        await addDoc(collection(db, 'users', username, 'quiz_results'), {
          visitorName: quizVisitorName,
          score,
          rank,
          total: quizData.length,
          correct,
          createdAt: serverTimestamp(),
        });
      } catch (_) {}
    }
  };

  // ── 퀴즈 결과 공유 ────────────────────────────────────────────────────────
  const handleShareResult = async () => {
    const text = `[${context.name} 찐친고사]\n${quizVisitorName}님의 점수: ${quizResult?.score}점 ${quizResult?.rank}\n나도 풀어보기 👉 ${window.location.href}`;
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch (_) {}
    }
    try {
      await navigator.clipboard.writeText(text);
      alert('결과 복사 완료! 친구에게 공유하세요 🎉');
    } catch (_) {}
  };

  // ── 궁합 시작 ────────────────────────────────────────────────────────────
  const startSynergy = async () => {
    if (!visitorData.name || !visitorData.mbti) { alert('이름과 MBTI를 입력해주세요!'); return; }
    const res = await callApi('synergy', visitorData);
    if (res) setSynergyResult(res);
  };

  if (!activeFeature) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
      <div style={{ background: 'white', width: '100%', maxWidth: '400px', borderRadius: '20px', overflow: 'hidden', position: 'relative', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', zIndex: 10 }}>×</button>

        {/* ── 퀴즈 UI ── */}
        {activeFeature === 'quiz' && (
          <div style={{ padding: '30px 20px', flex: 1, overflowY: 'auto' }}>
            <h2 style={{ textAlign: 'center', margin: '0 0 20px', color: '#1a237e' }}>📝 찐친 능력 고사</h2>

            {/* 이름 입력 & 시작 */}
            {!loading && quizData.length === 0 && !quizResult && (
              <div style={{ textAlign: 'center' }}>
                <p style={{ marginBottom: '20px', color: '#555' }}>
                  <strong>{context.name}</strong>님에 대해 얼마나 아세요?
                </p>
                <input
                  placeholder="도전자의 이름/닉네임"
                  value={quizVisitorName}
                  onChange={e => setQuizVisitorName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && startQuiz()}
                  style={{ ...inputStyle, marginBottom: '12px', textAlign: 'center' }}
                />
                <button onClick={startQuiz} style={mainBtn}>도전하기</button>
              </div>
            )}

            {loading && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                시험지를 인쇄하고 있습니다...<br />(AI 문제 출제 중 🤖)
              </div>
            )}

            {/* 문제 풀이 */}
            {!loading && quizData.length > 0 && !quizResult && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#888', fontSize: '0.9rem' }}>
                  <span>{quizVisitorName}님의 도전</span>
                  <span>{currentQIdx + 1} / {quizData.length}</span>
                </div>
                <div style={{ background: '#eee', height: '6px', borderRadius: '3px', marginBottom: '25px' }}>
                  <div style={{ width: `${((currentQIdx + 1) / quizData.length) * 100}%`, background: '#1a237e', height: '100%', borderRadius: '3px', transition: 'width 0.3s' }} />
                </div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', lineHeight: '1.5' }}>Q. {quizData[currentQIdx].q}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {quizData[currentQIdx].options.map((opt: string, idx: number) => (
                    <button key={idx} onClick={() => handleAnswer(idx)} style={{ padding: '14px', border: '1px solid #ddd', borderRadius: '10px', background: 'white', textAlign: 'left', cursor: 'pointer', fontSize: '0.95rem' }}>
                      {idx + 1}. {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 결과 인증서 */}
            {quizResult && (
              <div style={{ border: '8px double #D4AF37', padding: '20px', borderRadius: '10px', textAlign: 'center', background: '#fffbf0', position: 'relative' }}>
                <div style={{ fontSize: '0.85rem', letterSpacing: '2px', marginBottom: '10px', fontWeight: 'bold', color: '#888' }}>CERTIFICATE OF FRIENDSHIP</div>
                <h2 style={{ fontSize: '1.6rem', margin: '10px 0', fontFamily: 'serif', color: '#333' }}>찐친 인증서</h2>
                <p style={{ margin: '15px 0', fontSize: '1rem' }}>
                  성명: <strong>{quizVisitorName}</strong><br />
                  영역: <strong>{context.name} 탐구</strong>
                </p>
                <div style={{ margin: '20px 0' }}>
                  <div style={{ fontSize: '3.5rem', fontWeight: '900', color: '#D4AF37' }}>{quizResult.score}점</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#c62828', marginTop: '5px' }}>[{quizResult.rank}]</div>
                </div>
                <p style={{ fontSize: '0.9rem', color: '#666' }}>
                  위 사람은 {context.name}님에 대한<br />관심을 증명하였기에 이 증서를 수여합니다.
                </p>
                <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '8px' }}>{new Date().toLocaleDateString()}</div>

                <button onClick={handleShareResult} style={{ ...mainBtn, marginTop: '15px', background: '#e65100' }}>
                  결과 자랑하기 📤
                </button>

                <div style={{ position: 'absolute', bottom: '20px', right: '20px', width: '55px', height: '55px', border: '3px solid #c62828', borderRadius: '50%', color: '#c62828', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', transform: 'rotate(-15deg)', fontSize: '0.8rem', opacity: 0.8 }}>
                  참잘함
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 궁합 UI ── */}
        {activeFeature === 'synergy' && (
          <div style={{ padding: '30px 20px', flex: 1, overflowY: 'auto' }}>
            <h2 style={{ textAlign: 'center', margin: '0 0 20px', color: '#e91e63' }}>💘 케미 분석기</h2>

            {!loading && !synergyResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ textAlign: 'center', color: '#666', marginBottom: '5px' }}>간단한 정보를 입력하면<br />AI가 궁합을 분석해드려요!</p>
                <input placeholder="이름 (또는 닉네임)" value={visitorData.name} onChange={e => setVisitorData({ ...visitorData, name: e.target.value })} style={inputStyle} />
                <input placeholder="MBTI (예: ENFP)" value={visitorData.mbti} onChange={e => setVisitorData({ ...visitorData, mbti: e.target.value.toUpperCase() })} style={inputStyle} maxLength={4} />
                <input placeholder="직업/관심사 (선택)" value={visitorData.job} onChange={e => setVisitorData({ ...visitorData, job: e.target.value })} style={inputStyle} />
                <button onClick={startSynergy} style={{ ...mainBtn, background: '#e91e63', marginTop: '5px' }}>궁합 결과 보기</button>
              </div>
            )}

            {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>별자리를 이어보는 중... ✨</div>}

            {synergyResult && (
              <div style={{ textAlign: 'center', border: '2px dashed #f8bbd0', borderRadius: '15px', padding: '20px', background: '#fff0f5' }}>
                <div style={{ fontSize: '4rem', fontWeight: 'bold', color: '#e91e63', marginBottom: '10px' }}>{synergyResult.score}점</div>
                <h3 style={{ fontSize: '1.2rem', margin: '0 0 15px 0' }}>"{synergyResult.title}"</h3>
                <div style={{ background: 'white', padding: '15px', borderRadius: '10px', textAlign: 'left', lineHeight: '1.6', color: '#333' }}>{synergyResult.reason}</div>
                <button onClick={() => setSynergyResult(null)} style={{ ...mainBtn, background: '#666', marginTop: '15px' }}>다시 하기</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const mainBtn: React.CSSProperties    = { width: '100%', padding: '15px', background: '#1a237e', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' };
const inputStyle: React.CSSProperties = { padding: '12px', border: '1px solid #ddd', borderRadius: '8px', width: '100%', boxSizing: 'border-box', fontSize: '1rem' };