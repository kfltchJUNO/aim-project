// app/admin/page.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { db, auth, storage } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  collection, query, where, doc, updateDoc,
  orderBy, limit, onSnapshot, getDocs, runTransaction, arrayUnion, arrayRemove,
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
  { label: '📞 휴대폰',     value: 'mobile'  },
  { label: '✉️ 이메일',     value: 'email'   },
  { label: '📷 인스타그램', value: 'insta'   },
  { label: '▶️ 유튜브',     value: 'youtube' },
  { label: '💻 깃허브',     value: 'github'  },
  { label: '📝 블로그',     value: 'blog'    },
  { label: '🔗 기타 링크',  value: 'other'   },
];

const THEME_PRESETS = [
  { label: '🌊 네이비 (기본)', value: 'navy',   bg: '#ffffff', theme: '#1a237e' },
  { label: '🌙 다크',          value: 'dark',   bg: '#1a1a2e', theme: '#16213e' },
  { label: '🌿 그린',          value: 'green',  bg: '#f1f8e9', theme: '#2e7d32' },
  { label: '🌹 로즈',          value: 'rose',   bg: '#fff0f3', theme: '#c62828' },
  { label: '💜 퍼플',          value: 'purple', bg: '#f3e5f5', theme: '#6a1b9a' },
  { label: '✏️ 커스텀',        value: 'custom', bg: '',        theme: ''        },
];

export default function AdminPage() {
  const [user,          setUser]          = useState<any>(null);
  const [myCardId,      setMyCardId]      = useState<string | null>(null);
  const [isAuthorized,  setIsAuthorized]  = useState(false);

  const [formData, setFormData] = useState<any>({
    links: [], history: [], projects: [], custom_sections: [], custom_knowledge: [],
    chatbotEnabled: true, translationEnabled: true, quizEnabled: true, synergyEnabled: true,
    ownerMbti: '', ai_prompt: '',
  });

  const [newKnowledge, setNewKnowledge] = useState('');
  const [colors,       setColors]       = useState({ background: '#ffffff', theme: '#1a237e' });
  const [themePreset,  setThemePreset]  = useState('navy');
  const [sectionList,  setSectionList]  = useState<SectionItem[]>([]);
  const [profileConfig, setProfileConfig] = useState<SectionItem>({
    id: 'profile', type: 'profile', title: '기본 정보', isDefaultOpen: true, isOpenInAdmin: true,
  });

  const [credits,          setCredits]          = useState(0);
  const [loading,          setLoading]          = useState(true);
  const [uploading,        setUploading]        = useState(false);
  const [showPreview,      setShowPreview]      = useState(false);
  const [showTokenHistory, setShowTokenHistory] = useState(false);
  const [tokenLogs,        setTokenLogs]        = useState<any[]>([]);
  const [visitStats,       setVisitStats]       = useState<{ total: number; today: number }>({ total: 0, today: 0 });

  const dragItem     = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => {
    let unsubscribeSnapshot: any = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async u => {
      setUser(u);
      if (u) {
        const q = query(collection(db, 'users'), where('owner_email', '==', u.email));

        unsubscribeSnapshot = onSnapshot(q, snap => {
          if (!snap.empty) {
            const d    = snap.docs[0];
            const data = d.data();
            setMyCardId(d.id);
            setCredits(data.credits || 0);

            setFormData((prev: any) => ({
              ...prev, ...data,
              links:              data.links              || [],
              history:            data.history            || [],
              projects:           data.projects           || [],
              custom_sections:    data.custom_sections    || [],
              custom_knowledge:   data.custom_knowledge   || [],
              chatbotEnabled:     data.chatbotEnabled     !== false,
              translationEnabled: data.translationEnabled !== false,
              quizEnabled:        data.quizEnabled        !== false,
              synergyEnabled:     data.synergyEnabled     !== false,
              ownerMbti:          data.ownerMbti          || '',
              ai_prompt:          data.ai_prompt          || '',
            }));

            if (data.theme_preset) {
              setThemePreset(data.theme_preset);
              const p = THEME_PRESETS.find(t => t.value === data.theme_preset);
              if (p && p.value !== 'custom') setColors({ background: p.bg, theme: p.theme });
            } else if (data.colors) {
              setColors(data.colors);
            }

            if (sectionList.length === 0) {
              const config = data.section_config || {};
              if (config['profile']) {
                setProfileConfig(prev => ({
                  ...prev,
                  title:         config['profile'].title         || '기본 정보',
                  isDefaultOpen: config['profile'].isDefaultOpen ?? true,
                }));
              }

              let initialList: SectionItem[] = [];
              if (data.section_order?.length > 0) {
                initialList = data.section_order
                  .filter((id: string) => id !== 'profile')
                  .map((id: string) => {
                    const conf = config[id] || {};
                    let type: any = 'custom';
                    if (id === 'links') type = 'links';
                    else if (id === 'history') type = 'history';
                    else if (id === 'projects') type = 'projects';
                    let title = conf.title;
                    if (!title) {
                      if (type === 'links')    title = '링크';
                      else if (type === 'history')   title = '연혁';
                      else if (type === 'projects')  title = '프로젝트';
                      else { const c = data.custom_sections?.find((cs: any) => cs.id === id); title = c ? c.title : '새 섹션'; }
                    }
                    return { id, type, title, isDefaultOpen: conf.isDefaultOpen ?? false, isOpenInAdmin: false };
                  });
              } else {
                initialList = [
                  { id: 'links',    type: 'links',    title: '링크',      isDefaultOpen: false, isOpenInAdmin: false },
                  { id: 'history',  type: 'history',  title: '연혁',      isDefaultOpen: true,  isOpenInAdmin: false },
                  { id: 'projects', type: 'projects', title: '프로젝트',  isDefaultOpen: false, isOpenInAdmin: false },
                  ...(data.custom_sections || []).map((c: any) => ({
                    id: c.id, type: 'custom', title: c.title, isDefaultOpen: false, isOpenInAdmin: false,
                  })),
                ];
              }
              setSectionList(initialList);
            }

            setIsAuthorized(true);

            // 방문자 통계 조회
            if (d.id) fetchVisitStats(d.id);

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
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  // ── 방문자 통계 ──────────────────────────────────────────────────────────
  const fetchVisitStats = async (cardId: string) => {
    try {
      const allSnap = await getDocs(collection(db, 'users', cardId, 'visits'));
      const total   = allSnap.size;
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayCount = allSnap.docs.filter(d => {
        const ts = d.data().visitedAt?.toDate?.();
        return ts && ts >= todayStart;
      }).length;
      setVisitStats({ total, today: todayCount });
    } catch (_) {}
  };

  // ── 토큰 기록 ─────────────────────────────────────────────────────────────
  const fetchTokenLogs = async () => {
    if (!myCardId) return;
    try {
      const q    = query(collection(db, 'users', myCardId, 'logs'), orderBy('date', 'desc'), limit(20));
      const snap = await getDocs(q);
      setTokenLogs(snap.docs.map(d => {
        const data = d.data();
        return { ...data, date: data.date?.toDate ? data.date.toDate().toLocaleString() : '날짜 없음' };
      }));
      setShowTokenHistory(true);
    } catch (_) { setTokenLogs([]); setShowTokenHistory(true); }
  };

  // ── AI 교육 추가/삭제 ──────────────────────────────────────────────────────
  const handleAddKnowledge = async () => {
    if (!myCardId || !newKnowledge.trim()) return;
    if (credits < 10) return alert('토큰이 부족합니다. (교육 추가: 10토큰)');
    if (!confirm('이 내용을 AI에게 학습시키겠습니까?\n(10토큰이 차감됩니다)')) return;
    try {
      await runTransaction(db, async transaction => {
        const userRef = doc(db, 'users', myCardId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw 'User not found';
        const current = userDoc.data().credits || 0;
        if (current < 10) throw 'Not enough credits';
        transaction.update(userRef, { credits: current - 10, custom_knowledge: arrayUnion(newKnowledge.trim()) });
        const logRef = doc(collection(db, 'users', myCardId, 'logs'));
        transaction.set(logRef, { type: '사용', amount: -10, reason: 'AI 교육 추가', date: new Date() });
      });
      setNewKnowledge('');
      alert('✅ AI 교육이 완료되었습니다.');
    } catch (_) { alert('오류 발생'); }
  };

  const handleDeleteKnowledge = async (text: string) => {
    if (!myCardId) return;
    if (credits < 10) return alert('토큰이 부족합니다. (삭제 비용: 10토큰)');
    if (!confirm('삭제하시겠습니까?\n(10토큰이 소모됩니다)')) return;
    try {
      await runTransaction(db, async transaction => {
        const userRef = doc(db, 'users', myCardId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw 'User not found';
        const current = userDoc.data().credits || 0;
        if (current < 10) throw 'Not enough credits';
        transaction.update(userRef, { credits: current - 10, custom_knowledge: arrayRemove(text) });
        const logRef = doc(collection(db, 'users', myCardId, 'logs'));
        transaction.set(logRef, { type: '사용', amount: -10, reason: 'AI 교육 삭제', date: new Date() });
      });
      alert('🗑️ 삭제되었습니다.');
    } catch (_) { alert('오류 발생'); }
  };

  // ── 저장 ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!myCardId || !isAuthorized) return alert('권한이 없습니다.');
    if (!confirm('설정을 저장하시겠습니까?')) return;
    try {
      const configMap: any = {};
      configMap['profile'] = { title: profileConfig.title, isDefaultOpen: profileConfig.isDefaultOpen };
      sectionList.forEach(item => { configMap[item.id] = { title: item.title, isDefaultOpen: item.isDefaultOpen }; });
      const orderToSave  = ['profile', ...sectionList.map(s => s.id)];
      const updatedCustom = formData.custom_sections.map((c: any) => {
        const match = sectionList.find(s => s.id === c.id);
        return match ? { ...c, title: match.title } : c;
      });

      // 테마 프리셋 처리
      const colorsToSave = themePreset !== 'custom'
        ? THEME_PRESETS.find(t => t.value === themePreset)
          ? { background: THEME_PRESETS.find(t => t.value === themePreset)!.bg, theme: THEME_PRESETS.find(t => t.value === themePreset)!.theme }
          : colors
        : colors;

      await updateDoc(doc(db, 'users', myCardId), {
        ...formData,
        custom_sections: updatedCustom,
        section_order:   orderToSave,
        section_config:  configMap,
        colors:          colorsToSave,
        theme_preset:    themePreset,
        ai_prompt:       formData.ai_prompt || '',
      });
      alert('✅ 저장되었습니다.');
    } catch (error) { console.error(error); alert('저장 실패'); }
  };

  // ── 섹션/항목 유틸 ────────────────────────────────────────────────────────
  const handleSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const _list = [...sectionList];
    const dragged = _list.splice(dragItem.current, 1)[0];
    _list.splice(dragOverItem.current, 0, dragged);
    dragItem.current = null; dragOverItem.current = null;
    setSectionList(_list);
  };

  const updateSectionState = (index: number | 'profile', field: keyof SectionItem, value: any) => {
    if (index === 'profile') setProfileConfig({ ...profileConfig, [field]: value });
    else { const l = [...sectionList]; (l[index] as any)[field] = value; setSectionList(l); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !myCardId) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `profile_images/${myCardId}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setFormData({ ...formData, profile_img: url });
    } finally { setUploading(false); }
  };

  const handleItemChange    = (key: string, idx: number, field: string, val: string) => { const l = [...formData[key]]; l[idx][field] = val; setFormData({ ...formData, [key]: l }); };
  const addItem             = (key: string) => { const empty = key === 'links' ? { type: 'mobile', value: '' } : key === 'history' ? { date: '', title: '', desc: '' } : { title: '', link: '', desc: '' }; setFormData({ ...formData, [key]: [...formData[key], empty] }); };
  const removeItem          = (key: string, idx: number) => { const l = [...formData[key]]; l.splice(idx, 1); setFormData({ ...formData, [key]: l }); };
  const moveItem            = (key: string, idx: number, dir: 'up' | 'down') => { const l = [...formData[key]]; if (dir === 'up' && idx > 0) [l[idx - 1], l[idx]] = [l[idx], l[idx - 1]]; else if (dir === 'down' && idx < l.length - 1) [l[idx + 1], l[idx]] = [l[idx], l[idx + 1]]; else return; setFormData({ ...formData, [key]: l }); };
  const addCustomSection    = () => { const id = `custom_${Date.now()}`; setFormData({ ...formData, custom_sections: [...(formData.custom_sections || []), { id, title: '새 섹션', items: [] }] }); setSectionList([...sectionList, { id, type: 'custom', title: '새 섹션', isDefaultOpen: true, isOpenInAdmin: true }]); };
  const deleteSection       = (index: number) => { if (!confirm('영구 삭제하시겠습니까?')) return; const id = sectionList[index].id; setSectionList(sectionList.filter((_, i) => i !== index)); if (id.startsWith('custom')) setFormData({ ...formData, custom_sections: formData.custom_sections.filter((c: any) => c.id !== id) }); };
  const handleCustomItemChange = (secId: string, itemIdx: number, field: string, val: string) => { const updated = formData.custom_sections.map((c: any) => c.id === secId ? { ...c, items: c.items.map((it: any, i: number) => i === itemIdx ? { ...it, [field]: val } : it) } : c); setFormData({ ...formData, custom_sections: updated }); };
  const addCustomItem       = (secId: string) => { const updated = formData.custom_sections.map((c: any) => c.id === secId ? { ...c, items: [...c.items, { title: '', desc: '' }] } : c); setFormData({ ...formData, custom_sections: updated }); };
  const removeCustomItem    = (secId: string, itemIdx: number) => { const updated = formData.custom_sections.map((c: any) => c.id === secId ? { ...c, items: c.items.filter((_: any, i: number) => i !== itemIdx) } : c); setFormData({ ...formData, custom_sections: updated }); };
  const moveCustomItem      = (secId: string, itemIdx: number, dir: 'up' | 'down') => { const updated = formData.custom_sections.map((c: any) => { if (c.id !== secId) return c; const items = [...c.items]; if (dir === 'up' && itemIdx > 0) [items[itemIdx - 1], items[itemIdx]] = [items[itemIdx], items[itemIdx - 1]]; else if (dir === 'down' && itemIdx < items.length - 1) [items[itemIdx + 1], items[itemIdx]] = [items[itemIdx], items[itemIdx + 1]]; return { ...c, items }; }); setFormData({ ...formData, custom_sections: updated }); };

  // ── 렌더 ──────────────────────────────────────────────────────────────────
  if (loading) return <div>로딩 중...</div>;

  if (!user) return (
    <div style={centerStyle}>
      <h2 style={{ marginBottom: '15px' }}>관리자 로그인</h2>
      <p style={{ marginBottom: '25px', color: '#666' }}>명함을 수정하려면 로그인이 필요합니다.</p>
      <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} style={googleLoginBtnStyle}>
        <span style={{ marginRight: '10px' }}>G</span> 구글 계정으로 로그인
      </button>
    </div>
  );

  if (!isAuthorized) return (
    <div style={centerStyle}>
      <h2 style={{ color: '#d32f2f', marginBottom: '10px' }}>⛔ 등록된 명함이 없습니다.</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>현재 로그인한 계정(<strong>{user.email}</strong>)으로<br />등록된 명함이 존재하지 않습니다.</p>
      <div style={{ background: '#e3f2fd', padding: '20px', borderRadius: '10px', marginBottom: '30px', textAlign: 'center', width: '90%', maxWidth: '400px', border: '1px solid #90caf9' }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#1565c0' }}>📢 나만의 AI 명함이 필요하신가요?</p>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#333' }}>제작 문의: <a href="mailto:ot.helper7@gmail.com" style={{ color: '#d32f2f', fontWeight: 'bold', textDecoration: 'underline' }}>ot.helper7@gmail.com</a></p>
      </div>
      <button onClick={() => signOut(auth)} style={logoutBtnStyle}>로그아웃</button>
    </div>
  );

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', paddingBottom: '100px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', background: 'white', padding: '20px', minHeight: '100vh' }}>

        {/* ── 상단 헤더 ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>⚙️ 관리자</h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={fetchTokenLogs} style={tokenBtnStyle}>💎 {credits}</button>
            <button onClick={() => signOut(auth)} style={logoutBtnStyle}>로그아웃</button>
          </div>
        </div>

        {/* ── 방문자 통계 카드 ── */}
        <div style={{ background: 'linear-gradient(135deg, #e3f2fd, #f3e5f5)', padding: '15px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #b3c9f0', display: 'flex', gap: '15px' }}>
          <div style={{ flex: 1, textAlign: 'center', background: 'white', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#1a237e' }}>{visitStats.total}</div>
            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '2px' }}>전체 방문</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', background: 'white', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#2e7d32' }}>{visitStats.today}</div>
            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '2px' }}>오늘 방문</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', background: 'white', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#e65100' }}>{credits}</div>
            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '2px' }}>토큰 잔액</div>
          </div>
        </div>

        {/* ── 토큰 충전 문의 배너 ── */}
        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '10px', padding: '14px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#e65100' }}>💎 토큰이 부족하신가요?</div>
            <div style={{ fontSize: '0.8rem', color: '#795548', marginTop: '2px' }}>이메일로 충전 문의를 해주세요!</div>
          </div>
          <a
            href="mailto:ot.helper7@gmail.com?subject=토큰 충전 문의&body=안녕하세요! 토큰 충전을 원합니다.%0A%0A명함 ID: "
            style={{ background: '#ff6f00', color: 'white', padding: '8px 14px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold', textDecoration: 'none' }}
          >
            충전 문의
          </a>
        </div>

        {/* ── AI 기능 제어 & MBTI ── */}
        <div style={{ background: 'white', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #e0e0e0', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, fontSize: '0.9rem', color: '#333', marginBottom: '10px' }}>🤖 AI 기능 제어 (ON/OFF)</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
            <label style={toggleLabelStyle}><input type="checkbox" checked={formData.chatbotEnabled}     onChange={e => setFormData({ ...formData, chatbotEnabled:     e.target.checked })} /> 💬 챗봇</label>
            <label style={toggleLabelStyle}><input type="checkbox" checked={formData.translationEnabled} onChange={e => setFormData({ ...formData, translationEnabled: e.target.checked })} /> 🌐 번역</label>
            <label style={toggleLabelStyle}><input type="checkbox" checked={formData.quizEnabled}        onChange={e => setFormData({ ...formData, quizEnabled:        e.target.checked })} /> 🧠 찐친고사</label>
            <label style={toggleLabelStyle}><input type="checkbox" checked={formData.synergyEnabled}     onChange={e => setFormData({ ...formData, synergyEnabled:     e.target.checked })} /> 💘 MBTI 분석</label>
          </div>
          {formData.synergyEnabled && (
            <div style={{ background: '#f3e5f5', padding: '10px', borderRadius: '5px', border: '1px solid #e1bee7' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#7b1fa2', display: 'block', marginBottom: '5px' }}>🧙‍♂️ 주인의 MBTI (AI 궁합 분석용)</label>
              <input type="text" placeholder="예: ENFP (비워두면 방문자 성향만 분석)" value={formData.ownerMbti || ''} onChange={e => setFormData({ ...formData, ownerMbti: e.target.value.toUpperCase() })} style={{ ...inputStyle, border: '1px solid #ce93d8' }} maxLength={4} />
            </div>
          )}
        </div>

        {/* ── AI 챗봇 성격 설정 (커스텀 프롬프트) ── */}
        <div style={{ background: '#e8f5e9', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #a5d6a7' }}>
          <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#1b5e20' }}>🗣️ AI 챗봇 성격 설정</h3>
          <p style={{ fontSize: '0.82rem', color: '#388e3c', margin: '0 0 8px 0' }}>
            챗봇이 방문자에게 대화하는 방식을 커스텀하세요. 비워두면 기본 설정이 적용됩니다.
          </p>
          <textarea
            value={formData.ai_prompt || ''}
            onChange={e => setFormData({ ...formData, ai_prompt: e.target.value })}
            placeholder={"예시:\n- 반말로 친근하게 대화해줘\n- 항상 이모지를 2개 이상 써줘\n- 영어로만 답변해줘\n- 전문적이고 격식있게 말해줘"}
            style={{ ...inputStyle, height: '100px', border: '1px solid #a5d6a7', background: 'white' }}
          />
        </div>

        {/* ── 테마 프리셋 + 커스텀 색상 ── */}
        <div style={{ background: '#e3f2fd', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #90caf9' }}>
          <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#1565c0' }}>🎨 테마 설정</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            {THEME_PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => {
                  setThemePreset(p.value);
                  if (p.value !== 'custom') setColors({ background: p.bg, theme: p.theme });
                }}
                style={{
                  padding: '7px 12px', borderRadius: '20px', border: '2px solid',
                  borderColor: themePreset === p.value ? '#1565c0' : '#ddd',
                  background: themePreset === p.value ? '#1565c0' : 'white',
                  color: themePreset === p.value ? 'white' : '#333',
                  cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          {themePreset === 'custom' && (
            <div style={{ display: 'flex', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '0.8rem', marginBottom: '5px' }}>프로필 배경색</label>
                <input type="color" value={colors.theme}      onChange={e => setColors({ ...colors, theme:      e.target.value })} style={{ width: '50px', height: '30px', border: 'none', cursor: 'pointer' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '0.8rem', marginBottom: '5px' }}>전체 배경색</label>
                <input type="color" value={colors.background} onChange={e => setColors({ ...colors, background: e.target.value })} style={{ width: '50px', height: '30px', border: 'none', cursor: 'pointer' }} />
              </div>
            </div>
          )}
        </div>

        {/* ── AI 교육 관리 ── */}
        <div style={{ background: '#fff3e0', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #ffcc80' }}>
          <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#e65100' }}>🤖 AI 챗봇 교육 (추가/삭제: 각 10토큰)</h3>
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '10px' }}>AI에게 알려주고 싶은 내용을 입력하세요.</p>
          {formData.custom_knowledge?.length > 0 ? (
            <ul style={{ paddingLeft: '20px', margin: '10px 0' }}>
              {formData.custom_knowledge.map((item: string, idx: number) => (
                <li key={idx} style={{ marginBottom: '8px', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{item}</span>
                    <button onClick={() => handleDeleteKnowledge(item)} style={{ fontSize: '0.7rem', background: '#ffcdd2', border: 'none', borderRadius: '5px', padding: '3px 6px', color: '#c62828', cursor: 'pointer', marginLeft: '10px' }}>삭제 (-10)</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : <div style={{ fontSize: '0.9rem', color: '#999', padding: '10px', fontStyle: 'italic' }}>등록된 교육 내용이 없습니다.</div>}
          <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
            <input value={newKnowledge} onChange={e => setNewKnowledge(e.target.value)} placeholder="새로운 교육 내용" style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '5px' }} />
            <button onClick={handleAddKnowledge} style={{ background: '#ff9800', color: 'white', border: 'none', borderRadius: '5px', padding: '0 15px', fontWeight: 'bold', cursor: 'pointer' }}>추가 (-10)</button>
          </div>
        </div>

        {/* ── 섹션 관리 (프로필) ── */}
        <div style={{ border: '2px solid #1a237e', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px', background: 'white' }}>
          <div style={{ padding: '15px', background: '#f0f2f5', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1 }}>
              <span style={{ fontSize: '1.2rem' }}>📌</span>
              <input value={profileConfig.title} onChange={e => updateSectionState('profile', 'title', e.target.value)} style={titleInputStyle} />
            </div>
            <div style={{ display: 'flex', gap: '10px', fontSize: '0.8rem', alignItems: 'center' }}>
              <label><input type="checkbox" checked={profileConfig.isDefaultOpen} onChange={e => updateSectionState('profile', 'isDefaultOpen', e.target.checked)} /> 초기 펼침</label>
              <button onClick={() => updateSectionState('profile', 'isOpenInAdmin', !profileConfig.isOpenInAdmin)}>{profileConfig.isOpenInAdmin ? '접기' : '편집'}</button>
            </div>
          </div>
          {profileConfig.isOpenInAdmin && (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <img src={formData.profile_img || '/profile_default.jpg'} style={{ width: '80px', height: '80px', borderRadius: '50%' }} alt="profile" />
              <br />
              <label style={{ cursor: 'pointer', color: 'blue', fontSize: '0.9rem' }}>
                {uploading ? '업로드 중' : '사진 변경'}
                <input type="file" hidden onChange={handleImageUpload} accept="image/*" />
              </label>
              <input value={formData.name  || ''} onChange={e => setFormData({ ...formData, name:  e.target.value })} placeholder="이름"  style={inputStyle} />
              <input value={formData.role  || ''} onChange={e => setFormData({ ...formData, role:  e.target.value })} placeholder="직함"  style={inputStyle} />
              <textarea value={formData.intro || ''} onChange={e => setFormData({ ...formData, intro: e.target.value })} placeholder="소개" style={{ ...inputStyle, height: '80px' }} />
            </div>
          )}
        </div>

        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '10px' }}>⬇️ 드래그하여 섹션 순서 변경 가능</p>

        {/* ── 섹션 리스트 ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {sectionList.map((section, index) => (
            <div key={section.id} draggable onDragStart={() => dragItem.current = index} onDragEnter={() => dragOverItem.current = index} onDragEnd={handleSort} onDragOver={e => e.preventDefault()} style={{ background: 'white', border: '1px solid #ccc', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ padding: '15px', background: section.isOpenInAdmin ? '#e8eaf6' : '#f9f9f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'grab' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1 }}>
                  <span style={{ color: '#999' }}>☰</span>
                  <input value={section.title} onChange={e => updateSectionState(index, 'title', e.target.value)} onClick={e => e.stopPropagation()} style={titleInputStyle} />
                </div>
                <div style={{ display: 'flex', gap: '10px', fontSize: '0.8rem', alignItems: 'center' }}>
                  <label onClick={e => e.stopPropagation()}><input type="checkbox" checked={section.isDefaultOpen} onChange={e => updateSectionState(index, 'isDefaultOpen', e.target.checked)} /> 초기 펼침</label>
                  <button onClick={() => updateSectionState(index, 'isOpenInAdmin', !section.isOpenInAdmin)}>{section.isOpenInAdmin ? '▲' : '▼'}</button>
                </div>
              </div>

              {section.isOpenInAdmin && (
                <div style={{ padding: '15px', borderTop: '1px solid #eee' }}>
                  {/* 링크 */}
                  {section.type === 'links' && (
                    <div>
                      {formData.links.map((link: any, i: number) => (
                        <div key={i} style={{ display: 'flex', gap: '5px', marginBottom: '5px', alignItems: 'center' }}>
                          <select value={link.type} onChange={e => handleItemChange('links', i, 'type', e.target.value)} style={{ padding: '5px', borderRadius: '5px', border: '1px solid #ddd' }}>
                            {LINK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                          <input value={link.value} onChange={e => handleItemChange('links', i, 'value', e.target.value)} style={{ ...inputStyle, flex: 1, margin: 0 }} />
                          <button onClick={() => moveItem('links', i, 'up')}   style={arrowBtnStyle}>⬆️</button>
                          <button onClick={() => moveItem('links', i, 'down')} style={arrowBtnStyle}>⬇️</button>
                          <button onClick={() => removeItem('links', i)}       style={delBtnStyle}>❌</button>
                        </div>
                      ))}
                      <button onClick={() => addItem('links')} style={addBtn}>+ 링크 추가</button>
                    </div>
                  )}

                  {/* 연혁 */}
                  {section.type === 'history' && (
                    <div>
                      {formData.history.map((item: any, i: number) => (
                        <div key={i} style={itemBoxStyle}>
                          <div style={{ display: 'flex', gap: '5px', marginBottom: '5px', alignItems: 'center' }}>
                            <input value={item.date} onChange={e => handleItemChange('history', i, 'date', e.target.value)} placeholder="날짜" style={{ ...inputStyle, flex: 1, margin: 0 }} />
                            <button onClick={() => moveItem('history', i, 'up')}   style={arrowBtnStyle}>⬆️</button>
                            <button onClick={() => moveItem('history', i, 'down')} style={arrowBtnStyle}>⬇️</button>
                            <button onClick={() => removeItem('history', i)}       style={delBtnStyle}>❌</button>
                          </div>
                          <input value={item.title} onChange={e => handleItemChange('history', i, 'title', e.target.value)} placeholder="제목"   style={inputStyle} />
                          <textarea value={item.desc} onChange={e => handleItemChange('history', i, 'desc', e.target.value)}  placeholder="내용"   style={{ ...inputStyle, height: '50px', marginBottom: 0 }} />
                        </div>
                      ))}
                      <button onClick={() => addItem('history')} style={addBtn}>+ 연혁 추가</button>
                    </div>
                  )}

                  {/* 프로젝트 */}
                  {section.type === 'projects' && (
                    <div>
                      {formData.projects.map((item: any, i: number) => (
                        <div key={i} style={itemBoxStyle}>
                          <div style={{ display: 'flex', gap: '5px', marginBottom: '5px', alignItems: 'center' }}>
                            <input value={item.title} onChange={e => handleItemChange('projects', i, 'title', e.target.value)} placeholder="프로젝트명" style={{ ...inputStyle, flex: 1, margin: 0 }} />
                            <button onClick={() => moveItem('projects', i, 'up')}   style={arrowBtnStyle}>⬆️</button>
                            <button onClick={() => moveItem('projects', i, 'down')} style={arrowBtnStyle}>⬇️</button>
                            <button onClick={() => removeItem('projects', i)}       style={delBtnStyle}>❌</button>
                          </div>
                          <input    value={item.link} onChange={e => handleItemChange('projects', i, 'link', e.target.value)} placeholder="링크 URL"  style={inputStyle} />
                          <textarea value={item.desc} onChange={e => handleItemChange('projects', i, 'desc', e.target.value)} placeholder="설명"       style={{ ...inputStyle, height: '50px', marginBottom: 0 }} />
                        </div>
                      ))}
                      <button onClick={() => addItem('projects')} style={addBtn}>+ 프로젝트 추가</button>
                    </div>
                  )}

                  {/* 커스텀 섹션 */}
                  {section.type === 'custom' && (() => {
                    const cData = formData.custom_sections.find((c: any) => c.id === section.id);
                    if (!cData) return null;
                    return (
                      <div>
                        {cData.items.map((item: any, i: number) => (
                          <div key={i} style={itemBoxStyle}>
                            <div style={{ display: 'flex', gap: '5px', marginBottom: '5px', alignItems: 'center' }}>
                              <input value={item.title} onChange={e => handleCustomItemChange(cData.id, i, 'title', e.target.value)} placeholder="소제목" style={{ ...inputStyle, flex: 1, margin: 0 }} />
                              <button onClick={() => moveCustomItem(cData.id, i, 'up')}   style={arrowBtnStyle}>⬆️</button>
                              <button onClick={() => moveCustomItem(cData.id, i, 'down')} style={arrowBtnStyle}>⬇️</button>
                              <button onClick={() => removeCustomItem(cData.id, i)}       style={delBtnStyle}>❌</button>
                            </div>
                            <textarea value={item.desc} onChange={e => handleCustomItemChange(cData.id, i, 'desc', e.target.value)} placeholder="내용" style={{ ...inputStyle, height: '50px', marginBottom: 0 }} />
                          </div>
                        ))}
                        <button onClick={() => addCustomItem(cData.id)} style={addBtn}>+ 항목 추가</button>
                        <button onClick={() => deleteSection(index)} style={{ ...addBtn, background: '#ffcdd2', color: 'red', marginTop: '10px' }}>이 섹션 통째로 삭제</button>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>

        <button onClick={addCustomSection} style={{ ...addBtn, background: '#673ab7', color: 'white', padding: '15px', marginTop: '20px' }}>+ 새 섹션 만들기</button>

        <div style={{ height: '100px' }} />

        {/* ── 하단 고정 버튼 ── */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, width: '100%', background: 'white', padding: '15px', borderTop: '1px solid #ddd', display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button onClick={() => setShowPreview(true)} style={saveBtn}>📱 미리보기</button>
          <button onClick={handleSave} style={{ ...saveBtn, background: '#1a237e' }}>저장하기</button>
        </div>

        {/* ── 토큰 히스토리 모달 ── */}
        {showTokenHistory && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <h3>💎 토큰 사용 기록</h3>
              <ul style={{ listStyle: 'none', padding: 0, maxHeight: '300px', overflowY: 'auto' }}>
                {tokenLogs.length === 0
                  ? <li>기록이 없습니다.</li>
                  : tokenLogs.map((log, i) => (
                    <li key={i} style={{ borderBottom: '1px solid #eee', padding: '10px 0' }}>
                      <div>{log.date} <small>({log.reason})</small></div>
                      <div style={{ fontWeight: 'bold', color: log.amount > 0 ? 'green' : 'red' }}>{log.amount > 0 ? '+' : ''}{log.amount}</div>
                    </li>
                  ))}
              </ul>
              <button onClick={() => setShowTokenHistory(false)} style={closeBtn}>닫기</button>
            </div>
          </div>
        )}

        {/* ── 미리보기 모달 ── */}
        {showPreview && (
          <div style={modalOverlay}>
            <div style={{ background: 'white', width: '360px', height: '640px', display: 'flex', flexDirection: 'column', borderRadius: '15px', overflow: 'hidden' }}>
              <iframe src={`/${myCardId}`} style={{ flex: 1, border: 'none' }} />
              <button onClick={() => setShowPreview(false)} style={closeBtn}>닫기</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 스타일 상수 ────────────────────────────────────────────────────────────
const centerStyle:         React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '20px', textAlign: 'center' };
const inputStyle:          React.CSSProperties = { width: '100%', padding: '10px', marginBottom: '5px', border: '1px solid #ddd', borderRadius: '5px', boxSizing: 'border-box' };
const titleInputStyle:     React.CSSProperties = { fontWeight: 'bold', fontSize: '1rem', border: 'none', background: 'transparent', borderBottom: '1px dashed #999', width: '70%' };
const itemBoxStyle:        React.CSSProperties = { background: '#f9f9f9', padding: '10px', marginBottom: '5px', borderRadius: '5px', border: '1px solid #eee' };
const addBtn:              React.CSSProperties = { width: '100%', padding: '10px', background: '#e3f2fd', border: 'none', cursor: 'pointer', borderRadius: '5px', fontWeight: 'bold' };
const saveBtn:             React.CSSProperties = { flex: 1, padding: '15px', background: '#424242', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '10px', fontWeight: 'bold' };
const tokenBtnStyle:       React.CSSProperties = { background: '#fff9c4', border: '1px solid #fbc02d', borderRadius: '20px', padding: '5px 12px', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', color: '#f57f17' };
const logoutBtnStyle:      React.CSSProperties = { padding: '12px 25px', border: '1px solid #ddd', background: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' };
const googleLoginBtnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 24px', backgroundColor: '#4285F4', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' };
const modalOverlay:        React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999 };
const modalContent:        React.CSSProperties = { background: 'white', padding: '20px', borderRadius: '10px', width: '300px' };
const closeBtn:            React.CSSProperties = { width: '100%', padding: '10px', background: '#333', color: 'white', border: 'none', borderRadius: '5px', marginTop: '10px', cursor: 'pointer' };
const toggleLabelStyle:    React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', padding: '5px 10px', borderRadius: '5px', background: '#f5f5f5' };
const arrowBtnStyle:       React.CSSProperties = { padding: '8px', background: 'white', border: '1px solid #ddd', borderRadius: '5px', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const delBtnStyle:         React.CSSProperties = { padding: '8px 10px', background: '#ffcdd2', color: '#c62828', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' };