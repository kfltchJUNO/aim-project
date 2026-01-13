"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';

type Props = {
  context: any; 
  username: string; 
  activeFeature: 'quiz' | 'synergy' | null; 
  onClose: () => void; 
};

export default function FunFeatures({ context, username, activeFeature, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  
  // 퀴즈 상태
  const [quizVisitorName, setQuizVisitorName] = useState(''); // 방문자 이름
  const [quizData, setQuizData] = useState<any[]>([]);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [quizResult, setQuizResult] = useState<{score: number, rank: string} | null>(null);

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

  const callApi = async (mode: 'quiz' | 'synergy', additionalData?: any) => {
    try {
      setLoading(true);
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", username);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("사용자 없음");
        const current = userDoc.data().credits || 0;
        
        if (current < 3) throw new Error("토큰 부족");
        
        transaction.update(userRef, { credits: current - 3 });
        const logRef = doc(collection(db, "users", username, "logs"));
        transaction.set(logRef, {
          type: '사용',
          amount: -3,
          reason: mode === 'quiz' ? '찐친고사' : '궁합분석',
          date: serverTimestamp()
        });
      });

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, context, visitorData: additionalData }),
      });
      const data = await res.json();
      return JSON.parse(data.reply);

    } catch (error: any) {
      if (error.message === "토큰 부족") {
          alert("서비스 점검 중입니다. (Limit Reached)");
      } else {
          alert("일시적인 오류가 발생했습니다.");
      }
      onClose();
      return null;
    } finally {
      setLoading(false);
    }
  };

  // 1. 퀴즈 시작 (이름 체크 추가)
  const startQuiz = async () => {
    if(!quizVisitorName.trim()) return alert("이름이나 닉네임을 입력해주세요!");
    if(!confirm(`'${quizVisitorName}'님, 찐친고사를 시작하시겠습니까?`)) return;
    
    const res = await callApi('quiz');
    if (res && res.questions) {
      setQuizData(res.questions);
    }
  };

  const handleAnswer = (choiceIdx: number) => {
    const newAns = [...userAnswers, choiceIdx];
    setUserAnswers(newAns);
    if (currentQIdx < 9) {
      setCurrentQIdx(currentQIdx + 1);
    } else {
      let correct = 0;
      quizData.forEach((q, i) => { if(q.answer === newAns[i]) correct++; });
      const score = correct * 10;
      let rank = "노력 요망 😅";
      if(score === 100) rank = "💖 영혼의 단짝";
      else if(score >= 80) rank = "🔥 찐친 인증";
      else if(score >= 60) rank = "🙂 친한 사이";
      
      setQuizResult({ score, rank });
    }
  };

  // 2. 궁합 시작
  const startSynergy = async () => {
    if(!visitorData.name || !visitorData.mbti) return alert("정보를 입력해주세요!");
    if(!confirm("궁합 분석을 시작하시겠습니까?")) return;
    const res = await callApi('synergy', visitorData);
    if (res) setSynergyResult(res);
  };

  if (!activeFeature) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.7)', zIndex: 9999,
      display: 'flex', justifyContent: 'center', alignItems: 'center', padding:'20px'
    }}>
      <div style={{
        background: 'white', width: '100%', maxWidth: '400px', borderRadius: '20px',
        overflow: 'hidden', position: 'relative', boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column'
      }}>
        
        <button onClick={onClose} style={{
          position: 'absolute', top: '15px', right: '15px',
          background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', zIndex: 10
        }}>×</button>

        {/* 퀴즈 UI */}
        {activeFeature === 'quiz' && (
          <div style={{padding: '30px 20px', flex:1, overflowY:'auto'}}>
            <h2 style={{textAlign:'center', margin:'0 0 20px', color:'#1a237e'}}>📝 찐친 능력 고사</h2>
            
            {/* 1. 이름 입력 및 시작 화면 */}
            {!loading && quizData.length === 0 && (
              <div style={{textAlign:'center'}}>
                <p style={{marginBottom:'20px', color:'#555'}}>
                  명함 주인 <strong>{context.name}</strong>님에 대해<br/>
                  얼마나 알고 계신가요?
                </p>
                
                {/* 이름 입력칸 추가 */}
                <input 
                    placeholder="도전자의 이름/닉네임" 
                    value={quizVisitorName}
                    onChange={(e)=>setQuizVisitorName(e.target.value)}
                    style={{...inputStyle, marginBottom:'10px', textAlign:'center'}}
                />

                <button onClick={startQuiz} style={mainBtn}>도전하기</button>
              </div>
            )}

            {loading && <div style={{textAlign:'center', padding:'40px'}}>시험지를 인쇄하고 있습니다...<br/>(AI 문제 출제 중 🤖)</div>}

            {/* 문제 풀이 화면 */}
            {!loading && quizData.length > 0 && !quizResult && (
              <div>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px', color:'#888', fontSize:'0.9rem'}}>
                  <span>{quizVisitorName}님의 도전</span>
                  <span>{currentQIdx + 1} / 10</span>
                </div>
                <div style={{background:'#eee', height:'6px', borderRadius:'3px', marginBottom:'25px'}}>
                   <div style={{width:`${(currentQIdx+1)*10}%`, background:'#1a237e', height:'100%', borderRadius:'3px', transition:'width 0.3s'}}></div>
                </div>
                <h3 style={{fontSize:'1.2rem', marginBottom:'20px', lineHeight:'1.4'}}>Q. {quizData[currentQIdx].q}</h3>
                <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                  {quizData[currentQIdx].options.map((opt:string, idx:number) => (
                    <button key={idx} onClick={()=>handleAnswer(idx)} style={{
                      padding:'15px', border:'1px solid #ddd', borderRadius:'10px',
                      background:'white', textAlign:'left', cursor:'pointer', fontSize:'1rem',
                      transition:'all 0.2s'
                    }} 
                    onMouseOver={(e)=>e.currentTarget.style.background='#f5f5f5'}
                    onMouseOut={(e)=>e.currentTarget.style.background='white'}
                    >
                      {idx+1}. {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 결과 인증서 화면 */}
            {quizResult && (
              <div style={{
                border:'8px double #D4AF37', padding:'20px', borderRadius:'10px',
                textAlign:'center', background:'#fffbf0', position:'relative'
              }}>
                <div style={{fontSize:'0.9rem', letterSpacing:'2px', marginBottom:'10px', fontWeight:'bold', color:'#888'}}>CERTIFICATE OF FRIENDSHIP</div>
                <h2 style={{fontSize:'1.8rem', margin:'10px 0', fontFamily:'serif', color:'#333'}}>찐친 인증서</h2>
                
                <p style={{margin:'20px 0', fontSize:'1rem'}}>
                  성명: <strong>{quizVisitorName}</strong> 님<br/>
                  영역: <strong>{context.name} 탐구 영역</strong>
                </p>

                <div style={{margin:'30px 0'}}>
                   <div style={{fontSize:'3.5rem', fontWeight:'900', color:'#D4AF37', textShadow:'2px 2px 0px rgba(0,0,0,0.1)'}}>
                     {quizResult.score}점
                   </div>
                   <div style={{fontSize:'1.2rem', fontWeight:'bold', color:'#c62828', marginTop:'5px'}}>
                     [{quizResult.rank}]
                   </div>
                </div>

                <p style={{fontSize:'0.9rem', color:'#666'}}>
                  위 사람은 {context.name}님에 대한<br/>
                  관심과 애정을 증명하였기에<br/>
                  이 증서를 수여합니다.
                </p>
                
                <div style={{marginTop:'20px', fontSize:'0.8rem', color:'#999'}}>
                  {new Date().toLocaleDateString()}
                </div>

                <div style={{
                    position:'absolute', bottom:'20px', right:'20px', 
                    width:'60px', height:'60px', border:'3px solid #c62828', borderRadius:'50%',
                    color:'#c62828', display:'flex', alignItems:'center', justifyContent:'center',
                    fontWeight:'bold', transform:'rotate(-15deg)', fontSize:'0.9rem', opacity:0.8
                }}>
                    참잘함
                </div>
              </div>
            )}
          </div>
        )}

        {/* 궁합 UI (이전과 동일) */}
        {activeFeature === 'synergy' && (
          <div style={{padding: '30px 20px', flex:1, overflowY:'auto'}}>
             <h2 style={{textAlign:'center', margin:'0 0 20px', color:'#e91e63'}}>💘 케미 분석기</h2>
             {!loading && !synergyResult && (
               <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                 <p style={{textAlign:'center', color:'#666', marginBottom:'10px'}}>간단한 정보를 입력하면<br/>AI가 궁합을 분석해드려요!</p>
                 <input placeholder="이름 (또는 닉네임)" value={visitorData.name} onChange={e=>setVisitorData({...visitorData, name:e.target.value})} style={inputStyle} />
                 <input placeholder="MBTI (예: ENFP)" value={visitorData.mbti} onChange={e=>setVisitorData({...visitorData, mbti:e.target.value})} style={inputStyle} />
                 <input placeholder="직업/관심사 (선택)" value={visitorData.job} onChange={e=>setVisitorData({...visitorData, job:e.target.value})} style={inputStyle} />
                 <button onClick={startSynergy} style={{...mainBtn, background:'#e91e63', marginTop:'10px'}}>궁합 결과 보기</button>
               </div>
             )}
             {loading && <div style={{textAlign:'center', padding:'40px'}}>별자리를 이어보는 중...✨</div>}
             {synergyResult && (
               <div style={{textAlign:'center', border:'2px dashed #f8bbd0', borderRadius:'15px', padding:'20px', background:'#fff0f5'}}>
                  <div style={{fontSize:'4rem', fontWeight:'bold', color:'#e91e63', marginBottom:'10px'}}>{synergyResult.score}점</div>
                  <h3 style={{fontSize:'1.3rem', margin:'0 0 15px 0'}}>"{synergyResult.title}"</h3>
                  <div style={{background:'white', padding:'15px', borderRadius:'10px', textAlign:'left'}}>{synergyResult.reason}</div>
                  <button onClick={()=>setSynergyResult(null)} style={{...mainBtn, background:'#666', marginTop:'15px'}}>다시 하기</button>
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
}

const mainBtn = { width:'100%', padding:'15px', background:'#1a237e', color:'white', border:'none', borderRadius:'10px', fontSize:'1rem', fontWeight:'bold' as 'bold', cursor:'pointer' };
const inputStyle = { padding:'12px', border:'1px solid #ddd', borderRadius:'8px', width:'100%', boxSizing:'border-box' as 'border-box' };