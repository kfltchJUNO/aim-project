// app/admin/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { db, auth, storage } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, updateDoc, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// 버튼 종류 리스트 (아이콘 매핑용)
const LINK_TYPES = [
  { label: "📞 휴대폰 (전화걸기)", value: "mobile" },
  { label: "☎️ 유선전화 (전화걸기)", value: "tel" },
  { label: "📧 이메일 (메일보내기)", value: "email" },
  { label: "🏠 홈페이지/블로그", value: "web" },
  { label: "💬 카카오톡 오픈채팅", value: "kakao" },
  { label: "📷 인스타그램", value: "insta" },
  { label: "📺 유튜브", value: "youtube" },
  { label: "🔗 기타 링크", value: "other" },
];

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [myCardId, setMyCardId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>(null);
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const q = query(collection(db, "users"), where("owner_email", "==", u.email));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0];
          setMyCardId(d.id);
          // links가 없으면 빈 배열로 초기화
          setFormData({ ...d.data(), links: d.data().links || [] });
          setCredits(d.data().credits || 0);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => await signInWithPopup(auth, new GoogleAuthProvider());
  const handleLogout = async () => { await signOut(auth); window.location.reload(); };

  const handleSave = async () => {
    if (!myCardId) return;
    if (!confirm("저장하시겠습니까?")) return;
    await updateDoc(doc(db, "users", myCardId), {
        name: formData.name, 
        role: formData.role, 
        intro: formData.intro, 
        tmi_data: formData.tmi_data, 
        profile_img: formData.profile_img,
        links: formData.links // 링크 데이터 저장
    });
    alert("✅ 저장되었습니다.");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !myCardId) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `profile_images/${myCardId}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setFormData({ ...formData, profile_img: url });
      alert("이미지가 업로드되었습니다! (저장하기를 눌러 확정하세요)");
    } catch (error) { console.error(error); alert("이미지 업로드 실패"); } 
    finally { setUploading(false); }
  };

  const handleAiFeedback = async () => {
    if (credits < 10) return alert("토큰이 부족합니다. (필요: 10개)");
    if (!confirm(`토큰 10개를 사용하여 AI 분석을 받으시겠습니까?`)) return;
    setAiLoading(true);
    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ context: formData, mode: 'summary' })
        });
        const data = await res.json();
        await updateDoc(doc(db, "users", myCardId!), { credits: increment(-10) });
        setCredits(prev => prev - 10);
        alert(`[AI 피드백]\n\n${data.reply}`);
    } catch (e) { alert("오류 발생"); } 
    finally { setAiLoading(false); }
  };

  // --- 링크 관리 함수들 ---
  const addLink = () => {
    setFormData({ ...formData, links: [...formData.links, { type: 'mobile', value: '', name: '' }] });
  };
  const removeLink = (index: number) => {
    const newLinks = formData.links.filter((_:any, i:number) => i !== index);
    setFormData({ ...formData, links: newLinks });
  };
  const updateLink = (index: number, field: string, value: string) => {
    const newLinks = [...formData.links];
    newLinks[index][field] = value;
    setFormData({ ...formData, links: newLinks });
  };

  if (loading) return <div>로딩 중...</div>;
  if (!user) return <div style={{textAlign:'center', marginTop:'100px'}}><h1 style={{marginBottom:'20px'}}>관리자 로그인</h1><button onClick={handleLogin} style={saveBtn}>구글 로그인</button></div>;

  return (
    <div className="main-wrapper" style={{flexDirection:'column', alignItems:'center', marginTop:'30px'}}>
      <div className="container">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'2px solid #eee', paddingBottom:'10px'}}>
            <h2 style={{color:'#1a237e', margin:0}}>⚙️ 정보 수정</h2>
            <button onClick={handleLogout} style={{fontSize:'0.8rem', border:'1px solid #ddd', background:'white', padding:'5px 10px', borderRadius:'5px', cursor:'pointer'}}>로그아웃</button>
        </div>
        
        {myCardId ? (
            <div style={{display:'flex', flexDirection:'column', gap:'15px', marginTop:'20px'}}>
                
                {/* 프로필 이미지 */}
                <div style={{textAlign:'center', padding:'15px', border:'1px dashed #ccc', borderRadius:'10px'}}>
                  <div style={{width:'100px', height:'100px', borderRadius:'50%', overflow:'hidden', margin:'0 auto 10px', border:'1px solid #ddd', background:'#eee'}}>
                    <img src={formData.profile_img || "/profile_default.jpg"} alt="프로필" style={{width:'100%', height:'100%', objectFit:'cover'}} onError={(e)=>e.currentTarget.src='https://placehold.co/150'}/>
                  </div>
                  <label style={{display:'inline-block', padding:'8px 15px', background:'#555', color:'white', borderRadius:'5px', cursor:'pointer', fontSize:'0.9rem', fontWeight:'bold'}}>
                      {uploading ? "업로드 중..." : "📷 사진 변경"}
                      <input type="file" accept="image/*" onChange={handleImageUpload} style={{display:'none'}} disabled={uploading}/>
                  </label>
                </div>

                <label>이름 <input value={formData.name || ''} onChange={e=>setFormData({...formData, name:e.target.value})} style={inputStyle}/></label>
                <label>직함 <input value={formData.role || ''} onChange={e=>setFormData({...formData, role:e.target.value})} style={inputStyle}/></label>
                <label>소개 <textarea value={formData.intro || ''} onChange={e=>setFormData({...formData, intro:e.target.value})} style={{...inputStyle, height:'80px'}}/></label>

                {/* --- [신규] 링크 관리 섹션 --- */}
                <div style={{background:'#e3f2fd', padding:'15px', borderRadius:'10px', border:'1px solid #bbdefb'}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                        <label style={{color:'#1565c0', fontWeight:'bold', fontSize:'1rem'}}>🔗 연락처 및 링크 관리</label>
                        <button onClick={addLink} style={{background:'#1565c0', color:'white', border:'none', borderRadius:'5px', padding:'5px 10px', cursor:'pointer', fontWeight:'bold'}}>+ 추가</button>
                    </div>
                    
                    {formData.links && formData.links.map((link:any, idx:number) => (
                        <div key={idx} style={{background:'white', padding:'10px', borderRadius:'8px', marginBottom:'8px', border:'1px solid #ddd'}}>
                            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                                <span style={{fontSize:'0.8rem', fontWeight:'bold', color:'#666'}}>#{idx+1}</span>
                                <button onClick={()=>removeLink(idx)} style={{background:'red', color:'white', border:'none', borderRadius:'3px', padding:'2px 6px', cursor:'pointer', fontSize:'0.7rem'}}>삭제</button>
                            </div>
                            
                            <select 
                                value={link.type} 
                                onChange={(e)=>updateLink(idx, 'type', e.target.value)}
                                style={{...inputStyle, marginBottom:'5px', marginTop:0}}
                            >
                                {LINK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>

                            <input 
                                placeholder={link.type === 'mobile' || link.type === 'tel' ? "전화번호 (010-1234-5678)" : "URL 또는 이메일 주소"}
                                value={link.value}
                                onChange={(e)=>updateLink(idx, 'value', e.target.value)}
                                style={{...inputStyle, marginTop:0}}
                            />
                        </div>
                    ))}
                    {(!formData.links || formData.links.length === 0) && <p style={{textAlign:'center', color:'#999', fontSize:'0.9rem'}}>등록된 링크가 없습니다. '+ 추가' 버튼을 눌러보세요!</p>}
                </div>
                {/* --------------------------- */}
                
                <div style={{background:'#f9f9f9', padding:'15px', borderRadius:'10px'}}>
                    <div style={{display:'flex', justifyContent:'space-between'}}>
                        <label style={{color:'#448aff', fontWeight:'bold'}}>🤖 AI 학습 데이터 (TMI)</label>
                        <button onClick={handleAiFeedback} disabled={aiLoading} style={{background:'#448aff', color:'white', border:'none', borderRadius:'5px', padding:'5px 10px', fontSize:'0.8rem', cursor:'pointer'}}>
                            {aiLoading ? "분석 중..." : "✨ AI 분석 (-10💎)"}
                        </button>
                    </div>
                    <textarea value={formData.tmi_data || ''} onChange={e=>setFormData({...formData, tmi_data:e.target.value})} style={{...inputStyle, height:'120px'}} placeholder="AI만 아는 비밀 이야기를 적어주세요."/>
                </div>

                <button onClick={handleSave} style={saveBtn}>저장하기</button>
            </div>
        ) : (
            <div style={{marginTop:'50px', textAlign:'center', color:'#666'}}>등록된 명함이 없습니다.<br/>(이메일이 일치하지 않습니다)</div>
        )}
      </div>
    </div>
  );
}

const inputStyle = { width:'100%', padding:'10px', border:'1px solid #ddd', borderRadius:'5px', marginTop:'5px', boxSizing:'border-box' as 'border-box' };
const saveBtn = { width:'100%', padding:'15px', background:'#1a237e', color:'white', border:'none', borderRadius:'10px', fontWeight:'bold', cursor:'pointer', marginTop:'10px' };