// app/admin/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { db, auth, storage } from '@/lib/firebase'; // storage 추가
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, updateDoc, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // 업로드 함수들

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [myCardId, setMyCardId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>(null);
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [uploading, setUploading] = useState(false); // 업로드 상태

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const q = query(collection(db, "users"), where("owner_email", "==", u.email));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0];
          setMyCardId(d.id);
          setFormData(d.data());
          setCredits(d.data().credits || 0);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => await signInWithPopup(auth, new GoogleAuthProvider());
  const handleLogout = async () => { await signOut(auth); window.location.reload(); };

  // 저장하기
  const handleSave = async () => {
    if (!myCardId) return;
    if (!confirm("저장하시겠습니까?")) return;
    await updateDoc(doc(db, "users", myCardId), {
        name: formData.name, role: formData.role, intro: formData.intro, 
        tmi_data: formData.tmi_data, profile_img: formData.profile_img
    });
    alert("✅ 저장되었습니다.");
  };

  // ★ 이미지 파일 업로드 함수
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !myCardId) return;

    setUploading(true);
    try {
      // 1. 저장할 경로 설정 (profile_images/유저ID_시간)
      const storageRef = ref(storage, `profile_images/${myCardId}_${Date.now()}`);
      
      // 2. 파일 업로드
      await uploadBytes(storageRef, file);
      
      // 3. 다운로드 URL 가져오기
      const url = await getDownloadURL(storageRef);
      
      // 4. 상태 업데이트 (저장 버튼 누를 때 최종 DB 반영)
      setFormData({ ...formData, profile_img: url });
      alert("이미지가 업로드되었습니다! (저장하기를 눌러 확정하세요)");
    } catch (error) {
      console.error(error);
      alert("이미지 업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  // AI 피드백
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

  if (loading) return <div>로딩 중...</div>;
  if (!user) return <div style={{textAlign:'center', marginTop:'100px'}}><h1 style={{marginBottom:'20px'}}>관리자 로그인</h1><button onClick={handleLogin} style={saveBtn}>구글 로그인</button></div>;

  return (
    <div className="main-wrapper" style={{flexDirection:'column', alignItems:'center', marginTop:'30px'}}>
      <div className="container">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'2px solid #eee', paddingBottom:'10px'}}>
            <h2 style={{color:'#1a237e', margin:0}}>⚙️ 정보 수정</h2>
            <button onClick={handleLogout} style={{fontSize:'0.8rem', border:'1px solid #ddd', background:'white', padding:'5px 10px', borderRadius:'5px', cursor:'pointer'}}>로그아웃</button>
        </div>
        
        <div style={{background:'#e8eaf6', padding:'15px', borderRadius:'10px', margin:'20px 0', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <span style={{fontWeight:'bold'}}>💎 보유 토큰</span>
            <span style={{fontSize:'1.2rem', color:'#1a237e', fontWeight:'800'}}>{credits.toLocaleString()} 개</span>
        </div>

        {myCardId ? (
            <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                
                {/* 프로필 이미지 업로드 섹션 */}
                <div style={{textAlign:'center', padding:'15px', border:'1px dashed #ccc', borderRadius:'10px'}}>
                  <div style={{width:'100px', height:'100px', borderRadius:'50%', overflow:'hidden', margin:'0 auto 10px', border:'1px solid #ddd', background:'#eee'}}>
                    <img 
                        src={formData.profile_img || "/profile_default.jpg"} 
                        alt="프로필" style={{width:'100%', height:'100%', objectFit:'cover'}}
                        onError={(e)=>e.currentTarget.src='https://placehold.co/150'}
                    />
                  </div>
                  
                  <label style={{
                      display:'inline-block', padding:'8px 15px', background:'#555', color:'white', 
                      borderRadius:'5px', cursor:'pointer', fontSize:'0.9rem', fontWeight:'bold'
                  }}>
                      {uploading ? "업로드 중... ⏳" : "📷 사진 변경 (파일 선택)"}
                      <input type="file" accept="image/*" onChange={handleImageUpload} style={{display:'none'}} disabled={uploading}/>
                  </label>
                </div>

                <label>이름 <input value={formData.name || ''} onChange={e=>setFormData({...formData, name:e.target.value})} style={inputStyle}/></label>
                <label>직함 <input value={formData.role || ''} onChange={e=>setFormData({...formData, role:e.target.value})} style={inputStyle}/></label>
                <label>소개 <textarea value={formData.intro || ''} onChange={e=>setFormData({...formData, intro:e.target.value})} style={{...inputStyle, height:'80px'}}/></label>
                
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
            <div>등록된 명함이 없습니다. (이메일 불일치)</div>
        )}
      </div>
    </div>
  );
}

const inputStyle = { width:'100%', padding:'10px', border:'1px solid #ddd', borderRadius:'5px', marginTop:'5px' };
const saveBtn = { width:'100%', padding:'15px', background:'#1a237e', color:'white', border:'none', borderRadius:'10px', fontWeight:'bold', cursor:'pointer', marginTop:'10px' };