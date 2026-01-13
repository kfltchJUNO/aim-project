"use client";

import { useEffect, useState, CSSProperties } from 'react';
import { db } from '@/lib/firebase';
import { 
  doc, getDoc, 
  runTransaction, collection, serverTimestamp 
} from 'firebase/firestore';
import ChatBot from '@/components/ChatBot';
import Guestbook from '@/components/Guestbook';
import FunFeatures from '@/components/FunFeatures';

export default function NameCard({ params }: { params: { username: string } }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeFunFeature, setActiveFunFeature] = useState<'quiz' | 'synergy' | null>(null);
  
  // 🌐 번역 관련 상태
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [originalData, setOriginalData] = useState<any>(null); 
  const [isTranslated, setIsTranslated] = useState(false); 

  useEffect(() => {
    const fetchData = async () => {
      if (!params.username) return;
      const docRef = doc(db, "users", params.username);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const docData = docSnap.data();
        setData(docData);
        setOriginalData(docData); 
      }
      setLoading(false);
    };
    fetchData();
  }, [params.username]);

  // 🌐 번역 실행 로직
  const handleTranslate = async (langCode: string) => {
    setShowLangMenu(false); 
    if (!data) return;
    
    if(!confirm("언어를 변경하시겠습니까? (AI 번역)")) return;

    setLoading(true); 
    try {
        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "users", params.username);
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw new Error("사용자 없음");
            const current = userDoc.data().credits || 0;
            if (current < 1) throw new Error("토큰 부족");
            
            transaction.update(userRef, { credits: current - 1 });
            const logRef = doc(collection(db, "users", params.username, "logs"));
            transaction.set(logRef, { type: '사용', amount: -1, reason: `번역(${langCode})`, date: serverTimestamp() });
        });

        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                mode: 'translate', 
                targetLang: langCode, 
                context: originalData || data 
            }),
        });
        const result = await res.json();
        const translatedData = JSON.parse(result.reply);
        
        setData(translatedData); 
        setIsTranslated(true); 

    } catch (e: any) {
        if(e.message === "토큰 부족") alert("서비스 점검 중입니다. (Token Limit)");
        else alert("번역 중 오류가 발생했습니다.");
    } finally {
        setLoading(false);
    }
  };

  const handleRestore = () => {
      if (originalData) {
          setData(originalData);
          setIsTranslated(false);
      }
  };

  if (loading) return <div style={{padding:'50px', textAlign:'center'}}>로딩 중...</div>;
  if (!data) return <div style={{padding:'50px', textAlign:'center'}}>존재하지 않는 명함입니다.</div>;

  const isAiPlan = data.enable_ai === true;
  const config = data.section_config || {};
  const colors = data.colors || { background: '#ffffff', theme: '#1a237e' };
  const features = data.features || { quiz: false, synergy: false, translation: false };
  
  const order = data.section_order || [];
  const renderOrder = order.filter((id:string) => id !== 'profile');

  const getSecInfo = (id: string, defaultTitle: string, defaultOpen: boolean) => {
      const conf = config[id] || {};
      return { title: conf.title || defaultTitle, defaultOpen: conf.isDefaultOpen ?? defaultOpen };
  };

  return (
    <div style={{maxWidth: '480px', margin: '0 auto', background: colors.background, minHeight: '100vh', paddingBottom:'80px', boxShadow:'0 0 20px rgba(0,0,0,0.05)'}}>
      
      {/* 📌 프로필 섹션 */}
      {(() => {
          const info = getSecInfo('profile', '기본 정보', true);
          return (
            <div style={{padding: '50px 20px 40px', textAlign: 'center', background: colors.theme, color: 'white', borderRadius: '0 0 30px 30px', marginBottom:'30px'}}>
                
                {/* 🌟 프로필 이미지 & 좌우 버튼 */}
                <div style={{display:'flex', justifyContent:'center', alignItems:'center', gap:'20px', marginBottom:'15px'}}>
                    
                    {/* [좌측] 찐친고사 */}
                    {isAiPlan && features.quiz ? (
                        <button onClick={()=>setActiveFunFeature('quiz')} style={circleBtnStyle}>
                            <span style={{fontSize:'1.5rem'}}>📝</span>
                            <span style={{fontSize:'0.6rem', marginTop:'2px'}}>찐친고사</span>
                        </button>
                    ) : <div style={{width:'60px'}}></div> }

                    {/* 중앙 이미지 */}
                    <div style={{width: '110px', height: '110px', borderRadius: '50%', border: '4px solid rgba(255,255,255,0.3)', overflow: 'hidden', background:'white', flexShrink:0}}>
                        <img src={data.profile_img || "/profile_default.jpg"} alt="profile" style={{width:'100%', height:'100%', objectFit:'cover'}} />
                    </div>

                    {/* [우측] 궁합 */}
                    {isAiPlan && features.synergy ? (
                         <button onClick={()=>setActiveFunFeature('synergy')} style={circleBtnStyle}>
                            <span style={{fontSize:'1.5rem'}}>💘</span>
                            <span style={{fontSize:'0.6rem', marginTop:'2px'}}>궁합</span>
                         </button>
                    ) : <div style={{width:'60px'}}></div> }

                </div>

                <h1 style={{fontSize: '1.8rem', margin: '0 0 8px 0', fontWeight: '800'}}>{data.name}</h1>
                <p style={{fontSize: '0.95rem', opacity: 0.9, margin: 0}}>{data.role}</p>

                {/* 🌐 번역 버튼 영역 */}
                {isAiPlan && features.translation && (
                    <div style={{position:'relative', display:'inline-block', marginTop:'15px'}}>
                        
                        {isTranslated ? (
                            <button onClick={handleRestore} style={transBtnStyle}>
                                🇰🇷 한국어로 보기 (Original)
                            </button>
                        ) : (
                            <button onClick={()=>setShowLangMenu(!showLangMenu)} style={transBtnStyle}>
                                🌐 Translate
                            </button>
                        )}
                        
                        {!isTranslated && showLangMenu && (
                            <div style={{
                                position:'absolute', top:'110%', left:'50%', transform:'translateX(-50%)', 
                                background:'white', borderRadius:'10px', boxShadow:'0 4px 15px rgba(0,0,0,0.2)',
                                overflow:'hidden', zIndex:100, minWidth:'120px', color:'#333'
                            }}>
                                <button onClick={()=>handleTranslate('en')} style={langItemStyle}>🇺🇸 English</button>
                                <button onClick={()=>handleTranslate('zh')} style={langItemStyle}>🇨🇳 中文 (China)</button>
                                <button onClick={()=>handleTranslate('ja')} style={langItemStyle}>🇯🇵 日本語</button>
                            </div>
                        )}
                    </div>
                )}
                
                {info.defaultOpen && (
                    <div style={{marginTop:'20px', fontSize:'0.9rem', opacity:0.9, lineHeight:'1.5', background:'rgba(255,255,255,0.1)', padding:'15px', borderRadius:'10px'}}>
                        {data.intro}
                    </div>
                )}
            </div>
          );
      })()}

      {/* 나머지 섹션들 */}
      {renderOrder.map((sectionId: string) => {
          if (sectionId === 'links' && data.links?.length > 0) {
              const info = getSecInfo('links', '링크', true);
              return (<div key="links" style={{padding:'0 20px', marginBottom:'20px'}}><Section title={info.title} defaultOpen={info.defaultOpen}>{data.links.map((link: any, i: number) => (<a key={i} href={link.value.startsWith('http') ? link.value : `tel:${link.value}`} target="_blank" style={linkStyle}><span style={{marginRight: '12px', fontSize: '1.2rem'}}>{link.type === 'mobile' ? '📞' : '🔗'}</span><span style={{fontWeight: '600'}}>{link.value}</span></a>))}</Section></div>);
          }
          if (sectionId === 'history' && data.history?.length > 0) {
              const info = getSecInfo('history', '연혁 (History)', true);
              return (<div key="history" style={{padding:'0 20px', marginBottom:'20px'}}><Section title={info.title} defaultOpen={info.defaultOpen}><div style={{borderLeft:'2px solid #eee', paddingLeft:'15px', marginLeft:'5px'}}>{data.history.map((item: any, idx: number) => (<div key={idx} style={{marginBottom:'20px'}}><span style={{color: colors.theme, fontWeight: '800', fontSize: '0.85rem'}}>{item.date}</span><h3 style={{margin:'4px 0', fontSize:'1rem'}}>{item.title}</h3><p style={{margin:0, color:'#666', fontSize:'0.9rem'}}>{item.desc}</p></div>))}</div></Section></div>);
          }
          if (sectionId === 'projects' && data.projects?.length > 0) {
              const info = getSecInfo('projects', '프로젝트', false);
              return (<div key="projects" style={{padding:'0 20px', marginBottom:'20px'}}><Section title={info.title} defaultOpen={info.defaultOpen}>{data.projects.map((item: any, idx: number) => (<div key={idx} style={{marginBottom:'15px', background:'#f9f9f9', padding:'15px', borderRadius:'10px'}}><h3 style={{margin:'0 0 5px 0', fontSize:'1rem'}}>{item.link ? <a href={item.link} target="_blank" style={{color:'#1565c0'}}>{item.title} 🔗</a> : item.title}</h3><p style={{margin:0, color:'#555', fontSize:'0.9rem'}}>{item.desc}</p></div>))}</Section></div>);
          }
          const customSec = data.custom_sections?.find((c:any) => c.id === sectionId);
          if (customSec) {
              const info = getSecInfo(sectionId, customSec.title, false);
              return (<div key={sectionId} style={{padding:'0 20px', marginBottom:'20px'}}><Section title={info.title} defaultOpen={info.defaultOpen}>{customSec.items.map((item:any, i:number)=>(<div key={i} style={{marginBottom:'15px'}}><h3 style={{margin:'0 0 5px 0', fontSize:'1rem'}}>{item.title}</h3><p style={{margin:0, color:'#666', fontSize:'0.9rem'}}>{item.desc}</p></div>))}</Section></div>);
          }
          return null;
      })}

      <div style={{padding:'20px'}}>
        {isAiPlan && (
            <>
                <FunFeatures context={data} username={params.username} activeFeature={activeFunFeature} onClose={()=>setActiveFunFeature(null)}/>
                <div style={{height:'30px'}}></div>
                <ChatBot context={data} username={params.username} />
            </>
        )}
        <div style={{height:'30px'}}></div>
        <Guestbook username={params.username} />
      </div>
    </div>
  );
}

// ✨ [스타일 타입 정의] CSSProperties로 타입을 명시하여 에러 해결
const transBtnStyle: CSSProperties = {
    padding:'6px 12px', borderRadius:'15px', 
    border:'1px solid rgba(255,255,255,0.3)', 
    background:'rgba(255,255,255,0.1)', 
    color:'white', fontSize:'0.75rem', 
    cursor:'pointer', display:'flex', 
    alignItems:'center', gap:'5px'
};

const langItemStyle: CSSProperties = { 
    display: 'block', width: '100%', 
    padding: '10px 15px', border: 'none', 
    background: 'transparent', textAlign: 'left', 
    cursor: 'pointer', fontSize: '0.85rem', 
    borderBottom: '1px solid #eee' 
};

const circleBtnStyle: CSSProperties = { 
    width: '60px', height: '60px', 
    borderRadius: '50%', 
    background: 'rgba(255,255,255,0.2)', 
    backdropFilter: 'blur(5px)', 
    border: '1px solid rgba(255,255,255,0.3)', 
    color: 'white', display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', justifyContent: 'center', 
    cursor: 'pointer', transition: 'all 0.2s' 
};

const linkStyle: CSSProperties = { 
    display: 'flex', alignItems: 'center', 
    padding: '15px', marginBottom: '10px', 
    background: 'white', border: '1px solid #eee', 
    borderRadius: '12px', textDecoration: 'none', 
    color: '#333', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' 
};

const Section = ({ title, children, defaultOpen }: any) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (<div style={{border:'1px solid #eee', borderRadius:'12px', overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,0.02)', background:'white'}}><div onClick={()=>setIsOpen(!isOpen)} style={{padding:'15px', background:'white', fontWeight:'bold', display:'flex', justifyContent:'space-between', cursor:'pointer', borderBottom: isOpen ? '1px solid #f0f0f0' : 'none'}}>{title} <span>{isOpen ? '▲' : '▼'}</span></div>{isOpen && <div style={{padding:'20px'}}>{children}</div>}</div>);
};