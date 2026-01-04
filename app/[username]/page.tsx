// app/[username]/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import ChatBot from '@/components/ChatBot';
import Guestbook from '@/components/Guestbook';

// MBTI 리스트
const mbtiList = ["ISTJ", "ISFJ", "INFJ", "INTJ", "ISTP", "ISFP", "INFP", "INTP", "ESTP", "ESFP", "ENFP", "ENTP", "ESTJ", "ESFJ", "ENFJ", "ENTJ"];

// [헬퍼 함수] 링크 타입에 따른 아이콘 반환
const getLinkIcon = (type: string) => {
    switch(type) {
        case 'mobile': return '📱';
        case 'tel': return '☎️';
        case 'email': return '📧';
        case 'kakao': return '💬';
        case 'insta': return '📷';
        case 'youtube': return '📺';
        case 'web': return '🏠';
        default: return '🔗';
    }
};

// [헬퍼 함수] 링크 href 처리 (전화, 이메일 등)
const getLinkHref = (type: string, value: string) => {
    if (type === 'mobile' || type === 'tel') return `tel:${value}`;
    if (type === 'email') return `mailto:${value}`;
    if (!value.startsWith('http')) return `https://${value}`;
    return value;
};

// [컴포넌트] 접기/펼치기 섹션
const Section = ({ title, children, defaultOpen = false }: any) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <section className="content-section" style={{ marginBottom: '15px' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '0', textAlign: 'left' }}
      >
        <h2 className="section-title" style={{ marginBottom: 0, borderBottom: 'none', fontSize: '1.2rem', color: '#1a237e', fontWeight: 'bold' }}>{title}</h2>
        <span style={{ fontSize: '1.2rem', color: '#1a237e', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.3s' }}>▼</span>
      </button>
      
      {isOpen && (
        <div style={{ marginTop: '15px', animation: 'fadeIn 0.3s' }}>
          {children}
        </div>
      )}
      <hr style={{ margin: '15px 0', border: 'none', borderBottom: '1px solid #eee' }}/>
    </section>
  );
};

export default function NameCard({ params }: { params: { username: string } }) {
  // 데이터 상태
  const [originalData, setOriginalData] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // AI 로딩 상태 (번역용)
  const [aiLoading, setAiLoading] = useState(false);

  // 찐친 고사 상태
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizData, setQuizData] = useState<any[]>([]);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);

  // AI 궁합 상태
  const [showSynergyModal, setShowSynergyModal] = useState(false);
  const [synergyInput, setSynergyInput] = useState({ mbti: 'INFJ', job: '', interest: '', power: '칼퇴 요정 🧚' });
  const [synergyResult, setSynergyResult] = useState<any>(null);
  const [isSynergyLoading, setIsSynergyLoading] = useState(false);

  // 1. 데이터 불러오기
  useEffect(() => {
    const fetchData = async () => {
      try {
        const docRef = doc(db, "users", params.username);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const userData = docSnap.data();
          setOriginalData(userData);
          setData(userData);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.username]);

  // 2. 다국어 번역 요청
  const handleTranslate = async (lang: string) => {
    if (lang === 'KO') {
      setData(originalData);
      return;
    }
    if (aiLoading) return;
    setAiLoading(true);
    
    try {
      const contentToTranslate = {
        name: originalData.name,
        role: originalData.role,
        intro: originalData.intro,
        history_titles: originalData.history?.map((h:any) => h.title) || [],
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: contentToTranslate, mode: 'translate', targetLang: lang })
      });
      
      const resData = await res.json();
      const translated = JSON.parse(resData.reply);

      setData((prev: any) => ({
        ...prev,
        name: translated.name,
        role: translated.role,
        intro: translated.intro,
        history: prev.history.map((h:any, i:number) => ({
            ...h,
            title: translated.history_titles[i] || h.title
        }))
      }));

    } catch (e) { 
      alert("번역 중 오류가 발생했습니다."); 
    } finally { setAiLoading(false); }
  };

  // 3. 찐친 고사 시작
  const handleStartQuiz = async () => {
    setShowQuizModal(true);
    if (quizData.length > 0) return; // 이미 로드했으면 재사용

    setIsQuizLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: originalData, mode: 'quiz' })
      });
      const data = await res.json();
      const parsed = JSON.parse(data.reply);
      setQuizData(parsed.questions);
    } catch (e) {
      alert("퀴즈 출제 중 오류가 발생했습니다.");
      setShowQuizModal(false);
    } finally {
      setIsQuizLoading(false);
    }
  };

  // 퀴즈 정답 체크
  const handleAnswer = (selectedIdx: number) => {
    if (selectedIdx === quizData[currentQIdx].answer) {
      setScore(prev => prev + 1);
    }
    
    if (currentQIdx + 1 < quizData.length) {
      setCurrentQIdx(prev => prev + 1);
    } else {
      setQuizFinished(true);
    }
  };

  // 4. AI 궁합 분석 요청
  const handleSynergy = async () => {
    if (!synergyInput.job || !synergyInput.interest) return alert("직업과 관심사를 입력해주세요!");
    
    setIsSynergyLoading(true);
    setSynergyResult(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          context: originalData, 
          visitorData: synergyInput, 
          mode: 'synergy' 
        })
      });
      const data = await res.json();
      setSynergyResult(JSON.parse(data.reply));
    } catch (e) {
      alert("분석 중 오류가 발생했습니다.");
    } finally {
      setIsSynergyLoading(false);
    }
  };

  if (loading) return <div className="status-msg">명함을 불러오는 중... ⏳</div>;
  if (!data) return <div className="status-msg">존재하지 않는 명함입니다. 😢</div>;

  return (
    <div className="main-wrapper">
      <div className="container" style={{ paddingBottom: '100px', position: 'relative' }}>
        
        {/* === [상단 버튼 영역] === */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '5px' }}>
                <button onClick={() => handleTranslate('KO')} style={btnStyle}>🇰🇷</button>
                <button onClick={() => handleTranslate('English')} style={btnStyle}>🇺🇸</button>
                <button onClick={() => handleTranslate('Chinese')} style={btnStyle}>🇨🇳</button>
            </div>
            <div style={{ display: 'flex', gap: '5px' }}>
                <button onClick={handleStartQuiz} style={{ ...btnStyle, backgroundColor: '#d32f2f', color: 'white', border: 'none' }}>
                    💯 찐친 고사
                </button>
                <button onClick={() => setShowSynergyModal(true)} style={{ ...btnStyle, backgroundColor: '#ff6f00', color: 'white', border: 'none' }}>
                    🧬 AI 궁합
                </button>
            </div>
        </div>

        {/* 로딩 오버레이 (번역) */}
        {aiLoading && (
            <div style={{ 
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
                background: 'rgba(255,255,255,0.8)', zIndex: 10, display: 'flex', 
                justifyContent: 'center', alignItems: 'center', borderRadius: '24px', fontWeight: 'bold' 
            }}>
                AI가 번역 중입니다... 🌍
            </div>
        )}

        {/* 1. 프로필 섹션 */}
        <header className="profile-section">
          <div className="profile-img-container">
            <img src={data.profile_img || "/profile_default.jpg"} alt="프로필" className="profile-img" onError={(e)=>e.currentTarget.src='https://placehold.co/150'}/>
          </div>
          <h1 className="name">{data.name}</h1>
          <p className="role">{data.role}</p>

          {/* ▼▼▼ [신규] 연락처/링크 버튼 목록 영역 ▼▼▼ */}
          {data.links && data.links.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '20px' }}>
                {data.links.map((link: any, idx: number) => (
                    <a 
                        key={idx}
                        href={getLinkHref(link.type, link.value)}
                        target={link.type === 'mobile' || link.type === 'tel' || link.type === 'email' ? "_self" : "_blank"}
                        rel="noopener noreferrer"
                        style={{
                            textDecoration: 'none',
                            display: 'flex', alignItems: 'center', gap: '5px',
                            background: '#f5f5f5', padding: '8px 12px', borderRadius: '20px',
                            fontSize: '0.9rem', color: '#333', border: '1px solid #ddd',
                            transition: '0.2s', fontWeight: 'bold'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = '#e3f2fd'; e.currentTarget.style.borderColor = '#2196f3'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = '#f5f5f5'; e.currentTarget.style.borderColor = '#ddd'; }}
                    >
                        <span>{getLinkIcon(link.type)}</span>
                        <span>{link.type === 'insta' ? 'Instagram' : link.type === 'youtube' ? 'YouTube' : link.value}</span>
                    </a>
                ))}
            </div>
          )}
        </header>

        {/* 2. 소개 */}
        <section className="intro-section">
          <p className="intro-text">{data.intro}</p>
        </section>

        <hr style={{ margin: '30px 0', border: 'none', borderBottom: '2px solid #f0f2f5' }}/>

        {/* 3. 접기/펼치기 섹션들 */}
        {data.history && (
          <Section title="🚩 연혁 (Experience)" defaultOpen={true}>
            <div className="timeline">
              {data.history.map((item: any, idx: number) => (
                <div key={idx} className="list-item">
                  <span style={{color: '#1a237e', fontWeight: 'bold', fontSize: '0.9rem', display:'block', marginBottom:'4px'}}>{item.date}</span>
                  <h3>{item.title}</h3>
                  <p className="list-desc">{item.desc}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {data.certifications && (
          <Section title="📜 자격증 (Certifications)">
            <ul>
              {data.certifications.map((item: any, idx: number) => (
                <li key={idx} className="list-item">
                  <h3>{item.title}</h3>
                  <p className="list-desc">{item.desc}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* ▼▼▼ [신규] 개발한 학습 도구 (Projects) 섹션 ▼▼▼ */}
        {data.projects && (
          <Section title="🛠️ 개발한 학습 도구 (Tools)" defaultOpen={true}>
            <ul>
              {data.projects.map((item: any, idx: number) => (
                <li key={idx} className="list-item">
                  <h3 style={{display:'flex', alignItems:'center', gap:'5px'}}>
                    {item.link ? (
                        <a 
                            href={item.link} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            style={{color:'#2979ff', textDecoration:'none', borderBottom:'1px dashed #2979ff'}}
                        >
                            {item.title} 🔗
                        </a>
                    ) : (
                        item.title
                    )}
                  </h3>
                  <p className="list-desc">{item.desc}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}
        {/* ▲▲▲ */}

        {data.research && (
          <Section title="📚 연구 실적 (Research)">
            <ul>
              {data.research.map((item: any, idx: number) => (
                <li key={idx} className="list-item">
                  <h3>{item.title}</h3>
                  <p className="list-desc">{item.desc}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {data.awards && (
          <Section title="🏆 수상 경력 (Awards)">
            <ul>
              {data.awards.map((item: any, idx: number) => (
                <li key={idx} className="list-item">
                  <h3>{item.title}</h3>
                  <p className="list-desc">{item.desc}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* 4. 방명록 */}
        <Guestbook username={params.username} />

      </div>

      {/* 5. 챗봇 컴포넌트 */}
      <ChatBot userData={originalData} />


      {/* === [모달 1] 찐친 고사 === */}
      {showQuizModal && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px'}}>
               <h3 style={{ fontSize: '1.2rem', color: '#d32f2f', fontWeight: 'bold' }}>💯 오준호 찐친 고사</h3>
               <button onClick={()=>{setShowQuizModal(false); setQuizFinished(false); setScore(0); setCurrentQIdx(0);}} style={{border:'none', background:'none', fontSize:'1.2rem', cursor:'pointer'}}>✕</button>
            </div>

            {isQuizLoading ? (
                <div style={{textAlign:'center', padding:'30px'}}>
                    <div style={{fontSize:'2rem', animation:'bounce 1s infinite'}}>📝</div>
                    <p style={{marginTop:'10px', color:'#555'}}>AI가 프로필을 정독하고<br/>문제를 출제 중입니다...</p>
                </div>
            ) : !quizFinished ? (
               // 문제 풀기 화면
               <div>
                 <div style={{marginBottom:'10px', color:'#666', fontSize:'0.9rem', fontWeight:'bold'}}>
                    문제 {currentQIdx + 1} / {quizData.length}
                 </div>
                 <h3 style={{marginBottom:'20px', lineHeight:'1.5', fontSize:'1.1rem'}}>
                    Q. {quizData[currentQIdx]?.q}
                 </h3>
                 <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                   {quizData[currentQIdx]?.options.map((opt:string, i:number)=>(
                       <button key={i} onClick={()=>handleAnswer(i)} style={optBtn}>
                           <span style={{color:'#d32f2f', fontWeight:'bold', marginRight:'8px'}}>{i+1}.</span> {opt}
                       </button>
                   ))}
                 </div>
               </div>
             ) : (
               // 결과 화면
               <div style={{textAlign:'center'}}>
                 {score === quizData.length ? (
                    <div style={{background:'#fffde7', padding:'20px', borderRadius:'15px', border:'2px solid #fbc02d', position:'relative', overflow:'hidden'}}>
                        <div style={{position:'absolute', top:'-10px', left:'-10px', fontSize:'4rem', opacity:0.1}}>👑</div>
                        <h2 style={{color:'#fbc02d', fontFamily:'serif', marginBottom:'5px'}}>🏆 찐친 인증서</h2>
                        <div style={{fontSize:'2.5rem', fontWeight:'bold', color:'#d32f2f', margin:'10px 0'}}>100점</div>
                        <p style={{fontSize:'0.95rem'}}>와우! 오준호 님보다 오준호 님을<br/>더 잘 아시는군요! 인정합니다. 👍</p>
                    </div>
                 ) : (
                    <div style={{padding:'20px'}}>
                        <div style={{fontSize:'3rem', marginBottom:'10px'}}>😅</div>
                        <h2 style={{fontSize:'1.8rem', fontWeight:'bold'}}>{score}점 / {quizData.length}점</h2>
                        <p style={{color:'#666', marginTop:'10px'}}>
                            조금 더 분발하세요!<br/>프로필을 다시 읽어보고 도전?
                        </p>
                    </div>
                 )}
                 <button 
                    onClick={()=>{setQuizFinished(false); setScore(0); setCurrentQIdx(0);}} 
                    style={{...synergyBtnStyle, marginTop:'20px', background:'#333'}}
                 >
                    다시 도전하기
                 </button>
               </div>
             )}
          </div>
        </div>
      )}

      {/* === [모달 2] AI 궁합 테스트 === */}
      {showSynergyModal && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px'}}>
               <h3 style={{ fontSize: '1.2rem', color: '#ff6f00', fontWeight: 'bold' }}>🧬 AI 업무 궁합 테스트</h3>
               <button onClick={()=>setShowSynergyModal(false)} style={{border:'none', background:'none', fontSize:'1.2rem', cursor:'pointer'}}>✕</button>
            </div>

            {!synergyResult ? (
              // [입력 화면]
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <p style={{fontSize:'0.9rem', color:'#666'}}>오준호님과 당신의 업무 시너지는 몇 점일까요?<br/>정보를 입력하면 AI가 분석해드립니다! (익명 보장)</p>
                
                <div>
                  <label style={labelStyle}>🤔 나의 MBTI</label>
                  <select 
                    value={synergyInput.mbti} 
                    onChange={(e)=>setSynergyInput({...synergyInput, mbti:e.target.value})}
                    style={inputStyle}
                  >
                    {mbtiList.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>💼 직업 / 하는 일</label>
                  <input 
                    placeholder="예: 마케터, 대학원생, 디자이너"
                    value={synergyInput.job} 
                    onChange={(e)=>setSynergyInput({...synergyInput, job:e.target.value})}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>❤️ 요즘 관심사</label>
                  <input 
                    placeholder="예: 생성형 AI, 주식, 맛집 탐방"
                    value={synergyInput.interest} 
                    onChange={(e)=>setSynergyInput({...synergyInput, interest:e.target.value})}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>⚡ 나의 업무 초능력</label>
                  <div style={{display:'flex', gap:'5px', flexWrap:'wrap'}}>
                    {['칼퇴 요정 🧚', '아이디어 뱅크 💡', '소통왕 🗣️', '꼼꼼 대마왕 📝', '추진력 불도저 🚜'].map(p => (
                        <button 
                          key={p} 
                          onClick={()=>setSynergyInput({...synergyInput, power: p})}
                          style={{
                              ...chipStyle, 
                              background: synergyInput.power === p ? '#ff6f00' : '#eee',
                              color: synergyInput.power === p ? 'white' : '#333'
                          }}
                        >
                            {p}
                        </button>
                    ))}
                  </div>
                </div>

                <button onClick={handleSynergy} disabled={isSynergyLoading} style={synergyBtnStyle}>
                  {isSynergyLoading ? "AI가 분석 중입니다... 🔮" : "결과 확인하기"}
                </button>
              </div>
            ) : (
              // [결과 화면]
              <div style={{textAlign:'center', animation:'fadeIn 0.5s'}}>
                <h2 style={{fontSize:'3rem', fontWeight:'800', color:'#ff6f00', margin:'10px 0'}}>
                    {synergyResult.score}점
                </h2>
                <h3 style={{fontSize:'1.1rem', fontWeight:'bold', marginBottom:'15px', color:'#333'}}>
                    "{synergyResult.title}"
                </h3>
                <div style={{background:'#fff3e0', padding:'15px', borderRadius:'10px', fontSize:'0.95rem', lineHeight:'1.6', textAlign:'left', color:'#555'}}>
                    {synergyResult.reason}
                </div>
                <button onClick={()=>setSynergyResult(null)} style={{...synergyBtnStyle, marginTop:'20px', background:'#333'}}>
                    다시 하기
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// --- CSS 스타일 ---
const btnStyle = { padding: '6px 12px', borderRadius: '15px', border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' as 'bold' };
const modalOverlayStyle = { position: 'fixed' as 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center' };
const modalContentStyle = { backgroundColor: 'white', padding: '25px', borderRadius: '20px', width: '90%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto' as 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' };
const labelStyle = { display: 'block', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '5px', color: '#555' };
const inputStyle = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem' };
const chipStyle = { padding: '6px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '0.85rem', transition: '0.2s' };
const synergyBtnStyle = { width: '100%', padding: '12px', background: '#ff6f00', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' };
const optBtn = { padding:'15px', borderRadius:'10px', border:'1px solid #ddd', background:'white', cursor:'pointer', textAlign:'left' as 'left', fontSize:'1rem' };