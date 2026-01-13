"use client";

import { useState, useEffect, useRef } from 'react';
import { db, auth, storage } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { 
  collection, query, where, doc, updateDoc, 
  orderBy, limit, onSnapshot, getDocs 
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
  
  const [formData, setFormData] = useState<any>({ 
    links: [], history: [], projects: [], custom_sections: [] 
  });
  
  const [colors, setColors] = useState({ background: '#ffffff', theme: '#1a237e' });
  const [features, setFeatures] = useState({ quiz: false, synergy: false, translation: false });
  const [isAiPlan, setIsAiPlan] = useState(false);

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
  const [tokenTab, setTokenTab] = useState<'all' | 'usage' | 'income'>('all');

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
                setIsAiPlan(data.enable_ai === true);

                setFormData((prev: any) => ({
                    ...data,
                    links: data.links || [],
                    history: data.history || [],
                    projects: data.projects || [],
                    custom_sections: data.custom_sections || []
                }));

                if(data.colors) setColors(data.colors);
                if(data.features) setFeatures(data.features);

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
      const q = query(collection(db, "users", myCardId, "logs"), orderBy("date", "desc"), limit(100));
      const snap = await getDocs(q);
      const logs = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          dateObj: d.date?.toDate ? d.date.toDate() : new Date(),
          dateStr: d.date?.toDate ? d.date.toDate().toLocaleDateString() : '날짜 없음',
          timeStr: d.date?.toDate ? d.date.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''
        };
      });
      setTokenLogs(logs);
      setTokenTab('all');
      setShowTokenHistory(true);
    } catch (error) {
      console.error("기록 가져오기 실패:", error);
      setTokenLogs([]);
      setShowTokenHistory(true);
    }
  };

  const handleLogout = async () => {
      await signOut(auth);
      window.location.href = "/";
  };

  const handleSave = async () => {
    if (!myCardId || !isAuthorized) return alert("권한이 없습니다.");
    if (!confirm("저장하시겠습니까?")) return;
    try {
        const configMap: any = {};
        configMap['profile'] = { title: profileConfig.title, isDefaultOpen: profileConfig.isDefaultOpen };
        sectionList.forEach(item => {
            configMap[item.id] = { title: item.title, isDefaultOpen: item.isDefaultOpen };
        });
        const orderToSave = ['profile', ...sectionList.map(s => s.id)];
        const updatedCustomData = formData.custom_sections.map((c:any) => {
            const match = sectionList.find(s => s.id === c.id);
            return match ? { ...c, title: match.title } : c;
        });

        await updateDoc(doc(db, "users", myCardId), {
            ...formData,
            custom_sections: updatedCustomData,
            section_order: orderToSave,
            section_config: configMap,
            colors: colors,
            features: features
        });
        alert("✅ 저장되었습니다.");
    } catch (error) { console.error(error); alert("저장 실패"); }
  };

  const handleSort = () => { if (dragItem.current === null || dragOverItem.current === null) return; const _list = [...sectionList]; const draggedItem = _list.splice(dragItem.current, 1)[0]; _list.splice(dragOverItem.current, 0, draggedItem); dragItem.current = null; dragOverItem.current = null; setSectionList(_list); };
  const updateSectionState = (index: number | 'profile', field: keyof SectionItem, value: any) => { if (index === 'profile') { setProfileConfig({ ...profileConfig, [field]: value }); } else { const newList = [...sectionList]; (newList[index] as any)[field] = value; setSectionList(newList); } };
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file || !myCardId) return; setUploading(true); try { const storageRef = ref(storage, `profile_images/${myCardId}_${Date.now()}`); await uploadBytes(storageRef, file); const url = await getDownloadURL(storageRef); setFormData((prev:any)=>({ ...prev, profile_img: url })); } finally { setUploading(false); } };
  const handleItemChange = (key: string, idx: number, field: string, val: string) => { const list = [...formData[key]]; list[idx][field] = val; setFormData({...formData, [key]: list}); };
  const addItem = (key: string) => { const emptyItem = key==='links'?{type:'mobile', value:''} : key==='history'?{date:'', title:'', desc:''} : {title:'', link:'', desc:''}; setFormData({...formData, [key]: [...formData[key], emptyItem]}); };
  const removeItem = (key: string, idx: number) => { const list = [...formData[key]]; list.splice(idx, 1); setFormData({...formData, [key]: list}); };
  const addCustomSection = () => { const newId = `custom_${Date.now()}`; setFormData({ ...formData, custom_sections: [...(formData.custom_sections||[]), { id: newId, title: '새 섹션', items: [] }] }); setSectionList([ ...sectionList, { id: newId, type: 'custom', title: '새 섹션', isDefaultOpen: true, isOpenInAdmin: true } ]); };
  const deleteSection = (index: number) => { if(!confirm("삭제하시겠습니까?")) return; const targetId = sectionList[index].id; const newList = sectionList.filter((_, i) => i !== index); setSectionList(newList); if(targetId.startsWith('custom')) { setFormData({ ...formData, custom_sections: formData.custom_sections.filter((c:any) => c.id !== targetId) }); } };
  const handleCustomItemChange = (secId: string, itemIdx: number, field: string, val: string) => { const updated = formData.custom_sections.map((c:any) => c.id === secId ? { ...c, items: c.items.map((it:any, i:number)=>i===itemIdx ? {...it, [field]:val} : it) } : c ); setFormData({...formData, custom_sections: updated}); };
  const addCustomItem = (secId: string) => { const updated = formData.custom_sections.map((c:any) => c.id===secId ? {...c, items: [...c.items, {title:'', desc:''}]} : c); setFormData({...formData, custom_sections: updated}); };
  const removeCustomItem = (secId: string, itemIdx: number) => { const updated = formData.custom_sections.map((c:any) => c.id===secId ? {...c, items: c.items.filter((_:any, i:number)=>i!==itemIdx)} : c ); setFormData({...formData, custom_sections: updated}); };

  if (loading) return <div>로딩 중...</div>;
  if (!user) return <div style={centerStyle}><button onClick={()=>signInWithPopup(auth, new GoogleAuthProvider())} style={saveBtn}>구글 로그인</button></div>;
  if (!isAuthorized) return <div style={centerStyle}><h2>⛔ 권한 없음</h2></div>;

  const getUsageGroups = () => {
      const usageLogs = tokenLogs.filter(l => l.amount < 0);
      const groups: any = {};
      usageLogs.forEach(log => {
          const key = log.reason || "기타";
          if (!groups[key]) groups[key] = { count: 0, total: 0, items: [] };
          groups[key].count += 1;
          groups[key].total += Math.abs(log.amount);
          groups[key].items.push(log);
      });
      return groups;
  };

  return (
    <div style={{background:'#f5f5f5', minHeight:'100vh', paddingBottom:'100px'}}>
      <div style={{maxWidth:'600px', margin:'0 auto', background:'white', padding:'20px', minHeight:'100vh'}}>
        
        {/* 헤더 */}
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', alignItems:'center'}}>
            <h2>⚙️ 관리자</h2>
            <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                {isAiPlan && (
                    <button onClick={fetchTokenLogs} style={tokenBtnStyle}>💎 {credits}</button>
                )}
                <button onClick={handleLogout} style={logoutBtnStyle}>로그아웃</button>
            </div>
        </div>

        {/* 🎨 스타일 설정 */}
        <div style={{background:'#e3f2fd', padding:'15px', borderRadius:'10px', marginBottom:'20px', border:'1px solid #90caf9'}}>
            <h3 style={{marginTop:0, fontSize:'1rem', color:'#1565c0'}}>🎨 테마/색상 설정</h3>
            <div style={{display:'flex', gap:'20px', marginTop:'10px'}}>
                <div style={{display:'flex', flexDirection:'column'}}>
                    <label style={{fontSize:'0.8rem', marginBottom:'5px'}}>프로필 배경색</label>
                    <input type="color" value={colors.theme} onChange={(e)=>setColors({...colors, theme: e.target.value})} style={{width:'50px', height:'30px', border:'none', cursor:'pointer'}} />
                </div>
                <div style={{display:'flex', flexDirection:'column'}}>
                    <label style={{fontSize:'0.8rem', marginBottom:'5px'}}>전체 배경색</label>
                    <input type="color" value={colors.background} onChange={(e)=>setColors({...colors, background: e.target.value})} style={{width:'50px', height:'30px', border:'none', cursor:'pointer'}} />
                </div>
            </div>
        </div>

        {/* 🎮 기능 설정 (AI 플랜일 때만 표시) */}
        {isAiPlan && (
            <div style={{background:'#f3e5f5', padding:'15px', borderRadius:'10px', marginBottom:'20px', border:'1px solid #ce93d8'}}>
                <h3 style={{marginTop:0, fontSize:'1rem', color:'#7b1fa2'}}>🎮 AI 기능 설정 (On/Off)</h3>
                <div style={{display:'flex', flexDirection:'column', gap:'10px', marginTop:'10px'}}>
                    <label style={{display:'flex', alignItems:'center', gap:'10px', cursor:'pointer'}}>
                        <input type="checkbox" checked={features.quiz} onChange={(e)=>setFeatures({...features, quiz: e.target.checked})} />
                        <span style={{fontWeight:'bold'}}>📝 찐친 고사 (Quiz) 켜기</span>
                    </label>
                    <label style={{display:'flex', alignItems:'center', gap:'10px', cursor:'pointer'}}>
                        <input type="checkbox" checked={features.synergy} onChange={(e)=>setFeatures({...features, synergy: e.target.checked})} />
                        <span style={{fontWeight:'bold'}}>💘 궁합 분석 (Synergy) 켜기</span>
                    </label>
                    {/* 🌐 번역 기능 스위치 */}
                    <label style={{display:'flex', alignItems:'center', gap:'10px', cursor:'pointer'}}>
                        <input type="checkbox" checked={features.translation} onChange={(e)=>setFeatures({...features, translation: e.target.checked})} />
                        <span style={{fontWeight:'bold'}}>🌐 다국어 번역 (Translation) 켜기</span>
                    </label>
                </div>
            </div>
        )}

        {/* 프로필 섹션 */}
        <div style={{border:'2px solid #1a237e', borderRadius:'10px', overflow:'hidden', marginBottom:'20px', background:'white'}}><div><div style={{padding:'15px', background:'#f0f2f5', borderBottom:'1px solid #ddd', display:'flex', justifyContent:'space-between', alignItems:'center'}}><div style={{display:'flex', gap:'10px', alignItems:'center', flex:1}}><span style={{fontSize:'1.2rem'}}>📌</span><input value={profileConfig.title} onChange={(e)=>updateSectionState('profile', 'title', e.target.value)} style={titleInputStyle} /></div><div style={{display:'flex', gap:'10px', fontSize:'0.8rem', alignItems:'center'}}><label><input type="checkbox" checked={profileConfig.isDefaultOpen} onChange={(e)=>updateSectionState('profile', 'isDefaultOpen', e.target.checked)}/> 초기 펼침</label><button onClick={()=>updateSectionState('profile', 'isOpenInAdmin', !profileConfig.isOpenInAdmin)}>{profileConfig.isOpenInAdmin ? '접기' : '편집'}</button></div></div>{profileConfig.isOpenInAdmin && <div style={{padding:'20px', textAlign:'center'}}><img src={formData.profile_img || "/profile_default.jpg"} style={{width:'80px', height:'80px', borderRadius:'50%'}} /><br/><label style={{cursor:'pointer', color:'blue', fontSize:'0.9rem'}}>사진 변경 <input type="file" hidden onChange={handleImageUpload}/></label><input value={formData.name || ''} onChange={e=>setFormData({...formData, name:e.target.value})} placeholder="이름" style={inputStyle}/><input value={formData.role || ''} onChange={e=>setFormData({...formData, role:e.target.value})} placeholder="직함" style={inputStyle}/><textarea value={formData.intro || ''} onChange={e=>setFormData({...formData, intro:e.target.value})} placeholder="소개" style={{...inputStyle, height:'80px'}}/></div>}</div></div>
        
        {/* 드래그 섹션 */}
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
                <div style={{background:'white', padding:'20px', borderRadius:'15px', width:'350px', maxHeight:'80vh', display:'flex', flexDirection:'column'}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                        <h3 style={{margin:0}}>💎 토큰 기록</h3>
                        <button onClick={()=>setShowTokenHistory(false)} style={{border:'none', background:'none', fontSize:'1.2rem', cursor:'pointer'}}>×</button>
                    </div>
                    <div style={{display:'flex', marginBottom:'15px', borderBottom:'1px solid #eee'}}>
                        <button onClick={()=>setTokenTab('all')} style={{flex:1, padding:'10px', border:'none', background: tokenTab==='all'?'#1a237e':'white', color: tokenTab==='all'?'white':'#666', cursor:'pointer'}}>전체</button>
                        <button onClick={()=>setTokenTab('usage')} style={{flex:1, padding:'10px', border:'none', background: tokenTab==='usage'?'#1a237e':'white', color: tokenTab==='usage'?'white':'#666', cursor:'pointer'}}>차감 내역</button>
                        <button onClick={()=>setTokenTab('income')} style={{flex:1, padding:'10px', border:'none', background: tokenTab==='income'?'#1a237e':'white', color: tokenTab==='income'?'white':'#666', cursor:'pointer'}}>지급/충전</button>
                    </div>
                    <div style={{flex:1, overflowY:'auto'}}>
                        {tokenTab === 'usage' && (
                            <div>
                                {Object.entries(getUsageGroups()).map(([reason, group]:any) => (
                                    <details key={reason} style={{marginBottom:'10px', border:'1px solid #eee', borderRadius:'8px', padding:'10px'}}>
                                        <summary style={{cursor:'pointer', fontWeight:'bold', display:'flex', justifyContent:'space-between'}}><span>{reason} ({group.count}회)</span><span style={{color:'red'}}>-{group.total}</span></summary>
                                        <div style={{marginTop:'10px', paddingTop:'10px', borderTop:'1px dashed #eee', fontSize:'0.85rem'}}>
                                            {group.items.map((log:any, idx:number) => (<div key={idx} style={{display:'flex', justifyContent:'space-between', marginBottom:'5px', color:'#666'}}><span>{log.dateStr} {log.timeStr}</span><span>{log.amount}</span></div>))}
                                        </div>
                                    </details>
                                ))}
                                {Object.keys(getUsageGroups()).length === 0 && <div style={{textAlign:'center', color:'#999'}}>사용 내역이 없습니다.</div>}
                            </div>
                        )}
                        {(tokenTab === 'all' || tokenTab === 'income') && (
                            <table style={{width:'100%', borderCollapse:'collapse', fontSize:'0.9rem'}}>
                                <thead style={{background:'#f9f9f9', color:'#666'}}><tr><th style={{padding:'8px', textAlign:'left'}}>날짜</th><th style={{padding:'8px', textAlign:'left'}}>내용</th><th style={{padding:'8px', textAlign:'right'}}>변동</th></tr></thead>
                                <tbody>
                                    {tokenLogs.filter(l => tokenTab === 'all' ? true : l.amount > 0).map((log) => (<tr key={log.id} style={{borderBottom:'1px solid #f0f0f0'}}><td style={{padding:'8px', color:'#666', fontSize:'0.8rem'}}>{log.dateStr}<br/>{log.timeStr}</td><td style={{padding:'8px'}}>{log.reason}</td><td style={{padding:'8px', textAlign:'right', fontWeight:'bold', color: log.amount>0?'green':'red'}}>{log.amount > 0 ? '+' : ''}{log.amount}</td></tr>))}
                                    {tokenLogs.filter(l => tokenTab === 'all' ? true : l.amount > 0).length === 0 && (<tr><td colSpan={3} style={{padding:'20px', textAlign:'center', color:'#999'}}>내역이 없습니다.</td></tr>)}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        )}
        {showPreview && (
            <div style={modalOverlay}>
                <div style={{background:'white', width:'360px', height:'640px', display:'flex', flexDirection:'column'}}>
                    <iframe src={`/${myCardId}`} style={{flex:1, border:'none'}} />
                    <button onClick={()=>setShowPreview(false)} style={closeBtn}>닫기</button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}

// ✨ 스타일 변수 정의 (누락되었던 부분들 복구)
const centerStyle = {display:'flex', justifyContent:'center', alignItems:'center', height:'100vh'};
const inputStyle = {width:'100%', padding:'10px', marginBottom:'5px', border:'1px solid #ddd', borderRadius:'5px', boxSizing:'border-box' as 'border-box'};
const titleInputStyle = {fontWeight:'bold' as 'bold', fontSize:'1rem', border:'none', background:'transparent', borderBottom:'1px dashed #999', width:'70%'};
const itemBoxStyle = {background:'#f9f9f9', padding:'10px', marginBottom:'5px', borderRadius:'5px', border:'1px solid #eee'};
const addBtn = {width:'100%', padding:'10px', background:'#e3f2fd', border:'none', cursor:'pointer', borderRadius:'5px', fontWeight:'bold' as 'bold'};
const saveBtn = {flex:1, padding:'15px', background:'#424242', color:'white', border:'none', cursor:'pointer', borderRadius:'10px', fontWeight:'bold' as 'bold'};
const tokenBtnStyle = {background:'#fff9c4', border:'1px solid #fbc02d', borderRadius:'20px', padding:'5px 12px', fontSize:'0.9rem', fontWeight:'bold' as 'bold', cursor:'pointer', color:'#f57f17'};
const logoutBtnStyle = {padding:'5px 10px', border:'1px solid #ddd', background:'white', borderRadius:'5px', cursor:'pointer'};
const modalOverlay = {position:'fixed' as 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:999};
const modalContent = {background:'white', padding:'20px', borderRadius:'10px', width:'300px'};
const closeBtn = {width:'100%', padding:'10px', background:'#333', color:'white', border:'none', borderRadius:'5px', marginTop:'10px', cursor:'pointer'};