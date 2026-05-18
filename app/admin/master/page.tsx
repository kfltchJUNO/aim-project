// app/admin/master/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import {
  collection, getDocs, doc, query, getDoc, setDoc,
  writeBatch, serverTimestamp, where, updateDoc, addDoc
} from 'firebase/firestore';

const SUPER_ADMIN_EMAIL = "ot.helper7@gmail.com";

type User = {
  id: string;
  name: string;
  role: string;
  owner_email: string;
  credits: number;
  aiEnabled: boolean;
  custom_knowledge: string[];
  profile_img: string;
  isActive: boolean;
  expiresAt: string;
  adminMemo: string;
  autoRefillAmount: number;
  autoRefillDay: number;
  paidTotal: number;
};

export default function MasterPage() {
  const [user,          setUser]          = useState<any>(null);
  const [usersList,     setUsersList]     = useState<User[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [activeTab,     setActiveTab]     = useState<'users' | 'stats' | 'event' | 'notice'>('users');

  const [customAmount,  setCustomAmount]  = useState(0);
  const [customReason,  setCustomReason]  = useState('관리자 지급');

  const [eventConfig,   setEventConfig]   = useState({
    isActive: false, keyword: '', prizeMsg: '', minToken: 10, maxToken: 100,
  });
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);

  const [noticeText,    setNoticeText]    = useState('');
  const [noticeActive,  setNoticeActive]  = useState(false);

  const [payModal,      setPayModal]      = useState<{ userId: string; userName: string } | null>(null);
  const [payAmount,     setPayAmount]     = useState(0);
  const [payNote,       setPayNote]       = useState('');

  const [editModal,     setEditModal]     = useState<User | null>(null);

  const [totalVisits,   setTotalVisits]   = useState(0);
  const [todayVisits,   setTodayVisits]   = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async u => {
      setUser(u);
      if (u?.email === SUPER_ADMIN_EMAIL) {
        await Promise.all([fetchUsers(), fetchEventConfig(), fetchPendingClaims(), fetchNotice()]);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // ── 데이터 로드 ────────────────────────────────────────────────────────────
  const fetchUsers = async () => {
    const snap = await getDocs(collection(db, 'users'));
    const list = snap.docs.map(d => ({
      id: d.id, isActive: true, expiresAt: '', adminMemo: '',
      autoRefillAmount: 0, autoRefillDay: 1, paidTotal: 0,
      ...d.data()
    })) as User[];
    setUsersList(list);

    let total = 0; let today = 0;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    await Promise.all(list.map(async u => {
      try {
        const vSnap = await getDocs(collection(db, 'users', u.id, 'visits'));
        total += vSnap.size;
        today += vSnap.docs.filter(d => {
          const ts = d.data().visitedAt?.toDate?.();
          return ts && ts >= todayStart;
        }).length;
      } catch (_) {}
    }));
    setTotalVisits(total);
    setTodayVisits(today);
    setLoading(false);
  };

  const fetchEventConfig = async () => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'events'));
      if (snap.exists()) setEventConfig(snap.data() as any);
    } catch (_) {}
  };

  const fetchPendingClaims = async () => {
    try {
      const q    = query(collection(db, 'event_claims'), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data(), dateStr: d.data().claimedAt?.toDate().toLocaleString() }));
      list.sort((a: any, b: any) => (b.claimedAt?.toMillis() || 0) - (a.claimedAt?.toMillis() || 0));
      setPendingClaims(list);
    } catch (_) {}
  };

  const fetchNotice = async () => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'notice'));
      if (snap.exists()) {
        setNoticeText(snap.data().text || '');
        setNoticeActive(snap.data().isActive || false);
      }
    } catch (_) {}
  };

  // ── 유저 관리 ─────────────────────────────────────────────────────────────
  const handleCredit = async (userId: string, currentCredits: number, amount: number, userName: string) => {
    if (amount === 0) { alert('지급량을 입력하세요.'); return; }
    if (!confirm(`${userName}님에게 ${amount > 0 ? '+' : ''}${amount} 토큰?`)) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', userId), { credits: (currentCredits || 0) + amount });
      batch.set(doc(collection(db, 'users', userId, 'logs')), {
        type: amount > 0 ? '충전(관리자)' : '차감(관리자)', amount, reason: customReason, date: serverTimestamp(),
      });
      await batch.commit();
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, credits: (u.credits || 0) + amount } : u));
    } catch (_) { alert('오류 발생'); }
  };

  const toggleAi = async (userId: string, current: boolean) => {
    if (!confirm(`AI 기능을 ${!current ? 'ON' : 'OFF'} 하시겠습니까?`)) return;
    await updateDoc(doc(db, 'users', userId), { aiEnabled: !current });
    setUsersList(prev => prev.map(u => u.id === userId ? { ...u, aiEnabled: !current } : u));
  };

  const toggleCardActive = async (userId: string, current: boolean) => {
    if (!confirm(`명함을 ${!current ? '활성화' : '비활성화'} 하시겠습니까?`)) return;
    await updateDoc(doc(db, 'users', userId), { isActive: !current });
    setUsersList(prev => prev.map(u => u.id === userId ? { ...u, isActive: !current } : u));
  };

  const saveUserEdit = async () => {
    if (!editModal) return;
    try {
      await updateDoc(doc(db, 'users', editModal.id), {
        expiresAt:        editModal.expiresAt        || '',
        adminMemo:        editModal.adminMemo        || '',
        autoRefillAmount: editModal.autoRefillAmount || 0,
        autoRefillDay:    editModal.autoRefillDay    || 1,
      });
      setUsersList(prev => prev.map(u => u.id === editModal.id ? { ...u, ...editModal } : u));
      setEditModal(null);
      alert('✅ 저장 완료');
    } catch (_) { alert('오류 발생'); }
  };

  // ── 결제 기록 ─────────────────────────────────────────────────────────────
  const savePayment = async () => {
    if (!payModal || payAmount === 0) return;
    try {
      await addDoc(collection(db, 'users', payModal.userId, 'payments'), {
        amount: payAmount, note: payNote, date: serverTimestamp(),
      });
      const u = usersList.find(x => x.id === payModal.userId);
      await updateDoc(doc(db, 'users', payModal.userId), { paidTotal: (u?.paidTotal || 0) + payAmount });
      setUsersList(prev => prev.map(u => u.id === payModal!.userId ? { ...u, paidTotal: (u.paidTotal || 0) + payAmount } : u));
      setPayModal(null); setPayAmount(0); setPayNote('');
      alert('✅ 결제 기록 저장');
    } catch (_) { alert('오류 발생'); }
  };

  // ── 이벤트 ────────────────────────────────────────────────────────────────
  const saveEventConfig = async () => {
    await setDoc(doc(db, 'settings', 'events'), eventConfig);
    alert('✅ 이벤트 설정 저장됨');
  };

  const handleApproveClaim = async (claim: any) => {
    if (!confirm(`'${claim.userName}'님에게 ${claim.amount} 토큰 지급?`)) return;
    try {
      const u     = usersList.find(x => x.id === claim.userId);
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', claim.userId), { credits: (u?.credits || 0) + claim.amount });
      batch.set(doc(collection(db, 'users', claim.userId, 'logs')), {
        type: '이벤트 당첨', amount: claim.amount, reason: `이벤트 당첨 (${claim.keyword})`, date: serverTimestamp(),
      });
      batch.update(doc(db, 'event_claims', claim.id), { status: 'approved', approvedAt: serverTimestamp() });
      await batch.commit();
      fetchUsers(); fetchPendingClaims();
      alert('✅ 지급 완료!');
    } catch (_) { alert('오류 발생'); }
  };

  const handleRejectClaim = async (claimId: string) => {
    if (!confirm('거절하시겠습니까?')) return;
    await setDoc(doc(db, 'event_claims', claimId), { status: 'rejected' }, { merge: true });
    fetchPendingClaims();
  };

  // ── 공지사항 ──────────────────────────────────────────────────────────────
  const saveNotice = async () => {
    await setDoc(doc(db, 'settings', 'notice'), { text: noticeText, isActive: noticeActive });
    alert('✅ 공지 저장됨');
  };

  const expiringSoon = usersList.filter(u => {
    if (!u.expiresAt) return false;
    const diff = (new Date(u.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  });

  const totalRevenue = usersList.reduce((sum, u) => sum + (u.paidTotal || 0), 0);

  if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>로딩 중...</div>;

  if (user?.email !== SUPER_ADMIN_EMAIL) return (
    <div style={{ textAlign: 'center', marginTop: '80px' }}>
      <h1 style={{ color: 'red' }}>⛔ 접근 불가</h1>
      <p>최고 관리자 계정으로 로그인해주세요.</p>
      <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} style={primaryBtn}>구글 로그인</button>
    </div>
  );

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '30px 20px 120px', fontFamily: 'sans-serif' }}>

      {/* ── 헤더 ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#1a237e', margin: 0 }}>👑 Master Admin</h1>
        <button onClick={async () => { await signOut(auth); window.location.href = '/'; }} style={{ padding: '8px 16px', background: '#444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>로그아웃</button>
      </div>

      {/* ── 대시보드 요약 카드 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: '전체 유저',   value: `${usersList.length}명`,             color: '#1a237e' },
          { label: '전체 방문',   value: `${totalVisits}회`,                  color: '#2e7d32' },
          { label: '오늘 방문',   value: `${todayVisits}회`,                  color: '#0288d1' },
          { label: '누적 매출',   value: `${totalRevenue.toLocaleString()}원`, color: '#e65100' },
          { label: '만료 임박',   value: `${expiringSoon.length}명`,          color: expiringSoon.length > 0 ? '#c62828' : '#999' },
          { label: '이벤트 대기', value: `${pendingClaims.length}건`,         color: pendingClaims.length > 0 ? '#f57f17' : '#999' },
        ].map(card => (
          <div key={card.label} style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '10px', padding: '16px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '900', color: card.color }}>{card.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* ── 만료 임박 배너 ── */}
      {expiringSoon.length > 0 && (
        <div style={{ background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px' }}>
          <strong style={{ color: '#e65100' }}>⚠️ 만료 임박 ({expiringSoon.length}명)</strong>
          <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {expiringSoon.map(u => {
              const days = Math.ceil((new Date(u.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              return <span key={u.id} style={{ background: '#ffcc80', padding: '3px 10px', borderRadius: '20px', fontSize: '0.85rem' }}>{u.name} ({days}일 후)</span>;
            })}
          </div>
        </div>
      )}

      {/* ── 탭 네비게이션 ── */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '2px solid #e0e0e0' }}>
        {([['users', '👥 유저 관리'], ['stats', '📊 통계'], ['event', '🎉 이벤트'], ['notice', '📢 공지']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            padding: '10px 16px', border: 'none',
            borderBottom: activeTab === key ? '3px solid #1a237e' : '3px solid transparent',
            background: 'none', fontWeight: activeTab === key ? 'bold' : 'normal',
            color: activeTab === key ? '#1a237e' : '#666', cursor: 'pointer', fontSize: '0.9rem',
          }}>{label}</button>
        ))}
      </div>

      {/* ════════ 탭 1: 유저 관리 ════════ */}
      {activeTab === 'users' && (
        <div>
          <div style={{ background: '#e3f2fd', padding: '16px', borderRadius: '10px', marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={labelStyle}>지급량 (차감은 -)</label>
              <input type="number" value={customAmount} onChange={e => setCustomAmount(Number(e.target.value))} style={{ ...inputStyle, width: '100px' }} />
            </div>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <label style={labelStyle}>사유</label>
              <input value={customReason} onChange={e => setCustomReason(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {usersList.map(u => (
              <div key={u.id} style={{ background: 'white', border: `1px solid ${u.isActive !== false ? '#e0e0e0' : '#ffcdd2'}`, borderRadius: '10px', padding: '16px', opacity: u.isActive !== false ? 1 : 0.7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 'bold' }}>{u.name || '이름없음'}</span>
                      <span style={tagStyle}>{u.id}</span>
                      {u.isActive === false && <span style={{ ...tagStyle, background: '#ffcdd2', color: '#c62828' }}>비활성</span>}
                      {u.expiresAt && <span style={{ ...tagStyle, background: '#fff9c4', color: '#f57f17' }}>만료: {u.expiresAt}</span>}
                      {u.autoRefillAmount > 0 && <span style={{ ...tagStyle, background: '#e8f5e9', color: '#2e7d32' }}>자동충전 {u.autoRefillAmount}T/{u.autoRefillDay}일</span>}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#888', marginTop: '3px' }}>{u.owner_email}</div>
                    {u.adminMemo && <div style={{ fontSize: '0.82rem', color: '#e65100', marginTop: '3px' }}>📝 {u.adminMemo}</div>}
                    <div style={{ display: 'flex', gap: '14px', marginTop: '6px', fontSize: '0.88rem' }}>
                      <span style={{ color: '#1565c0', fontWeight: 'bold' }}>💎 {u.credits || 0} 토큰</span>
                      <span style={{ color: '#2e7d32' }}>💳 {(u.paidTotal || 0).toLocaleString()}원</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    <button onClick={() => toggleAi(u.id, u.aiEnabled !== false)} style={{ ...smallBtn, background: u.aiEnabled !== false ? '#e8f5e9' : '#ffebee', color: u.aiEnabled !== false ? '#2e7d32' : '#c62828' }}>
                      {u.aiEnabled !== false ? 'AI ON' : 'AI OFF'}
                    </button>
                    <button onClick={() => toggleCardActive(u.id, u.isActive !== false)} style={{ ...smallBtn, background: u.isActive !== false ? '#e3f2fd' : '#f5f5f5', color: u.isActive !== false ? '#1565c0' : '#999' }}>
                      {u.isActive !== false ? '명함 ON' : '명함 OFF'}
                    </button>
                    <button onClick={() => handleCredit(u.id, u.credits, customAmount, u.name)} style={{ ...smallBtn, background: '#1a237e', color: 'white' }}>지급/차감</button>
                    <button onClick={() => setPayModal({ userId: u.id, userName: u.name })} style={{ ...smallBtn, background: '#2e7d32', color: 'white' }}>결제기록</button>
                    <button onClick={() => setEditModal({ ...u })} style={{ ...smallBtn, background: '#f5f5f5', color: '#333' }}>설정</button>
                  </div>
                </div>
                {u.custom_knowledge?.length > 0 && (
                  <div style={{ marginTop: '10px', background: '#fff3e0', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#e65100', marginBottom: '4px' }}>🤖 AI 교육 내용</div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.82rem', color: '#555', lineHeight: '1.6' }}>
                      {u.custom_knowledge.map((k, i) => <li key={i}>{k}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ))}
            {usersList.length === 0 && <div style={{ textAlign: 'center', padding: '30px', color: '#999' }}>등록된 유저가 없습니다.</div>}
          </div>
        </div>
      )}

      {/* ════════ 탭 2: 통계 ════════ */}
      {activeTab === 'stats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '1.1rem' }}>📊 유저별 방문 통계</h2>
          {usersList.map(u => <UserStatRow key={u.id} user={u} />)}
        </div>
      )}

      {/* ════════ 탭 3: 이벤트 ════════ */}
      {activeTab === 'event' && (
        <div>
          <div style={{ background: '#fff3e0', padding: '20px', borderRadius: '10px', marginBottom: '24px', display: 'grid', gap: '14px' }}>
            <h3 style={{ margin: 0, color: '#e65100' }}>🎉 이벤트 설정</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
              <input type="checkbox" checked={eventConfig.isActive} onChange={e => setEventConfig({ ...eventConfig, isActive: e.target.checked })} style={{ transform: 'scale(1.4)' }} />
              이벤트 활성화
            </label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <label style={labelStyle}>당첨 키워드</label>
                <input value={eventConfig.keyword} onChange={e => setEventConfig({ ...eventConfig, keyword: e.target.value })} placeholder="예: 보물찾기" style={inputStyle} />
              </div>
              <div style={{ width: '90px' }}>
                <label style={labelStyle}>최소 토큰</label>
                <input type="number" value={eventConfig.minToken} onChange={e => setEventConfig({ ...eventConfig, minToken: Number(e.target.value) })} style={inputStyle} />
              </div>
              <div style={{ width: '90px' }}>
                <label style={labelStyle}>최대 토큰</label>
                <input type="number" value={eventConfig.maxToken} onChange={e => setEventConfig({ ...eventConfig, maxToken: Number(e.target.value) })} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>당첨 메시지</label>
              <textarea value={eventConfig.prizeMsg} onChange={e => setEventConfig({ ...eventConfig, prizeMsg: e.target.value })} style={{ ...inputStyle, height: '60px', resize: 'none' }} />
            </div>
            <button onClick={saveEventConfig} style={primaryBtn}>설정 저장</button>
          </div>

          <h3 style={{ color: '#d84315', marginBottom: '10px' }}>⏳ 승인 대기 ({pendingClaims.length}건)</h3>
          {pendingClaims.length === 0
            ? <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '10px', textAlign: 'center', color: '#999' }}>대기 중인 요청이 없습니다.</div>
            : pendingClaims.map(claim => (
              <div key={claim.id} style={{ background: 'white', border: '2px solid #ffcc80', padding: '14px', borderRadius: '10px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{claim.userName} <span style={{ fontWeight: 'normal', fontSize: '0.85rem', color: '#888' }}>({claim.userId})</span></div>
                  <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '3px' }}>키워드: "{claim.keyword}" / {claim.dateStr}</div>
                  <div style={{ color: '#d84315', fontWeight: 'bold', marginTop: '3px' }}>🎁 {claim.amount} 토큰</div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleApproveClaim(claim)} style={{ ...smallBtn, background: '#2e7d32', color: 'white' }}>승인</button>
                  <button onClick={() => handleRejectClaim(claim.id)} style={{ ...smallBtn, background: '#c62828', color: 'white' }}>거절</button>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ════════ 탭 4: 공지 ════════ */}
      {activeTab === 'notice' && (
        <div style={{ background: '#e8f5e9', padding: '20px', borderRadius: '10px', display: 'grid', gap: '14px' }}>
          <h3 style={{ margin: 0, color: '#1b5e20' }}>📢 챗봇 공지사항</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#388e3c' }}>
            활성화하면 모든 명함의 AI 챗봇 첫 메시지로 공지가 표시됩니다.
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
            <input type="checkbox" checked={noticeActive} onChange={e => setNoticeActive(e.target.checked)} style={{ transform: 'scale(1.4)' }} />
            공지 활성화
          </label>
          <div>
            <label style={labelStyle}>공지 내용</label>
            <textarea value={noticeText} onChange={e => setNoticeText(e.target.value)} placeholder="예: 🎉 12월 이벤트 시작! '이벤트'라고 입력해보세요!" style={{ ...inputStyle, height: '100px', resize: 'none' }} />
          </div>
          <button onClick={saveNotice} style={{ ...primaryBtn, background: '#2e7d32' }}>공지 저장</button>
        </div>
      )}

      {/* ── 유저 설정 모달 ── */}
      {editModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ margin: '0 0 16px' }}>⚙️ {editModal.name} 설정</h3>
            <label style={labelStyle}>만료일</label>
            <input type="date" value={editModal.expiresAt || ''} onChange={e => setEditModal({ ...editModal, expiresAt: e.target.value })} style={{ ...inputStyle, marginBottom: '12px' }} />
            <label style={labelStyle}>내부 메모</label>
            <textarea value={editModal.adminMemo || ''} onChange={e => setEditModal({ ...editModal, adminMemo: e.target.value })} placeholder="예: 3개월 계약, VIP 고객" style={{ ...inputStyle, height: '70px', resize: 'none', marginBottom: '12px' }} />
            <label style={labelStyle}>월 자동 충전량 (0이면 비활성)</label>
            <input type="number" value={editModal.autoRefillAmount || 0} onChange={e => setEditModal({ ...editModal, autoRefillAmount: Number(e.target.value) })} style={{ ...inputStyle, marginBottom: '8px' }} />
            <label style={labelStyle}>충전일 (매월 N일, 1~28)</label>
            <input type="number" min={1} max={28} value={editModal.autoRefillDay || 1} onChange={e => setEditModal({ ...editModal, autoRefillDay: Number(e.target.value) })} style={{ ...inputStyle, marginBottom: '16px' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={saveUserEdit} style={{ ...primaryBtn, flex: 1 }}>저장</button>
              <button onClick={() => setEditModal(null)} style={{ ...primaryBtn, flex: 1, background: '#888' }}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 결제 기록 모달 ── */}
      {payModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ margin: '0 0 16px' }}>💳 {payModal.userName} 결제 기록</h3>
            <label style={labelStyle}>결제 금액 (원)</label>
            <input type="number" value={payAmount} onChange={e => setPayAmount(Number(e.target.value))} placeholder="예: 30000" style={{ ...inputStyle, marginBottom: '10px' }} />
            <label style={labelStyle}>메모</label>
            <input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="예: 3개월 구독" style={{ ...inputStyle, marginBottom: '16px' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={savePayment} style={{ ...primaryBtn, flex: 1 }}>저장</button>
              <button onClick={() => setPayModal(null)} style={{ ...primaryBtn, flex: 1, background: '#888' }}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 유저별 방문 통계 행 ────────────────────────────────────────────────────────
function UserStatRow({ user }: { user: User }) {
  const [stats, setStats] = useState<{ total: number; today: number; week: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const snap       = await getDocs(collection(db, 'users', user.id, 'visits'));
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const weekAgo    = Date.now() - 7 * 24 * 60 * 60 * 1000;
        let today = 0; let week = 0;
        snap.docs.forEach(d => {
          const ts = d.data().visitedAt?.toDate?.()?.getTime() || 0;
          if (ts >= todayStart.getTime()) today++;
          if (ts >= weekAgo) week++;
        });
        setStats({ total: snap.size, today, week });
      } catch (_) { setStats({ total: 0, today: 0, week: 0 }); }
    })();
  }, [user.id]);

  return (
    <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
      <div>
        <div style={{ fontWeight: 'bold' }}>{user.name}</div>
        <div style={{ fontSize: '0.8rem', color: '#888' }}>{user.id}</div>
      </div>
      <div style={{ display: 'flex', gap: '20px' }}>
        {[['전체', stats?.total, '#1a237e'], ['7일', stats?.week, '#2e7d32'], ['오늘', stats?.today, '#0288d1']].map(([label, val, color]) => (
          <div key={label as string} style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 'bold', color: color as string, fontSize: '1.2rem' }}>{val ?? '...'}</div>
            <div style={{ color: '#888', fontSize: '0.75rem' }}>{label as string}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────────────────
const primaryBtn:   React.CSSProperties = { padding: '12px 20px', background: '#1a237e', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem' };
const smallBtn:     React.CSSProperties = { padding: '6px 10px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' };
const inputStyle:   React.CSSProperties = { width: '100%', padding: '9px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box', fontSize: '0.9rem' };
const labelStyle:   React.CSSProperties = { display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#555', marginBottom: '4px' };
const tagStyle:     React.CSSProperties = { fontSize: '0.75rem', background: '#f5f5f5', padding: '2px 8px', borderRadius: '10px', color: '#666' };
const overlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 };
const modalStyle:   React.CSSProperties = { background: 'white', padding: '24px', borderRadius: '14px', width: '90%', maxWidth: '380px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' };