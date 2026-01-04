// app/admin/master/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { collection, getDocs, doc, updateDoc, increment, query, getDoc, setDoc } from 'firebase/firestore';

const SUPER_ADMIN_EMAIL = "ot.helper7@gmail.com";

export default function MasterPage() {
  const [user, setUser] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [customAmount, setCustomAmount] = useState(0);
  const [eventConfig, setEventConfig] = useState({ isActive: false, keyword: '', prizeMsg: '' });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u?.email === SUPER_ADMIN_EMAIL) {
          fetchUsers();
          fetchEventConfig();
      } else setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchUsers = async () => {
    const q = query(collection(db, "users"));
    const snap = await getDocs(q);
    setUsersList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  const fetchEventConfig = async () => {
    try {
        const docSnap = await getDoc(doc(db, "settings", "events"));
        if (docSnap.exists()) setEventConfig(docSnap.data() as any);
    } catch (e) { console.log("설정 로드 중..."); }
  };

  const saveEventConfig = async () => {
    await setDoc(doc(db, "settings", "events"), eventConfig);
    alert("✅ 이벤트 설정 저장됨");
  };

  const handleCredit = async (userId: string, amount: number, currentName: string) => {
    if (amount === 0) return;
    if (!confirm(`${currentName}님에게 토큰 ${amount} 적용?`)) return;
    await updateDoc(doc(db, "users", userId), { credits: increment(amount) });
    alert("처리 완료");
    fetchUsers();
  };

  const handleLogin = async () => await signInWithPopup(auth, new GoogleAuthProvider());

  if (loading) return <div>로딩 중...</div>;
  if (user?.email !== SUPER_ADMIN_EMAIL) return <div style={{textAlign:'center', marginTop:'50px'}}><h1 style={{color:'red'}}>⛔ 접근 불가</h1><button onClick={handleLogin}>관리자 로그인</button></div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{fontSize:'1.8rem', fontWeight:'bold', marginBottom:'20px', color:'#1a237e'}}>👑 Master Admin</h1>
      
      {/* 토큰 관리 */}
      <div style={{background:'#f5f5f5', padding:'15px', borderRadius:'10px', marginBottom:'20px', display:'flex', gap:'10px', alignItems:'center'}}>
        <span>🔢 직접 입력:</span>
        <input type="number" value={customAmount} onChange={(e) => setCustomAmount(Number(e.target.value))} placeholder="예: 500" style={{padding:'8px', borderRadius:'5px'}}/>
      </div>

      <div style={{ display: 'grid', gap: '15px', maxHeight:'400px', overflowY:'auto' }}>
        {usersList.map((u) => (
          <div key={u.id} style={{ border:'1px solid #eee', padding:'15px', borderRadius:'10px', display:'flex', justifyContent:'space-between' }}>
            <div><strong>{u.name}</strong> ({u.id}) <div style={{color:'blue'}}>💎 {u.credits || 0}</div></div>
            <div style={{display:'flex', gap:'5px'}}>
                <button onClick={() => handleCredit(u.id, customAmount, u.name)} style={{background:'#333', color:'white', padding:'5px', borderRadius:'5px'}}>적용</button>
                <button onClick={() => handleCredit(u.id, 1000, u.name)} style={{background:'#1a237e', color:'white', padding:'5px', borderRadius:'5px'}}>+1k</button>
            </div>
          </div>
        ))}
      </div>

      {/* 이벤트 설정 */}
      <div style={{marginTop:'50px', borderTop:'2px dashed #ddd', paddingTop:'30px'}}>
        <h2 style={{color:'#e65100', marginBottom:'15px'}}>🎉 이벤트 관제 센터</h2>
        <div style={{background:'#fff3e0', padding:'20px', borderRadius:'10px', display:'grid', gap:'10px'}}>
            <label style={{fontWeight:'bold'}}><input type="checkbox" checked={eventConfig.isActive} onChange={(e)=>setEventConfig({...eventConfig, isActive: e.target.checked})}/> 이벤트 활성화</label>
            <input value={eventConfig.keyword} onChange={(e)=>setEventConfig({...eventConfig, keyword:e.target.value})} placeholder="보물 키워드 (예: 오준호천재)" style={{padding:'10px'}}/>
            <textarea value={eventConfig.prizeMsg} onChange={(e)=>setEventConfig({...eventConfig, prizeMsg:e.target.value})} placeholder="당첨 메시지" style={{padding:'10px', height:'60px'}}/>
            <button onClick={saveEventConfig} style={{padding:'10px', background:'#e65100', color:'white', borderRadius:'5px', fontWeight:'bold'}}>설정 저장</button>
        </div>
      </div>
    </div>
  );
}