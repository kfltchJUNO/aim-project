// app/admin/page.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { db, auth, storage } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { 
  collection, query, where, doc, updateDoc, 
  orderBy, limit, onSnapshot, getDocs, runTransaction, arrayUnion, arrayRemove
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

type SectionItem = {
  id: string;
  type: 'profile' | 'links' | 'history' | 'projects' | 'custom';
  title: string;
  isDefaultOpen: boolean;
  isOpenInAdmin: boolean;
};

const LINK_TYPES = [
  { label: "📞 휴대폰", value: "mobile" },
  { label: "📧 이메일", value: "email" },
  { label: "📷 인스타그램", value: "insta" },
  { label: "🔗 기타 링크", value: "other" },
];

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [myCardId, setMyCardId] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  // 🔥 [수정] ownerMbti 필드 추가
  const [formData, setFormData] = useState<any>({ 
    links: [], history: [], projects: [], custom_sections: [], custom_knowledge: [],
    chatbotEnabled: true, 
    translationEnabled: true, 
    quizEnabled: true,    
    synergyEnabled: true,
    ownerMbti: '' // 명함 주인 MBTI
  });
  
  const [newKnowledge, setNewKnowledge] = useState('');
  const [colors, setColors] = useState({ background: '#ffffff', theme: '#1a237e' });
  const [sectionList, setSectionList] = useState<SectionItem[]>([]);
  const [profileConfig, setProfileConfig] = useState<SectionItem>({
      id: 'profile', type: 'profile', title: '기본 정보', isDefaultOpen: true, isOpenInAdmin: true
  });
  
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  
  const [showPreview, setShowPreview] = useState(false);
  const [showTokenHistory, setShowTokenHistory] = useState(false);
  const [tokenLogs, setTokenLogs] = useState<any[]>([]);

  useEffect(() => {
    let unsubscribeSnapshot: any = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const q = query(collection(db, "users"), where("owner_email", "==", u.email));
        
        unsubscribeSnapshot = onSnapshot(q, (snap) => {
            if (!snap.empty) {
                const d = snap.docs[0];
                const data = d.data();
                setMyCardId(d.id);
                setCredits(data.credits || 0);

                setFormData((prev: any) => ({
                    ...prev,
                    ...data,
                    links: data.links || [],
                    history: data.history || [],
                    projects: data.projects || [],
                    custom_sections: data.custom_sections || [],
                    custom_knowledge: data.custom_knowledge || [],
                    chatbotEnabled: data.chatbotEnabled !== false,
                    translationEnabled: data.translationEnabled !== false,
                    quizEnabled: data.quizEnabled !== false,
                    synergyEnabled: data.synergyEnabled !== false,
                    ownerMbti: data.ownerMbti || '' // MBTI 불러오기
                }));

                if(data.colors) setColors(data.colors);

                if(sectionList.length === 0) {
                    const config = data.section_config || {}; 
                    if(config['profile']) {
                        setProfileConfig(prev => ({ 
                            ...prev, 
                            title: config['profile'].title || '기본 정보',
                            isDefaultOpen: config['profile'].isDefaultOpen ?? true
                        }));
                    }
                    
                    let initialList: SectionItem[] = [];
                    if (data.section_order && data.section_order.length > 0) {
                        initialList = data.section_order
                            .filter((id:string) => id !== 'profile')
                            .map((id: string) => {
                                const conf = config[id] || {};
                                let type: any = 'custom';
                                if(id === 'links') type = 'links';
                                else if(id === 'history') type = 'history';
                                else if(id === 'projects') type = 'projects';

                                let title = conf.title;
                                if(!title) {
                                    if(type==='links') title = '링크';
                                    else if(type==='history') title = '연혁';
                                    else if(type==='projects') title = '프로젝트';
                                    else {
                                        const c = data.custom_sections?.find((cs:any)=>cs.id === id);
                                        title = c ? c.title : '새 섹션';
                                    }
                                }
                                return { id, type, title, isDefaultOpen: conf.isDefaultOpen ?? false, isOpenInAdmin: false };
                            });
                    } else {
                        initialList = [
                            { id: 'links', type: 'links', title: '링크', isDefaultOpen: false, isOpenInAdmin: false },
                            { id: 'history', type: 'history', title: '연혁', isDefaultOpen: true, isOpenInAdmin: false },
                            { id: 'projects', type: 'projects', title: '프로젝트', isDefaultOpen: false, isOpenInAdmin: false },
                            ...(data.custom_sections || []).map((c:any) => ({
                                id: c.id, type: 'custom', title: c.title, isDefaultOpen: false, isOpenInAdmin: false
                            }))
                        ];
                    }
                    setSectionList(initialList);
                }
                setIsAuthorized(true);
            } else {
                setIsAuthorized(false); 
            }
            setLoading(false);
        });

      } else {
          setLoading(false);
      }
    });

    return () => {
        unsubscribeAuth();
        if(unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const fetchTokenLogs = async () => {
    if (!myCardId) return;
    try {
      const q = query(collection(db, "users", myCardId, "logs"), orderBy("date", "desc"), limit(20));
      const snap = await getDocs(q);
      const logs = snap.docs.map(doc => { const d = doc.data(); return { ...d, date: d.date?.toDate ? d.date.toDate().toLocaleString() : '날짜 없음' }; });
      setTokenLogs(logs); setShowTokenHistory(true);
    } catch (error) { console.error(error); setTokenLogs([]); setShowTokenHistory(true); }
  };
  const handleAddKnowledge = async () => {
    if (!myCardId || !newKnowledge.trim()) return;
    if (credits < 10) return alert("토큰이 부족합니다. (교육 추가: 10토큰)");
    if (!confirm(`이 내용을 AI에게 학습시키겠습니까?\n(10토큰이 차감됩니다)`)) return;
    try {
        const userRef = doc(db, "users", myCardId);
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw "User not found";
            const current = userDoc.data().credits || 0;
            if (current < 10) throw "Not enough credits";
            transaction.update(userRef, { credits: current - 10, custom_knowledge: arrayUnion(newKnowledge.trim()) });
            const newLogRef = doc(collection(db, "users", myCardId, "logs"));
            transaction.set(newLogRef, { type: '사용', amount: -10, reason: 'AI 교육 추가', date: new Date() });
        });
        setNewKnowledge(''); alert("✅ AI 교육이 완료되었습니다.");
    } catch (e) { console.error(e); alert("오류 발생"); }
  };
  const handleDeleteKnowledge = async (text: string) => {
    if (!myCardId) return;
    if (credits < 10) return alert("토큰이 부족합니다. (삭제 비용: 10토큰)");
    if (!confirm(`삭제하시겠습니까?\n(10토큰이 소모됩니다)`)) return;
    try {
        const userRef = doc(db, "users", myCardId);
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw "User not found";
            const current = userDoc.data().credits || 0;
            if (current < 10) throw "Not enough credits";
            transaction.update(userRef, { credits: current - 10, custom_knowledge: arrayRemove(text) });
            const newLogRef = doc(collection(db, "users", myCardId, "logs"));
            transaction.set(newLogRef, { type: '사용', amount: -10, reason: 'AI 교육 삭제', date: new Date() });
        });
        alert("🗑️ 삭제되었습니다.");
    } catch (e) { console.error(e); alert("오류 발생"); }
  };
  const handleSave = async () => {
    if (!myCardId || !isAuthorized) return alert("권한이 없습니다.");
    if (!confirm("설정을 저장하시겠습니까?")) return;
    try {
        const configMap: any = {};
        configMap['profile'] = { title: profileConfig.title, isDefaultOpen: profileConfig.isDefaultOpen };
        sectionList.forEach(item => { configMap[item.id] = { title: item.title, isDefaultOpen: item.isDefaultOpen }; });
        const orderToSave = ['profile', ...sectionList.map(s => s.id)];
        const updatedCustomData = formData.custom_sections.map((c:any) => { const match = sectionList.find(s => s.id === c.id); return match ? { ...c, title: match.title } : c; });
        await updateDoc(doc(db, "users", myCardId), { ...formData, custom_sections: updatedCustomData, section_order: orderToSave, section_config: configMap, colors: colors });
        alert("✅ 저장되었습니다.");
    } catch (error) { console.error(error); alert("저장 실패"); }
  };
  const handleSort = () => { if (dragItem.current === null || dragOverItem.current === null) return; const _list = [...sectionList]; const draggedItem = _list.splice(dragItem.current, 1)[0]; _list.splice(dragOverItem.current, 0, draggedItem); dragItem.current = null; dragOverItem.current = null; setSectionList(_list); };
  const updateSectionState = (index: number | 'profile', field: keyof SectionItem, value: any) => { if (index === 'profile') setProfileConfig({ ...profileConfig, [field]: value }); else { const newList = [...sectionList]; (newList[index] as any)[field] = value; setSectionList(newList); } };
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file || !myCardId) return; setUploading(true); try { const storageRef = ref(storage, `profile_images/${myCardId}_${Date.now()}`); await uploadBytes(storageRef, file); const url = await getDownloadURL(storageRef); setFormData({ ...formData, profile_img: url }); } finally { setUploading(false); } };
  const handleItemChange = (key: string, idx: number, field: string, val: string) => { const list = [...formData[key]]; list[idx][field] = val; setFormData({...formData, [key]: list}); };
  const addItem = (key: string) => { const emptyItem = key==='links'?{type:'mobile', value:''} : key==='history'?{date:'', title:'', desc:''} : {title:'', link:'', desc:''}; setFormData({...formData, [key]: [...formData[key], emptyItem]}); };
  const removeItem = (key: string, idx: number) => { const list = [...formData[key]]; list.splice(idx, 1); setFormData({...formData, [key]: list}); };
  const addCustomSection = () => { const newId = `custom_${Date.now()}`; setFormData({ ...formData, custom_sections: [...(formData.custom_sections||[]), { id: newId, title: '새 섹션', items: [] }] }); setSectionList([ ...sectionList, { id: newId, type: 'custom', title: '새 섹션', isDefaultOpen: true, isOpenInAdmin: true } ]); };
  const deleteSection = (index: number) => { if(!confirm("영구 삭제하시겠습니까?")) return; const targetId = sectionList[index].id; setSectionList(sectionList.filter((_, i) => i !== index)); if(targetId.startsWith('custom')) setFormData({ ...formData, custom_sections: formData.custom_sections.filter((c:any) => c.id !== targetId) }); };
  const handleCustomItemChange = (secId: string, itemIdx: number, field: string, val: string) => { const updated = formData.custom_sections.map((c:any) => c.id === secId ? { ...c, items: c.items.map((it:any, i:number)=>i===itemIdx ? {...it, [field]:val} : it) } : c); setFormData({...formData, custom_sections: updated}); };
  const addCustomItem = (secId: string) => { const updated = formData.custom_sections.map((c:any) => c.id===secId ? {...c, items: [...c.items, {title:'', desc:''}]} : c); setFormData({...formData, custom_sections: updated}); };
  const removeCustomItem = (secId: string, itemIdx: number) => { const updated = formData.custom_sections.map((c:any) => c.id===secId ? {...c, items: c.items.filter((_:any, i:number)=>i!==itemIdx)} : c); setFormData({...formData, custom_sections: updated}); };

  if (loading) return <div>로딩 중...</div>;
  if (!user) return <div style={centerStyle}><h2 style={{marginBottom:'15px'}}>관리자 로그인</h2><p style={{marginBottom:'25px', color:'#666'}}>명함을 수정하려면 로그인이 필요합니다.</p><button onClick={()=>signInWithPopup(auth, new GoogleAuthProvider())} style={googleLoginBtnStyle}><span style={{marginRight:'10px'}}>G</span> 구글 계정으로 로그인</button></div>;
  if (!isAuthorized) return <div style={centerStyle}><h2 style={{color:'#d32f2f', marginBottom:'10px'}}>⛔ 등록된 명함이 없습니다.</h2><p style={{color:'#666', marginBottom:'20px'}}>현재 로그인한 계정(<strong>{user.email}</strong>)으로<br/>등록된 명함이 존재하지 않습니다.</p><div style={{background:'#e3f2fd', padding:'20px', borderRadius:'10px', marginBottom:'30px', textAlign:'center', width:'90%', maxWidth:'400px', border:'1px solid #90caf9'}}><p style={{margin:'0 0 8px 0', fontWeight:'bold', color:'#1565c0'}}>📢 나만의 AI 명함이 필요하신가요?</p><p style={{margin:0, fontSize:'0.9rem', color:'#333'}}>제작 문의: <a href="mailto:ot.helper7@gmail.com" style={{color:'#d32f2f', fontWeight:'bold', textDecoration:'underline'}}>ot.helper7@gmail.com</a></p></div><button onClick={()=>signOut(auth)} style={logoutBtnStyle}>로그아웃</button></div>;

  return (
    <div style={{background:'#f5f5f5', minHeight:'100vh', paddingBottom:'100px'}}>
      <div style={{maxWidth:'600px', margin:'0 auto', background:'white', padding:'20px', minHeight:'100vh'}}>
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', alignItems:'center'}}>
            <h2>⚙️ 관리자</h2>
            <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
                <button onClick={fetchTokenLogs} style={tokenBtnStyle}>💎 {credits}</button>
                <button onClick={()=>signOut(auth)} style={logoutBtnStyle}>로그아웃</button>
            </div>
        </div>

        {/* AI 기능 제어 & MBTI 입력 */}
        <div style={{background:'white', padding:'15px', borderRadius:'10px', marginBottom:'20px', border:'1px solid #e0e0e0', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>
            <h3 style={{marginTop:0, fontSize:'0.9rem', color:'#333', marginBottom:'10px'}}>🤖 AI 기능 제어 (ON/OFF)</h3>
            
            <div style={{display:'flex', gap:'15px', flexWrap:'wrap', marginBottom: '15px'}}>
                <label style={toggleLabelStyle}><input type="checkbox" checked={formData.chatbotEnabled} onChange={(e)=>setFormData({...formData, chatbotEnabled: e.target.checked})} /> 💬 챗봇</label>
                <label style={toggleLabelStyle}><input type="checkbox" checked={formData.translationEnabled} onChange={(e)=>setFormData({...formData, translationEnabled: e.target.checked})} /> 🌐 번역</label>
                <label style={toggleLabelStyle}><input type="checkbox" checked={formData.quizEnabled} onChange={(e)=>setFormData({...formData, quizEnabled: e.target.checked})} /> 🧠 찐친고사</label>
                <label style={toggleLabelStyle}><input type="checkbox" checked={formData.synergyEnabled} onChange={(e)=>setFormData({...formData, synergyEnabled: e.target.checked})} /> 💘 MBTI 분석</label>
            </div>

            {/* 🔥 [신규] MBTI 입력창: synergyEnabled가 켜져 있을 때만 보임 */}
            {formData.synergyEnabled && (
                <div style={{background:'#f3e5f5', padding:'10px', borderRadius:'5px', border:'1px solid #e1bee7', marginTop:'5px'}}>
                    <label style={{fontSize:'0.85rem', fontWeight:'bold', color:'#7b1fa2', display:'block', marginBottom:'5px'}}>
                        🧙‍♂️ 주인의 MBTI (AI 궁합 분석용)
                    </label>
                    <input 
                        type="text" 
                        placeholder="예: ENFP (비워두면 방문자 성향만 분석해줌)" 
                        value={formData.ownerMbti || ''}
                        onChange={(e)=>setFormData({...formData, ownerMbti: e.target.value.toUpperCase()})}
                        style={{width:'100%', padding:'8px', border:'1px solid #ce93d8', borderRadius:'5px', boxSizing:'border-box'}}
                    />
                    <p style={{fontSize:'0.75rem', color:'#666', margin:'5px 0 0'}}>* 입력하지 않으면 방문자의 MBTI 성향만 분석해줍니다.</p>
                </div>
            )}
        </div>

        {/* ... (이하 스타일, 교육, 섹션, 버튼 등 기존 UI와 동일) ... */}
        {/* 기존 코드 유지 (내용 생략 없이 그대로 붙여넣기 하세요) */}
        <div style={{background:'#e3f2fd', padding:'15px', borderRadius:'10px', marginBottom:'20px', border:'1px solid #90caf9'}}>
            <h3 style={{marginTop:0, fontSize:'1rem', color:'#1565c0'}}>🎨 테마/색상 설정</h3>
            <div style={{display:'flex', gap:'20px', marginTop:'10px'}}>
                <div style={{display:'flex', flexDirection:'column'}}><label style={{fontSize:'0.8rem', marginBottom:'5px'}}>프로필 배경색</label><input type="color" value={colors.theme} onChange={(e)=>setColors({...colors, theme: e.target.value})} style={{width:'50px', height:'30px', border:'none', cursor:'pointer'}} /></div>
                <div style={{display:'flex', flexDirection:'column'}}><label style={{fontSize:'0.8rem', marginBottom:'5px'}}>전체 배경색</label><input type="color" value={colors.background} onChange={(e)=>setColors({...colors, background: e.target.value})} style={{width:'50px', height:'30px', border:'none', cursor:'pointer'}} /></div>
            </div>
        </div>

        <div style={{background:'#fff3e0', padding:'15px', borderRadius:'10px', marginBottom:'20px', border:'1px solid #ffcc80'}}>
            <h3 style={{marginTop:0, fontSize:'1rem', color:'#e65100'}}>🤖 AI 챗봇 교육 (추가/삭제: 각 10토큰)</h3>
            <p style={{fontSize:'0.85rem', color:'#666', marginBottom:'10px'}}>AI에게 알려주고 싶은 내용을 입력하세요.</p>
            {formData.custom_knowledge && formData.custom_knowledge.length > 0 ? (
                <ul style={{paddingLeft:'20px', margin:'10px 0'}}>
                    {formData.custom_knowledge.map((item: string, idx: number) => (
                        <li key={idx} style={{marginBottom:'8px', fontSize:'0.9rem'}}>
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                <span>{item}</span>
                                <button onClick={() => handleDeleteKnowledge(item)} style={{fontSize:'0.7rem', background:'#ffcdd2', border:'none', borderRadius:'5px', padding:'3px 6px', color:'#c62828', cursor:'pointer', marginLeft:'10px'}}>삭제 (-10)</button>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (<div style={{fontSize:'0.9rem', color:'#999', padding:'10px', fontStyle:'italic'}}>등록된 교육 내용이 없습니다.</div>)}
            <div style={{display:'flex', gap:'5px', marginTop:'10px'}}>
                <input value={newKnowledge} onChange={(e)=>setNewKnowledge(e.target.value)} placeholder="새로운 교육 내용" style={{flex:1, padding:'8px', border:'1px solid #ddd', borderRadius:'5px'}}/>
                <button onClick={handleAddKnowledge} style={{background:'#ff9800', color:'white', border:'none', borderRadius:'5px', padding:'0 15px', fontWeight:'bold', cursor:'pointer'}}>추가 (-10)</button>
            </div>
        </div>

        <div style={{border:'2px solid #1a237e', borderRadius:'10px', overflow:'hidden', marginBottom:'20px', background:'white'}}>
            <div style={{padding:'15px', background:'#f0f2f5', borderBottom:'1px solid #ddd', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div style={{display:'flex', gap:'10px', alignItems:'center', flex:1}}><span style={{fontSize:'1.2rem'}}>📌</span><input value={profileConfig.title} onChange={(e)=>updateSectionState('profile', 'title', e.target.value)} style={titleInputStyle} /></div>
                <div style={{display:'flex', gap:'10px', fontSize:'0.8rem', alignItems:'center'}}><label><input type="checkbox" checked={profileConfig.isDefaultOpen} onChange={(e)=>updateSectionState('profile', 'isDefaultOpen', e.target.checked)}/> 초기 펼침</label><button onClick={()=>updateSectionState('profile', 'isOpenInAdmin', !profileConfig.isOpenInAdmin)}>{profileConfig.isOpenInAdmin ? '접기' : '편집'}</button></div>
            </div>
            {profileConfig.isOpenInAdmin && (<div style={{padding:'20px', textAlign:'center'}}><img src={formData.profile_img || "/profile_default.jpg"} style={{width:'80px', height:'80px', borderRadius:'50%'}} /><br/><label style={{cursor:'pointer', color:'blue', fontSize:'0.9rem'}}>{uploading ? "업로드 중" : "사진 변경"}<input type="file" hidden onChange={handleImageUpload}/></label><input value={formData.name || ''} onChange={e=>setFormData({...formData, name:e.target.value})} placeholder="이름" style={inputStyle}/><input value={formData.role || ''} onChange={e=>setFormData({...formData, role:e.target.value})} placeholder="직함" style={inputStyle}/><textarea value={formData.intro || ''} onChange={e=>setFormData({...formData, intro:e.target.value})} placeholder="소개" style={{...inputStyle, height:'80px'}}/></div>)}
        </div>

        <p style={{fontSize:'0.9rem', color:'#666', marginBottom:'10px'}}>⬇️ 드래그하여 순서 변경 가능</p>

        <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
            {sectionList.map((section, index) => (
                <div key={section.id} draggable onDragStart={() => dragItem.current = index} onDragEnter={() => dragOverItem.current = index} onDragEnd={handleSort} onDragOver={(e)=>e.preventDefault()} style={{background:'white', border: '1px solid #ccc', borderRadius:'10px', overflow:'hidden'}}>
                    <div style={{padding:'15px', background: section.isOpenInAdmin ? '#e8eaf6' : '#f9f9f9', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'grab'}}>
                        <div style={{display:'flex', gap:'10px', alignItems:'center', flex:1}}><span style={{color:'#999'}}>☰</span><input value={section.title} onChange={(e)=>updateSectionState(index, 'title', e.target.value)} onClick={(e)=>e.stopPropagation()} style={titleInputStyle} /></div>
                        <div style={{display:'flex', gap:'10px', fontSize:'0.8rem', alignItems:'center'}}><label onClick={e=>e.stopPropagation()}><input type="checkbox" checked={section.isDefaultOpen} onChange={(e)=>updateSectionState(index, 'isDefaultOpen', e.target.checked)}/> 초기 펼침</label><button onClick={()=>updateSectionState(index, 'isOpenInAdmin', !section.isOpenInAdmin)}>{section.isOpenInAdmin ? '▲' : '▼'}</button></div>
                    </div>
                    {section.isOpenInAdmin && (
                        <div style={{padding:'15px', borderTop:'1px solid #eee'}}>
                             {section.type === 'links' && (<div>{formData.links.map((link:any, i:number) => (<div key={i} style={{display:'flex', gap:'5px', marginBottom:'5px'}}><select value={link.type} onChange={e=>handleItemChange('links', i, 'type', e.target.value)}>{LINK_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select><input value={link.value} onChange={e=>handleItemChange('links', i, 'value', e.target.value)} style={{flex:1}}/><button onClick={()=>removeItem('links', i)}>×</button></div>))}<button onClick={()=>addItem('links')} style={addBtn}>+ 링크 추가</button></div>)}
                            {section.type === 'history' && (<div>{formData.history.map((item:any, i:number)=>(<div key={i} style={itemBoxStyle}><input value={item.date} onChange={e=>handleItemChange('history', i, 'date', e.target.value)} placeholder="날짜" style={inputStyle}/><input value={item.title} onChange={e=>handleItemChange('history', i, 'title', e.target.value)} placeholder="제목" style={inputStyle}/><textarea value={item.desc} onChange={e=>handleItemChange('history', i, 'desc', e.target.value)} placeholder="내용" style={{...inputStyle, height:'50px'}}/><button onClick={()=>removeItem('history', i)}>삭제</button></div>))}<button onClick={()=>addItem('history')} style={addBtn}>+ 연혁 추가</button></div>)}
                            {section.type === 'projects' && (<div>{formData.projects.map((item:any, i:number)=>(<div key={i} style={itemBoxStyle}><input value={item.title} onChange={e=>handleItemChange('projects', i, 'title', e.target.value)} placeholder="프로젝트명" style={inputStyle}/><input value={item.link} onChange={e=>handleItemChange('projects', i, 'link', e.target.value)} placeholder="링크" style={inputStyle}/><textarea value={item.desc} onChange={e=>handleItemChange('projects', i, 'desc', e.target.value)} placeholder="설명" style={{...inputStyle, height:'50px'}}/><button onClick={()=>removeItem('projects', i)}>삭제</button></div>))}<button onClick={()=>addItem('projects')} style={addBtn}>+ 프로젝트 추가</button></div>)}
                            {section.type === 'custom' && (() => { const cData = formData.custom_sections.find((c:any)=>c.id===section.id); if(!cData) return null; return (<div>{cData.items.map((item:any, i:number)=>(<div key={i} style={itemBoxStyle}><input value={item.title} onChange={e=>handleCustomItemChange(cData.id, i, 'title', e.target.value)} placeholder="제목" style={inputStyle}/><textarea value={item.desc} onChange={e=>handleCustomItemChange(cData.id, i, 'desc', e.target.value)} placeholder="내용" style={{...inputStyle, height:'50px'}}/><button onClick={()=>removeCustomItem(cData.id, i)}>삭제</button></div>))}<button onClick={()=>addCustomItem(cData.id)} style={addBtn}>+ 항목 추가</button><button onClick={()=>deleteSection(index)} style={{...addBtn, background:'#ffcdd2', color:'red', marginTop:'10px'}}>섹션 삭제</button></div>) })()}
                        </div>
                    )}
                </div>
            ))}
        </div>

        <button onClick={addCustomSection} style={{...addBtn, background:'#673ab7', color:'white', padding:'15px', marginTop:'20px'}}>+ 새 섹션 만들기</button>
        <div style={{height:'100px'}}></div>

        <div style={{position:'fixed', bottom:0, left:0, width:'100%', background:'white', padding:'15px', borderTop:'1px solid #ddd', display:'flex', gap:'10px', justifyContent:'center'}}>
            <button onClick={()=>setShowPreview(true)} style={saveBtn}>📱 미리보기</button>
            <button onClick={handleSave} style={{...saveBtn, background:'#1a237e'}}>저장하기</button>
        </div>

        {showTokenHistory && (
            <div style={modalOverlay}>
                <div style={modalContent}>
                    <h3>💎 토큰 사용 기록</h3>
                    <ul style={{listStyle:'none', padding:0, maxHeight:'300px', overflowY:'auto'}}>
                        {tokenLogs.length === 0 ? <li>기록이 없습니다.</li> : 
                            tokenLogs.map((log, i)=>(
                            <li key={i} style={{borderBottom:'1px solid #eee', padding:'10px 0'}}>
                                <div>{log.date} <small>({log.reason})</small></div>
                                <div style={{fontWeight:'bold', color:log.amount>0?'green':'red'}}>{log.amount>0?'+':''}{log.amount}</div>
                            </li>
                        ))}
                    </ul>
                    <button onClick={()=>setShowTokenHistory(false)} style={closeBtn}>닫기</button>
                </div>
            </div>
        )}
        {showPreview && (<div style={modalOverlay}><div style={{background:'white', width:'360px', height:'640px', display:'flex', flexDirection:'column'}}><iframe src={`/${myCardId}`} style={{flex:1, border:'none'}} /><button onClick={()=>setShowPreview(false)} style={closeBtn}>닫기</button></div></div>)}
      </div>
    </div>
  );
}

// 스타일
const centerStyle = {display:'flex', flexDirection:'column' as 'column', alignItems:'center', justifyContent:'center', height:'100vh', padding:'20px', textAlign:'center' as 'center'};
const inputStyle = {width:'100%', padding:'10px', marginBottom:'5px', border:'1px solid #ddd', borderRadius:'5px', boxSizing:'border-box' as 'border-box'};
const titleInputStyle = {fontWeight:'bold' as 'bold', fontSize:'1rem', border:'none', background:'transparent', borderBottom:'1px dashed #999', width:'70%'};
const itemBoxStyle = {background:'#f9f9f9', padding:'10px', marginBottom:'5px', borderRadius:'5px', border:'1px solid #eee'};
const addBtn = {width:'100%', padding:'10px', background:'#e3f2fd', border:'none', cursor:'pointer', borderRadius:'5px', fontWeight:'bold' as 'bold'};
const saveBtn = {flex:1, padding:'15px', background:'#424242', color:'white', border:'none', cursor:'pointer', borderRadius:'10px', fontWeight:'bold' as 'bold'};
const tokenBtnStyle = {background:'#fff9c4', border:'1px solid #fbc02d', borderRadius:'20px', padding:'5px 12px', fontSize:'0.9rem', fontWeight:'bold' as 'bold', cursor:'pointer', color:'#f57f17'};
const logoutBtnStyle = {padding:'12px 25px', border:'1px solid #ddd', background:'white', borderRadius:'8px', cursor:'pointer', fontWeight:'bold', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'};
const googleLoginBtnStyle = {display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 24px', backgroundColor: '#4285F4', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold' as 'bold', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'background-color 0.2s ease'};
const modalOverlay = {position:'fixed' as 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:999};
const modalContent = {background:'white', padding:'20px', borderRadius:'10px', width:'300px'};
const closeBtn = {width:'100%', padding:'10px', background:'#333', color:'white', border:'none', borderRadius:'5px', marginTop:'10px', cursor:'pointer'};
const toggleLabelStyle = {display:'flex', alignItems:'center', gap:'5px', cursor:'pointer', fontWeight:'bold' as 'bold', fontSize:'0.9rem', padding:'5px 10px', borderRadius:'5px', background:'#f5f5f5'};