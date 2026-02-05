// app/[username]/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { 
  doc, getDoc, 
  runTransaction, collection, serverTimestamp 
} from 'firebase/firestore';
import ChatBot from '@/components/ChatBot';
import Guestbook from '@/components/Guestbook';

export default function NameCard({ params }: { params: { username: string } }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 방문자 정보 (닉네임 저장용 - 결과 화면 표시에 사용)
  const [visitorName, setVisitorName] = useState('');

  // 모달 & 기능 상태
  const [activeModal, setActiveModal] = useState<'none'|'quiz'|'synergy'>('none');
  const [quizData, setQuizData] = useState<any>(null);
  const [currentQIdx, setCurrentQIdx] = useState(0); 
  const [score, setScore] = useState(0); 
  const [showResult, setShowResult] = useState(false); 

  const [synergyResult, setSynergyResult] = useState<any>(null);
  
  // 데이터 로드
  useEffect(() => {
    const fetchData = async () => {
      if (!params.username) return;
      const docRef = doc(db, "users", params.username);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setData(docSnap.data());
      }
      setLoading(false);
    };
    fetchData();
  }, [params.username]);

  // AI 활성화 여부
  const isAiEnabled = data?.aiEnabled !== false;
  const isChatbotEnabled = isAiEnabled && (data?.chatbotEnabled !== false);
  const isTranslationEnabled = isAiEnabled && (data?.translationEnabled !== false);
  const isQuizEnabled = isAiEnabled && (data?.quizEnabled !== false);
  const isSynergyEnabled = isAiEnabled && (data?.synergyEnabled !== false);

  // JSON 파싱 헬퍼
  const parseSafeJson = (text: string) => {
      try {
          return JSON.parse(text);
      } catch (e) {
          try {
              const match = text.match(/\{[\s\S]*\}/); 
              if (match) return JSON.parse(match[0]);
              throw new Error("No JSON found");
          } catch (e2) {
              console.error("JSON Parsing Error:", text);
              return null;
          }
      }
  };

  // 🔥 [수정] 닉네임 입력 함수 (매번 입력받도록 변경)
  const checkVisitorName = () => {
      // 기존: if (visitorName) return visitorName; (삭제됨)
      
      const name = prompt("결과 저장에 사용할 닉네임을 입력해주세요! 😊");
      if (name) {
          setVisitorName(name); // 입력받은 이름을 상태에 업데이트
          return name;
      }
      return null; // 취소 시 null 반환
  };

  // API 호출
  const callAiApi = async (mode: string, extraData: any = {}) => {
    if (!data) return;
    const cost = mode === 'translate' ? 1 : 3; 
    
    if ((data.credits || 0) < cost) { 
        alert("일일 AI 사용량이 초과되었습니다. (관리자에게 문의해주세요)"); 
        return null; 
    }
    
    setLoading(true);
    try {
      const userRef = doc(db, "users", params.username);
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw "User not found";
        const currentCredits = userDoc.data().credits || 0;
        if (currentCredits < cost) throw "Not enough credits";
        transaction.update(userRef, { credits: currentCredits - cost });
        const newLogRef = doc(collection(db, "users", params.username, "logs"));
        transaction.set(newLogRef, { type: '사용', amount: -cost, reason: `AI 기능(${mode})`, date: serverTimestamp() });
      });

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, context: data, username: params.username, ...extraData }),
      });
      const result = await res.json();
      return result.reply; 
    } catch (error) { console.error(error); alert("잠시 후 다시 시도해주세요."); return null; } 
    finally { setLoading(false); }
  };

  // --- 기능 핸들러 ---

  const handleTranslate = async () => {
    const reply = await callAiApi('translate', { targetLang: 'en' });
    if (reply) { 
        const parsed = parseSafeJson(reply);
        if (parsed) { setData(parsed); alert("Translated!"); }
    }
  };

  const handleQuiz = async () => {
    // 1. 이름부터 물어보기
    const name = checkVisitorName();
    if (!name) return;

    // 2. API 호출
    const reply = await callAiApi('quiz');
    if (reply) {
        const parsed = parseSafeJson(reply);
        if (parsed && parsed.questions && parsed.questions.length > 0) {
            setQuizData(parsed);
            setCurrentQIdx(0);
            setScore(0);
            setShowResult(false);
            setActiveModal('quiz');
        } else {
            alert("문제를 불러오지 못했습니다.");
        }
    }
  };

  const handleSynergy = async () => {
    // 1. 이름부터 물어보기
    const name = checkVisitorName();
    if (!name) return;
    
    // 2. MBTI 물어보기
    const mbti = prompt("정확한 분석을 위해 MBTI를 알려주세요! (예: ENFP) - 모르면 '몰라' 입력");
    
    const reply = await callAiApi('synergy', { visitorData: { name, mbti } });
    if (reply) {
        const parsed = parseSafeJson(reply);
        if (parsed) {
            setSynergyResult(parsed);
            setActiveModal('synergy');
        } else {
            alert("분석 결과를 가져오지 못했습니다.");
        }
    }
  };

  // 퀴즈 정답 처리
  const handleAnswer = (idx: number) => {
      const correct = quizData.questions[currentQIdx].answer;
      if (idx === correct) {
          alert("⭕ 정답!");
          setScore(prev => prev + 1);
      } else {
          alert(`❌ 땡! 정답은 ${correct+1}번입니다.`);
      }

      if (currentQIdx < quizData.questions.length - 1) {
          setCurrentQIdx(prev => prev + 1);
      } else {
          setShowResult(true);
      }
  };

  const copyResult = () => {
      const text = `[${data.name} 찐친고사]\n${visitorName}님의 점수는 ${score * 20}점!\n너도 한번 풀어봐 👉 ${window.location.href}`;
      navigator.clipboard.writeText(text).then(()=>alert("복사완료! 친구에게 공유하세요.")).catch(()=>alert("복사 실패"));
  };

  if (loading && !data) return <div style={{padding:'50px', textAlign:'center'}}>로딩 중...</div>;
  if (!data) return <div style={{padding:'50px', textAlign:'center'}}>존재하지 않는 명함입니다.</div>;

  const config = data.section_config || {};
  const colors = data.colors || { background: '#ffffff', theme: '#1a237e' };
  const order = data.section_order || [];
  const renderOrder = order.filter((id:string) => id !== 'profile');
  const getSecInfo = (id: string, defaultTitle: string, defaultOpen: boolean) => {
      const conf = config[id] || {};
      return { title: conf.title || defaultTitle, defaultOpen: conf.isDefaultOpen ?? defaultOpen };
  };

  return (
    <div style={{maxWidth: '480px', margin: '0 auto', background: colors.background, minHeight: '100vh', paddingBottom:'80px', boxShadow:'0 0 20px rgba(0,0,0,0.05)', position:'relative'}}>
      
      {/* 프로필 */}
      {(() => {
          const info = getSecInfo('profile', '기본 정보', true);
          return (
            <div style={{padding: '50px 20px 40px', textAlign: 'center', background: colors.theme, color: 'white', borderRadius: '0 0 30px 30px', marginBottom:'30px'}}>
                <div style={{width: '110px', height: '110px', borderRadius: '50%', border: '4px solid rgba(255,255,255,0.3)', margin: '0 auto 15px', overflow: 'hidden', background:'white'}}>
                    <img src={data.profile_img || "/profile_default.jpg"} alt="profile" style={{width:'100%', height:'100%', objectFit:'cover'}} />
                </div>
                <h1 style={{fontSize: '1.8rem', margin: '0 0 8px 0', fontWeight: '800'}}>{data.name}</h1>
                <p style={{fontSize: '0.95rem', opacity: 0.9, margin: 0}}>{data.role}</p>
                {isTranslationEnabled && (<button onClick={handleTranslate} style={{marginTop:'15px', padding:'6px 14px', borderRadius:'20px', border:'1px solid rgba(255,255,255,0.4)', background:'rgba(255,255,255,0.1)', color:'white', cursor:'pointer', fontSize:'0.75rem'}}>🌐 English</button>)}
                {info.defaultOpen && (<div style={{marginTop:'20px', fontSize:'0.9rem', opacity:0.9, lineHeight:'1.5', background:'rgba(255,255,255,0.1)', padding:'15px', borderRadius:'10px'}}>{data.intro}</div>)}
            </div>
          );
      })()}

      {/* 흥미 기능 버튼 */}
      <div style={{padding:'0 20px', marginBottom:'25px', display:'flex', gap:'10px'}}>
          {isQuizEnabled && (
            <button onClick={handleQuiz} style={funBtnStyle}>
                🧠<br/>찐친 고사
            </button>
          )}
          {isSynergyEnabled && (
            <button onClick={handleSynergy} style={{...funBtnStyle, background:'#fff0f6', color:'#d6336c', border:'1px solid #ffadd2'}}>
                💘<br/>MBTI 궁합
            </button>
          )}
      </div>

      {renderOrder.map((sectionId: string) => {
          if (sectionId === 'links' && data.links?.length > 0) { const info = getSecInfo('links', '링크', true); return (<div key="links" style={secWrapStyle}><Section title={info.title} defaultOpen={info.defaultOpen}>{data.links.map((link: any, i: number) => (<a key={i} href={link.value.startsWith('http') ? link.value : `tel:${link.value}`} target="_blank" style={linkStyle}><span style={{marginRight: '12px', fontSize: '1.2rem'}}>{link.type === 'mobile' ? '📞' : '🔗'}</span><span style={{fontWeight: '600'}}>{link.value}</span></a>))}</Section></div>); }
          if (sectionId === 'history' && data.history?.length > 0) { const info = getSecInfo('history', '연혁 (History)', true); return (<div key="history" style={secWrapStyle}><Section title={info.title} defaultOpen={info.defaultOpen}><div style={{borderLeft:`2px solid ${colors.theme}33`, paddingLeft:'15px', marginLeft:'5px'}}>{data.history.map((item: any, idx: number) => (<div key={idx} style={{marginBottom:'20px'}}><span style={{color: colors.theme, fontWeight: '800', fontSize: '0.85rem'}}>{item.date}</span><h3 style={{margin:'4px 0', fontSize:'1rem'}}>{item.title}</h3><p style={{margin:0, color:'#666', fontSize:'0.9rem'}}>{item.desc}</p></div>))}</div></Section></div>); }
          if (sectionId === 'projects' && data.projects?.length > 0) { const info = getSecInfo('projects', '프로젝트', false); return (<div key="projects" style={secWrapStyle}><Section title={info.title} defaultOpen={info.defaultOpen}>{data.projects.map((item: any, idx: number) => (<div key={idx} style={{marginBottom:'15px', background:'#f9f9f9', padding:'15px', borderRadius:'10px'}}><h3 style={{margin:'0 0 5px 0', fontSize:'1rem'}}>{item.link ? <a href={item.link} target="_blank" style={{color:'#1565c0'}}>{item.title} 🔗</a> : item.title}</h3><p style={{margin:0, color:'#555', fontSize:'0.9rem'}}>{item.desc}</p></div>))}  </Section></div>); }
          const customSec = data.custom_sections?.find((c:any) => c.id === sectionId); if (customSec) { const info = getSecInfo(sectionId, customSec.title, false); return (<div key={sectionId} style={secWrapStyle}><Section title={info.title} defaultOpen={info.defaultOpen}>{customSec.items.map((item:any, i:number)=>(<div key={i} style={{marginBottom:'15px'}}><h3 style={{margin:'0 0 5px 0', fontSize:'1rem'}}>{item.title}</h3><p style={{margin:0, color:'#666', fontSize:'0.9rem'}}>{item.desc}</p></div>))}</Section></div>); }
          return null;
      })}

      <div style={{padding:'20px'}}>
        {isChatbotEnabled && <ChatBot context={data} username={params.username} />}
        <div style={{height:'30px'}}></div>
        <Guestbook username={params.username} />
      </div>

      {/* --- 퀴즈 모달 --- */}
      {activeModal === 'quiz' && quizData && quizData.questions && (
        <div style={modalOverlay}>
            <div style={{...modalContent, textAlign:'center'}}>
                {!showResult ? (
                    quizData.questions[currentQIdx] ? (
                        <>
                            <div style={{marginBottom:'20px', fontSize:'0.9rem', color:'#666'}}>
                                문제 {currentQIdx + 1} / {quizData.questions.length}
                            </div>
                            <h3 style={{marginBottom:'30px', fontSize:'1.1rem', wordBreak:'keep-all'}}>
                                {quizData.questions[currentQIdx].q}
                            </h3>
                            <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                                {quizData.questions[currentQIdx].options.map((opt:string, i:number)=>(
                                    <button 
                                        key={i} 
                                        onClick={()=>handleAnswer(i)}
                                        style={{padding:'12px', borderRadius:'10px', border:'1px solid #ddd', background:'white', cursor:'pointer', fontSize:'0.95rem'}}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : (<div>문제 로딩 오류</div>)
                ) : (
                    <div style={{animation:'fadeIn 0.5s'}}>
                        <h2 style={{color: colors.theme, margin:'0 0 10px 0'}}>💯 성적표</h2>
                        <div style={{fontSize:'3rem', marginBottom:'10px'}}>
                            {score === 5 ? '🥇' : score >= 3 ? '🥈' : '🥉'}
                        </div>
                        <h3 style={{margin:0}}>{score * 20}점</h3>
                        <p style={{color:'#666', fontSize:'0.9rem', marginBottom:'20px'}}>
                            수험생: <strong>{visitorName}</strong>님
                        </p>
                        <button onClick={copyResult} style={{...funBtnStyle, background: colors.theme, color:'white', border:'none', marginBottom:'10px'}}>
                            결과 자랑하기 📋
                        </button>
                        <button onClick={()=>setActiveModal('none')} style={{...closeBtn, marginTop:0}}>닫기</button>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* --- 궁합 모달 --- */}
      {activeModal === 'synergy' && synergyResult && (
        <div style={modalOverlay}>
            <div style={{...modalContent, textAlign:'center'}}>
                <div style={{fontSize:'3rem', marginBottom:'10px'}}>💘</div>
                <h2 style={{margin:'0 0 10px 0', color:'#d6336c'}}>{synergyResult.score}점</h2>
                <h3 style={{margin:'0 0 20px 0', wordBreak:'keep-all'}}>{synergyResult.title}</h3>
                <p style={{background:'#fff0f6', padding:'15px', borderRadius:'10px', fontSize:'0.95rem', lineHeight:'1.6', color:'#333', textAlign:'left', maxHeight:'200px', overflowY:'auto'}}>
                    {synergyResult.reason}
                </p>
                <div style={{fontSize:'0.8rem', color:'#888', marginTop:'10px'}}>{visitorName}님과의 결과</div>
                <button onClick={()=>setActiveModal('none')} style={closeBtn}>닫기</button>
            </div>
        </div>
      )}

      {loading && <div style={modalOverlay}><div style={{color:'white', fontWeight:'bold', fontSize:'1.2rem'}}>🤖 AI 분석 중...</div></div>}
    </div>
  );
}

const Section = ({ title, children, defaultOpen }: any) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div style={{border:'1px solid #eee', borderRadius:'12px', overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,0.02)', background:'white'}}>
            <div onClick={()=>setIsOpen(!isOpen)} style={{padding:'15px', background:'white', fontWeight:'bold', display:'flex', justifyContent:'space-between', cursor:'pointer', borderBottom: isOpen ? '1px solid #f0f0f0' : 'none'}}>
                {title} <span>{isOpen ? '▲' : '▼'}</span>
            </div>
            {isOpen && <div style={{padding:'20px'}}>{children}</div>}
        </div>
    );
};

// 스타일
const secWrapStyle = {padding:'0 20px', marginBottom:'20px'};
const linkStyle = {display: 'flex', alignItems: 'center', padding: '15px', marginBottom:'10px', background: 'white', border: '1px solid #eee', borderRadius: '12px', textDecoration: 'none', color: '#333', boxShadow: '0 2px 5px rgba(0,0,0,0.02)'};
const funBtnStyle = {flex:1, padding:'15px', borderRadius:'15px', border:'1px solid #e3f2fd', background:'#f0f9ff', color:'#0288d1', fontWeight:'bold' as 'bold', cursor:'pointer', lineHeight:'1.4', fontSize:'0.9rem'};
const modalOverlay = {position:'fixed' as 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', zIndex:9999, display:'flex', justifyContent:'center', alignItems:'center'};
const modalContent = {background:'white', padding:'25px', borderRadius:'15px', width:'85%', maxWidth:'320px', maxHeight:'80vh', overflow:'hidden', display:'flex', flexDirection:'column' as 'column'};
const closeBtn = {marginTop:'15px', padding:'12px', width:'100%', background:'#333', color:'white', border:'none', borderRadius:'10px', fontWeight:'bold' as 'bold', cursor:'pointer'};