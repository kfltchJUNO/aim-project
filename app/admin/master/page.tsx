// app/admin/master/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { collection, getDocs, doc, query, getDoc, setDoc, writeBatch, serverTimestamp, where, orderBy } from 'firebase/firestore';

const SUPER_ADMIN_EMAIL = "ot.helper7@gmail.com";

export default function MasterPage() {
  const [user, setUser] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 1. 토큰 지급 관련
  const [customAmount, setCustomAmount] = useState(0);
  const [customReason, setCustomReason] = useState("관리자 지급");

  // 2. 이벤트 설정 관련
  const [eventConfig, setEventConfig] = useState({ 
      isActive: false, keyword: '', prizeMsg: '', minToken: 10, maxToken: 100 
  });

  // 3. 당첨 대기 목록
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u?.email === SUPER_ADMIN_EMAIL) {
          fetchUsers();
          fetchEventConfig();
          fetchPendingClaims(); // 대기 목록 로드
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
    } catch (e) { console.log("설정 로드 실패"); }
  };

  const fetchPendingClaims = async () => {
      try {
          // status가 'pending'인 것만 조회
          const q = query(
              collection(db, "event_claims"), 
              where("status", "==", "pending"),
              orderBy("claimedAt", "desc")
          );
          const snap = await getDocs(q);
          setPendingClaims(snap.docs.map(d => ({ 
              id: d.id, 
              ...d.data(),
              dateStr: d.data().claimedAt?.toDate().toLocaleString() 
          })));
      } catch (e) { console.error("대기 목록 로드 실패", e); }
  };

  const saveEventConfig = async () => {
    await setDoc(doc(db, "settings", "events"), eventConfig);
    alert("✅ 이벤트 설정 저장됨");
  };

  // 일반 지급
  const handleCredit = async (userId: string, currentCredits: number, amount: number, userName: string) => {
    if (amount === 0) return;
    const reason = prompt(`${userName}님에게 ${amount} 토큰 지급/차감 사유:`, customReason) || "관리자 조정";
    try {
        const batch = writeBatch(db);
        const userRef = doc(db, "users", userId);
        batch.update(userRef, { credits: (currentCredits || 0) + amount });
        const logRef = doc(collection(db, "users", userId, "logs"));
        batch.set(logRef, { type: amount > 0 ? '충전(관리자)' : '차감(관리자)', amount, reason, date: serverTimestamp() });
        await batch.commit();
        alert("처리 완료");
        fetchUsers();
    } catch (e) { alert("오류 발생"); }
  };

  // 💎 [NEW] 이벤트 당첨 승인 처리
  const handleApproveClaim = async (claim: any) => {
      if(!confirm(`'${claim.userName}'님에게 당첨금 ${claim.amount} 토큰을 지급하시겠습니까?`)) return;

      try {
          const batch = writeBatch(db);

          // 1. 유저 토큰 지급
          const userRef = doc(db, "users", claim.userId);
          // 현재 유저 정보 찾기 (최신 크레딧 확인용)
          const currentUser = usersList.find(u => u.id === claim.userId);
          const currentCredit = currentUser ? (currentUser.credits || 0) : 0;
          batch.update(userRef, { credits: currentCredit + claim.amount });

          // 2. 유저 로그 기록
          const logRef = doc(collection(db, "users", claim.userId, "logs"));
          batch.set(logRef, {
              type: '이벤트 당첨',
              amount: claim.amount,
              reason: `키워드 이벤트 당첨 (${claim.keyword})`,
              date: serverTimestamp()
          });

          // 3. 신청서 상태 변경 (pending -> approved)
          const claimRef = doc(db, "event_claims", claim.id);
          batch.update(claimRef, { status: 'approved', approvedAt: serverTimestamp() });

          await batch.commit();
          alert("✅ 지급 완료!");
          fetchUsers(); // 유저 목록 갱신
          fetchPendingClaims(); // 대기 목록 갱신
      } catch (e) {
          console.error(e);
          alert("처리 중 오류가 발생했습니다.");
      }
  };

  // 💎 [NEW] 이벤트 당첨 거절 처리
  const handleRejectClaim = async (claimId: string) => {
      if(!confirm("이 당첨 내역을 취소(거절)하시겠습니까?")) return;
      try {
          await setDoc(doc(db, "event_claims", claimId), { status: 'rejected' }, { merge: true });
          alert("취소되었습니다.");
          fetchPendingClaims();
      } catch(e) { alert("오류 발생"); }
  };

  const toggleAi = async (userId: string, currentStatus: boolean) => {
      if(!confirm("AI 기능을 변경하시겠습니까?")) return;
      const batch = writeBatch(db);
      const userRef = doc(db, "users", userId);
      batch.update(userRef, { enable_ai: !currentStatus });
      await batch.commit();
      setUsersList(prev => prev.map(u => u.id === userId ? {...u, enable_ai: !currentStatus} : u));
  };

  const handleLogout = async () => { await signOut(auth); window.location.href = "/"; };
  const handleLogin = async () => await signInWithPopup(auth, new GoogleAuthProvider());

  if (loading) return <div>로딩 중...</div>;
  if (user?.email !== SUPER_ADMIN_EMAIL) return <div style={{textAlign:'center', marginTop:'50px'}}><h1 style={{color:'red'}}>⛔ 접근 불가</h1><button onClick={handleLogin}>관리자 로그인</button></div>;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px', paddingBottom:'100px' }}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
        <h1 style={{fontSize:'1.8rem', fontWeight:'bold', color:'#1a237e', margin:0}}>👑 Master Admin</h1>
        <button onClick={handleLogout} style={{padding:'8px 12px', background:'#444', color:'white', border:'none', borderRadius:'5px', cursor:'pointer'}}>로그아웃</button>
      </div>
      
      {/* 1. 토큰 일괄 관리 */}
      <div style={{background:'#e3f2fd', padding:'20px', borderRadius:'10px', marginBottom:'20px', display:'flex', gap:'20px', alignItems:'center', flexWrap:'wrap'}}>
        <div style={{display:'flex', flexDirection:'column'}}>
            <label style={{fontSize:'0.8rem', fontWeight:'bold', color:'#1565c0'}}>지급량</label>
            <input type="number" value={customAmount} onChange={(e) => setCustomAmount(Number(e.target.value))} placeholder="100" style={{padding:'8px', borderRadius:'5px', border:'1px solid #90caf9', width:'80px'}}/>
        </div>
        <div style={{display:'flex', flexDirection:'column', flex:1}}>
            <label style={{fontSize:'0.8rem', fontWeight:'bold', color:'#1565c0'}}>사유</label>
            <input type="text" value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder="사유 입력" style={{padding:'8px', borderRadius:'5px', border:'1px solid #90caf9'}}/>
        </div>
      </div>

      {/* 2. 유저 목록 */}
      <div style={{ display: 'grid', gap: '10px', maxHeight:'400px', overflowY:'auto', border:'1px solid #eee', borderRadius:'10px', padding:'10px' }}>
        {usersList.map((u) => (
          <div key={u.id} style={{ borderBottom:'1px solid #eee', padding:'10px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
                <div style={{fontSize:'1rem', fontWeight:'bold'}}>{u.name} <span style={{fontSize:'0.8rem', color:'#888'}}>({u.id})</span></div>
                <div style={{color:'#1565c0', fontWeight:'bold', fontSize:'0.9rem'}}>💎 {u.credits || 0}</div>
            </div>
            <div style={{textAlign:'right', display:'flex', gap:'5px', alignItems:'center'}}>
                <button onClick={() => toggleAi(u.id, u.enable_ai)} style={{padding:'5px', borderRadius:'5px', border:'none', cursor:'pointer', fontSize:'0.7rem', background: u.enable_ai ? '#e8f5e9' : '#ffebee', color: u.enable_ai ? '#2e7d32' : '#c62828'}}>
                    {u.enable_ai ? 'AI ON' : 'AI OFF'}
                </button>
                <button onClick={() => handleCredit(u.id, u.credits, customAmount, u.name)} style={{background:'#1a237e', color:'white', padding:'5px 10px', borderRadius:'5px', border:'none', cursor:'pointer', fontSize:'0.8rem'}}>지급/차감</button>
            </div>
          </div>
        ))}
      </div>

      {/* 3. 이벤트 설정 센터 (수정됨) */}
      <div style={{marginTop:'40px', borderTop:'3px solid #eee', paddingTop:'30px'}}>
        <h2 style={{color:'#e65100', marginBottom:'15px'}}>🎉 이벤트 관제 센터</h2>
        
        {/* 설정값 입력 */}
        <div style={{background:'#fff3e0', padding:'20px', borderRadius:'10px', display:'grid', gap:'15px'}}>
            <label style={{fontWeight:'bold', display:'flex', alignItems:'center', gap:'10px'}}>
                <input type="checkbox" checked={eventConfig.isActive} onChange={(e)=>setEventConfig({...eventConfig, isActive: e.target.checked})} style={{transform:'scale(1.5)'}}/> 
                이벤트 활성화 (ON/OFF)
            </label>
            
            <div style={{display:'flex', gap:'10px'}}>
                <div style={{flex:1}}>
                    <label style={{fontSize:'0.8rem', color:'#e65100'}}>당첨 키워드</label>
                    <input value={eventConfig.keyword} onChange={(e)=>setEventConfig({...eventConfig, keyword:e.target.value})} placeholder="예: 보물찾기" style={{padding:'10px', border:'1px solid #ffe0b2', width:'100%', borderRadius:'5px'}}/>
                </div>
                <div style={{width:'100px'}}>
                    <label style={{fontSize:'0.8rem', color:'#e65100'}}>최소 토큰</label>
                    <input type="number" value={eventConfig.minToken} onChange={(e)=>setEventConfig({...eventConfig, minToken:Number(e.target.value)})} style={{padding:'10px', border:'1px solid #ffe0b2', width:'100%', borderRadius:'5px'}}/>
                </div>
                <div style={{width:'100px'}}>
                    <label style={{fontSize:'0.8rem', color:'#e65100'}}>최대 토큰</label>
                    <input type="number" value={eventConfig.maxToken} onChange={(e)=>setEventConfig({...eventConfig, maxToken:Number(e.target.value)})} style={{padding:'10px', border:'1px solid #ffe0b2', width:'100%', borderRadius:'5px'}}/>
                </div>
            </div>

            <div>
                <label style={{fontSize:'0.8rem', color:'#e65100'}}>당첨 시 AI 답변 메시지</label>
                <textarea value={eventConfig.prizeMsg} onChange={(e)=>setEventConfig({...eventConfig, prizeMsg:e.target.value})} placeholder="축하합니다! 관리자 승인 후 토큰이 지급됩니다." style={{padding:'10px', height:'50px', border:'1px solid #ffe0b2', width:'100%', borderRadius:'5px'}}/>
            </div>
            
            <button onClick={saveEventConfig} style={{padding:'12px', background:'#e65100', color:'white', borderRadius:'5px', fontWeight:'bold', border:'none', cursor:'pointer'}}>설정 저장하기</button>
        </div>

        {/* 4. 승인 대기 목록 (NEW) */}
        <div style={{marginTop:'30px'}}>
            <h3 style={{color:'#d84315'}}>⏳ 승인 대기 목록 ({pendingClaims.length}건)</h3>
            {pendingClaims.length === 0 ? <p style={{color:'#999'}}>대기 중인 요청이 없습니다.</p> : (
                <div style={{display:'grid', gap:'10px'}}>
                    {pendingClaims.map(claim => (
                        <div key={claim.id} style={{background:'white', border:'2px solid #ffcc80', padding:'15px', borderRadius:'10px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <div>
                                <div style={{fontWeight:'bold', fontSize:'1.1rem'}}>{claim.userName} <span style={{fontWeight:'normal', fontSize:'0.9rem'}}>({claim.userId})</span></div>
                                <div style={{color:'#666', fontSize:'0.8rem'}}>키워드: "{claim.keyword}" / {claim.dateStr}</div>
                                <div style={{color:'#d84315', fontWeight:'bold'}}>🎁 당첨금: {claim.amount} 토큰</div>
                            </div>
                            <div style={{display:'flex', gap:'5px'}}>
                                <button onClick={()=>handleApproveClaim(claim)} style={{padding:'10px 15px', background:'#2e7d32', color:'white', border:'none', borderRadius:'5px', fontWeight:'bold', cursor:'pointer'}}>승인</button>
                                <button onClick={()=>handleRejectClaim(claim.id)} style={{padding:'10px 15px', background:'#c62828', color:'white', border:'none', borderRadius:'5px', fontWeight:'bold', cursor:'pointer'}}>거절</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

      </div>
    </div>
  );
}