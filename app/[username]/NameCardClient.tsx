// app/[username]/NameCardClient.tsx
"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import {
  doc, getDoc, collection, addDoc, serverTimestamp
} from 'firebase/firestore';
import ChatBot from '@/components/ChatBot';
import Guestbook from '@/components/Guestbook';
import FunFeatures from '@/components/FunFeatures';

const LINK_ICONS: Record<string, string> = {
  mobile: '📞',
  email: '✉️',
  insta: '📷',
  youtube: '▶️',
  github: '💻',
  blog: '📝',
  other: '🔗',
};

const THEME_PRESETS: Record<string, { background: string; theme: string }> = {
  navy:   { background: '#ffffff', theme: '#1a237e' },
  dark:   { background: '#1a1a2e', theme: '#16213e' },
  green:  { background: '#f1f8e9', theme: '#2e7d32' },
  rose:   { background: '#fff0f3', theme: '#c62828' },
  purple: { background: '#f3e5f5', theme: '#6a1b9a' },
};

export default function NameCardClient({
  params,
  initialData,
}: {
  params: { username: string };
  initialData?: any;
}) {
  const [data, setData] = useState<any>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [activeFeature, setActiveFeature] = useState<'quiz' | 'synergy' | null>(null);
  const [shareMsg, setShareMsg] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInitialPrompt, setChatInitialPrompt] = useState<string | undefined>(undefined);
  const [qrOpen, setQrOpen] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: '', affiliation: '', contact: '', memo: '' });
  const [submittingLead, setSubmittingLead] = useState(false);

  const [skillCardOpen, setSkillCardOpen] = useState(false);
  const [skillCardData, setSkillCardData] = useState<any>(null);
  const [loadingSkillCard, setLoadingSkillCard] = useState(false);

  const handleFetchSkillCard = async () => {
    if (skillCardData) {
      setSkillCardOpen(true);
      return;
    }
    setLoadingSkillCard(true);
    setSkillCardOpen(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'skill_card',
          context: data,
          username: params.username,
        }),
      });
      const result = await res.json();
      let parsed: any = null;
      try {
        parsed = JSON.parse(result.reply);
      } catch (_) {
        parsed = result;
      }
      if (parsed && (parsed.stats || parsed.cardTitle)) {
        setSkillCardData(parsed);
      } else {
        alert(result.error || 'AI 능력치 카드 생성에 실패했습니다.');
        setSkillCardOpen(false);
      }
    } catch (_) {
      alert('능력치 카드를 생성하는 중 오류가 발생했습니다.');
      setSkillCardOpen(false);
  // ─── 학술 인연 기록 모달 ───
  const [academicNoteModalOpen, setAcademicNoteModalOpen] = useState(false);
  const [academicNoteForm, setAcademicNoteForm] = useState({ name: '', event: '', contact: '', note: '' });
  const [submittingAcademicNote, setSubmittingAcademicNote] = useState(false);

  const handleSendAcademicNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicNoteForm.name.trim() || !academicNoteForm.contact.trim()) {
      alert('성함과 연락처를 입력해 주세요.');
      return;
    }
    setSubmittingAcademicNote(true);
    try {
      await addDoc(collection(db, 'users', params.username, 'academic_notes'), {
        name: academicNoteForm.name.trim(),
        event: academicNoteForm.event.trim() || '학회/세미나 미팅',
        contact: academicNoteForm.contact.trim(),
        note: academicNoteForm.note.trim(),
        createdAt: serverTimestamp(),
      });
      alert('🤝 인연 기록이 전달되었습니다!');
      setAcademicNoteForm({ name: '', event: '', contact: '', note: '' });
      setAcademicNoteModalOpen(false);
    } catch (_) {
      alert('전송 중 오류가 발생했습니다.');
    } finally {
      setSubmittingAcademicNote(false);
    }
  };

  // ─── 학술 CV (이력서) PDF 1초 생성 및 다운로드 (20토큰 차감) ───
  const handleDownloadAcademicCv = async () => {
    if (!confirm(`📄 '${data.name}'님의 최신 학술 CV (이력서) PDF를 생성하시겠습니까?\n(20토큰이 차감됩니다)`)) return;

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', params.username);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error('User not found');
        const currentCredits = userDoc.data().credits || 0;
        if (currentCredits < 20) throw new Error('INSUFFICIENT');

        transaction.update(userRef, { credits: currentCredits - 20 });
        const logRef = doc(collection(db, 'users', params.username, 'logs'));
        transaction.set(logRef, {
          type: '사용',
          amount: -20,
          reason: '학술 CV (이력서) PDF 생성',
          date: serverTimestamp(),
        });
      });

      // HTML CV 문서 창 열기 및 인쇄/PDF 저장 트리가
      const win = window.open('', '_blank');
      if (!win) return alert('팝업 차단을 해제해 주세요.');

      const cvHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8"/>
          <title>${data.name} - 학술 CV (Curriculum Vitae)</title>
          <style>
            body { font-family: 'Apple SD Gothic Neo', sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; line-height: 1.6; }
            h1 { font-size: 26px; border-bottom: 2px solid #1e293b; padding-bottom: 8px; margin-bottom: 4px; }
            .subtitle { font-size: 15px; color: #475569; margin-bottom: 20px; }
            .section-title { font-size: 18px; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 24px; margin-bottom: 12px; font-weight: bold; }
            .item { margin-bottom: 10px; }
            .item-title { font-weight: bold; font-size: 15px; }
            .item-date { color: #64748b; font-size: 13px; }
            .item-desc { font-size: 14px; color: #334155; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>${data.name || ''} CV</h1>
          <div class="subtitle">${data.role || ''} | 연락처: ${data.owner_email || ''}</div>
          
          ${data.intro ? `<div class="section-title">📌 프로필 개요</div><div>${data.intro}</div>` : ''}

          ${data.history?.length ? `
            <div class="section-title">🎓 학력 및 경력 사항</div>
            ${data.history.map((h: any) => `
              <div class="item">
                <div class="item-title">${h.title} <span class="item-date">(${h.date})</span></div>
                <div class="item-desc">${h.desc || ''}</div>
              </div>
            `).join('')}
          ` : ''}

          ${data.projects?.length ? `
            <div class="section-title">🔬 연구 실적 및 대표 프로젝트</div>
            ${data.projects.map((p: any) => `
              <div class="item">
                <div class="item-title">${p.title}</div>
                <div class="item-desc">${p.desc || ''}</div>
              </div>
            `).join('')}
          ` : ''}

          ${data.custom_knowledge?.length ? `
            <div class="section-title">💡 대표 전문 지식 & 학술 자격</div>
            <ul>
              ${data.custom_knowledge.map((k: string) => `<li>${k}</li>`).join('')}
            </ul>
          ` : ''}

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
        </html>
      `;

      win.document.write(cvHtml);
      win.document.close();
      alert('📄 학술 CV (이력서) PDF 문서가 생성되었습니다! (20토큰 차감 완료)');
    } catch (e: any) {
      if (e.message === 'INSUFFICIENT') {
        alert('토큰이 부족합니다. (CV 생성 비용: 20토큰)');
      } else {
        alert('CV 생성 중 오류가 발생했습니다.');
      }
    }
  };

  // ─── 링크 클릭 트래킹 ──────────────────────────────────────────────────
  const trackClick = async (type: string, label: string, targetUrl?: string) => {
    if (!params.username) return;
    try {
      await addDoc(collection(db, 'users', params.username, 'clicks'), {
        type,
        label: (label || '').slice(0, 100),
        targetUrl: (targetUrl || '').slice(0, 200),
        clickedAt: serverTimestamp(),
      });
    } catch (_) {}
  };

  // ─── 내 연락처 전달 제출 ────────────────────────────────────────────────
  const handleSendLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.name.trim() || !leadForm.contact.trim()) {
      alert('이름과 연락처(전화번호 또는 이메일)를 입력해 주세요.');
      return;
    }
    setSubmittingLead(true);
    try {
      await addDoc(collection(db, 'users', params.username, 'leads'), {
        name: leadForm.name.trim(),
        affiliation: leadForm.affiliation.trim(),
        contact: leadForm.contact.trim(),
        memo: leadForm.memo.trim(),
        createdAt: serverTimestamp(),
      });
      alert('연락처가 성공적으로 전달되었습니다! 🎉');
      setLeadForm({ name: '', affiliation: '', contact: '', memo: '' });
      setLeadModalOpen(false);
    } catch (_) {
      alert('연락처 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmittingLead(false);
    }
  };

  // 데이터 로드 + 방문자 통계 기록
  useEffect(() => {
    const fetchData = async () => {
      if (!params.username) return;
      if (!initialData) {
        const docRef = doc(db, 'users', params.username);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setData(docSnap.data());
        }
        setLoading(false);
      }
    };
    fetchData();

    // 방문자 통계 기록 (비동기, 실패해도 무관)
    const recordVisit = async () => {
      try {
        await addDoc(collection(db, 'users', params.username, 'visits'), {
          visitedAt: serverTimestamp(),
          userAgent: navigator.userAgent.slice(0, 100),
          referrer: document.referrer || 'direct',
        });
      } catch (_) {}
    };
    recordVisit();
  }, [params.username, initialData]);

  const isAiEnabled        = data?.aiEnabled !== false;
  const isChatbotEnabled   = isAiEnabled && data?.chatbotEnabled !== false;
  const isTranslationEnabled = isAiEnabled && data?.translationEnabled !== false;
  const isQuizEnabled      = isAiEnabled && data?.quizEnabled !== false;
  const isSynergyEnabled   = isAiEnabled && data?.synergyEnabled !== false;

  // ─── 번역 (토큰 차감은 서버에서만 처리) ───────────────────────────────
  const handleTranslate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'translate', context: data, username: params.username, targetLang: 'en' }),
      });
      const result = await res.json();
      if (result.reply) {
        try {
          const parsed = JSON.parse(result.reply);
          setData(parsed);
        } catch (_) {}
      } else if (result.error) {
        alert(result.error);
      }
    } catch (_) {
      alert('잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // ─── 명함 공유 ────────────────────────────────────────────────────────
  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${data?.name}님의 명함`, url });
        return;
      } catch (_) {}
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg('링크 복사 완료! 🎉');
      setTimeout(() => setShareMsg(''), 2000);
    } catch (_) {
      alert(url);
    }
  };

  // ─── 연락처 저장 (.vcf / vCard) ──────────────────────────────────────
  const handleDownloadVcard = () => {
    if (!data) return;
    const mobileLink = data.links?.find((l: any) => l.type === 'mobile')?.value || '';
    const emailLink = data.links?.find((l: any) => l.type === 'email')?.value || '';
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

    const vcardLines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${data.name || ''}`,
      data.role ? `TITLE:${data.role}` : '',
      mobileLink ? `TEL;TYPE=CELL:${mobileLink}` : '',
      emailLink ? `EMAIL:${emailLink}` : '',
      currentUrl ? `URL:${currentUrl}` : '',
      data.intro ? `NOTE:${data.intro.replace(/\n/g, '\\n')}` : '',
      'END:VCARD'
    ].filter(Boolean).join('\n');

    const blob = new Blob([vcardLines], { type: 'text/vcard;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', `${data.name || 'contact'}_연락처.vcf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  };

  if (loading && !data) return <div style={{ padding: '50px', textAlign: 'center' }}>로딩 중...</div>;
  if (!data) return <div style={{ padding: '50px', textAlign: 'center' }}>존재하지 않는 명함입니다.</div>;

  const config     = data.section_config || {};
  const rawColors  = data.colors || {};
  const preset     = data.theme_preset ? THEME_PRESETS[data.theme_preset] : null;
  const colors     = preset || { background: rawColors.background || '#ffffff', theme: rawColors.theme || '#1a237e' };
  const isDark     = colors.background.startsWith('#1') || colors.background.startsWith('#0');
  const textColor  = isDark ? '#ffffff' : '#333333';
  const subColor   = isDark ? 'rgba(255,255,255,0.7)' : '#666666';

  const order      = data.section_order || [];
  const renderOrder = order.filter((id: string) => id !== 'profile');

  const getSecInfo = (id: string, defaultTitle: string, defaultOpen: boolean) => {
    const conf = config[id] || {};
    return { title: conf.title || defaultTitle, defaultOpen: conf.isDefaultOpen ?? defaultOpen };
  };

  const cardUrl = typeof window !== 'undefined' ? window.location.href : `https://aim-nc.vercel.app/${params.username}`;

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', background: colors.background, minHeight: '100vh', paddingBottom: '80px', boxShadow: '0 0 20px rgba(0,0,0,0.07)', position: 'relative' }}>

      {/* ── 프로필 헤더 ── */}
      {(() => {
        const info = getSecInfo('profile', '기본 정보', true);
        const avatarRadius = data.avatar_shape === 'rounded' ? '24px' : data.avatar_shape === 'square' ? '12px' : '50%';
        const headerBg = data.cover_img
          ? `linear-gradient(180deg, rgba(0,0,0,0.3) 0%, ${colors.theme} 100%), url(${data.cover_img}) center/cover no-repeat`
          : colors.theme;

        return (
          <div style={{ padding: '50px 20px 40px', textAlign: 'center', background: headerBg, color: 'white', borderRadius: '0 0 30px 30px', marginBottom: '30px', position: 'relative' }}>
            <div style={{ width: '110px', height: '110px', borderRadius: avatarRadius, border: '4px solid rgba(255,255,255,0.4)', margin: '0 auto 15px', overflow: 'hidden', background: 'white', boxShadow: '0 8px 20px rgba(0,0,0,0.15)' }}>
              <img src={data.profile_img || '/profile_default.jpg'} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h1 style={{ fontSize: '1.8rem', margin: '0 0 8px 0', fontWeight: '800' }}>{data.name}</h1>
            <p style={{ fontSize: '0.95rem', opacity: 0.9, margin: 0 }}>{data.role}</p>

            {/* 헤더 버튼 그룹 (번역 + CV 생성 + 만남 기록 + 연락처 저장 + 연락처 전달 + AI능력치카드 + QR + 공유) */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '15px', flexWrap: 'wrap' }}>
              {isTranslationEnabled && (
                <button onClick={handleTranslate} style={headerBtnStyle}>🌐 English</button>
              )}
              <button onClick={handleDownloadAcademicCv} style={{ ...headerBtnStyle, background: 'rgba(255,255,255,0.25)', fontWeight: 'bold' }}>
                📄 학술 CV 생성
              </button>
              <button onClick={() => setAcademicNoteModalOpen(true)} style={{ ...headerBtnStyle, background: 'rgba(255,255,255,0.25)', fontWeight: 'bold' }}>
                🤝 만남 기록
              </button>
              <button onClick={handleDownloadVcard} style={headerBtnStyle}>
                📇 연락처 저장
              </button>
              <button onClick={() => setLeadModalOpen(true)} style={headerBtnStyle}>
                📩 내 연락처 전달
              </button>
              <button onClick={handleFetchSkillCard} style={{ ...headerBtnStyle, background: 'rgba(255,215,0,0.25)', border: '1px solid rgba(255,215,0,0.5)', fontWeight: 'bold' }}>
                🏆 AI 능력치 카드
              </button>
              <button onClick={() => setQrOpen(true)} style={headerBtnStyle}>
                📷 QR 코드
              </button>
              <button onClick={handleShare} style={headerBtnStyle}>
                {shareMsg || '🔗 공유'}
              </button>
            </div>

            {info.defaultOpen && (
              <div style={{ marginTop: '20px', fontSize: '0.9rem', opacity: 0.9, lineHeight: '1.5', background: 'rgba(255,255,255,0.1)', padding: '15px', borderRadius: '10px' }}>
                {data.intro}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── AI 챗봇 CTA ── */}
      {isChatbotEnabled && (
        <div style={{ padding: '0 20px', marginBottom: '20px' }}>
          <button
            onClick={() => {
              setChatInitialPrompt(undefined);
              setChatOpen(true);
            }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
              padding: '16px 18px', borderRadius: '16px', border: 'none', cursor: 'pointer',
              background: `linear-gradient(135deg, ${colors.theme} 0%, ${colors.theme}cc 100%)`,
              color: 'white', textAlign: 'left',
              boxShadow: `0 6px 18px ${colors.theme}55`,
            }}
          >
            <span style={{ fontSize: '2rem' }}>🤖</span>
            <span>
              <div style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>AI 비서에게 물어보세요</div>
              <div style={{ fontSize: '0.82rem', opacity: 0.9, marginTop: '2px' }}>
                {data.name}님에 대해 무엇이든 질문해보세요 →
              </div>
            </span>
          </button>
        </div>
      )}

      {/* ── 흥미 기능 버튼 ── */}
      <div style={{ padding: '0 20px', marginBottom: '25px', display: 'flex', gap: '10px' }}>
        {isQuizEnabled && (
          <button onClick={() => setActiveFeature('quiz')} style={funBtnStyle}>
            🧠<br />찐친 고사
          </button>
        )}
        {isSynergyEnabled && (
          <button onClick={() => setActiveFeature('synergy')} style={{ ...funBtnStyle, background: '#fff0f6', color: '#d6336c', border: '1px solid #ffadd2' }}>
            💘<br />MBTI 궁합
          </button>
        )}
      </div>

      {/* ── 섹션 렌더링 ── */}
      {renderOrder.map((sectionId: string) => {
        if (sectionId === 'links' && data.links?.length > 0) {
          const info = getSecInfo('links', '링크', true);
          return (
            <div key="links" style={secWrapStyle}>
              <Section title={info.title} defaultOpen={info.defaultOpen} themeColor={colors.theme} isDark={isDark}>
                {data.links.map((link: any, i: number) => {
                  const icon = LINK_ICONS[link.type] || '🔗';
                  const href = link.type === 'mobile'
                    ? `tel:${link.value}`
                    : link.type === 'email'
                    ? `mailto:${link.value}`
                    : link.value.startsWith('http') ? link.value : `https://${link.value}`;
                  return (
                    <a key={i} href={href} target="_blank" rel="noopener noreferrer" onClick={() => trackClick(link.type || 'link', link.value, href)} style={{ ...linkStyle, color: textColor }}>
                      <span style={{ marginRight: '12px', fontSize: '1.2rem' }}>{icon}</span>
                      <span style={{ fontWeight: '600' }}>{link.value}</span>
                    </a>
                  );
                })}
              </Section>
            </div>
          );
        }

        if (sectionId === 'history' && data.history?.length > 0) {
          const info = getSecInfo('history', '연혁 (History)', true);
          return (
            <div key="history" style={secWrapStyle}>
              <Section title={info.title} defaultOpen={info.defaultOpen} themeColor={colors.theme} isDark={isDark}>
                <div style={{ borderLeft: `2px solid ${colors.theme}55`, paddingLeft: '15px', marginLeft: '5px' }}>
                  {data.history.map((item: any, idx: number) => (
                    <div key={idx} style={{ marginBottom: '20px' }}>
                      <span style={{ color: colors.theme, fontWeight: '800', fontSize: '0.85rem' }}>{item.date}</span>
                      <h3 style={{ margin: '4px 0', fontSize: '1rem', color: textColor }}>{item.title}</h3>
                      <p style={{ margin: 0, color: subColor, fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{renderTextWithLinks(item.desc, colors.theme)}</p>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          );
        }

        if (sectionId === 'projects' && data.projects?.length > 0) {
          const info = getSecInfo('projects', '프로젝트', false);
          return (
            <div key="projects" style={secWrapStyle}>
              <Section title={info.title} defaultOpen={info.defaultOpen} themeColor={colors.theme} isDark={isDark}>
                {data.projects.map((item: any, idx: number) => (
                  <div key={idx} style={{ marginBottom: '15px', background: isDark ? 'rgba(255,255,255,0.06)' : '#f9f9f9', padding: '15px', borderRadius: '10px' }}>
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '1rem', color: textColor }}>
                      {item.link
                        ? <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ color: colors.theme }}>{item.title} 🔗</a>
                        : item.title}
                    </h3>
                    <p style={{ margin: 0, color: subColor, fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{renderTextWithLinks(item.desc, colors.theme)}</p>
                  </div>
                ))}
              </Section>
            </div>
          );
        }

        const customSec = data.custom_sections?.find((c: any) => c.id === sectionId);
        if (customSec) {
          const info = getSecInfo(sectionId, customSec.title, false);
          return (
            <div key={sectionId} style={secWrapStyle}>
              <Section title={info.title} defaultOpen={info.defaultOpen} themeColor={colors.theme} isDark={isDark}>
                {customSec.items.map((item: any, i: number) => (
                  <div key={i} style={{ marginBottom: '15px' }}>
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '1rem', color: textColor }}>{renderTextWithLinks(item.title, colors.theme)}</h3>
                    <p style={{ margin: 0, color: subColor, fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{renderTextWithLinks(item.desc, colors.theme)}</p>
                  </div>
                ))}
              </Section>
            </div>
          );
        }
        return null;
      })}

      {/* ── 📂 발표 자료 및 강의 소개서 쉘프 ── */}
      {data.slide_shelf?.length > 0 && (
        <div style={secWrapStyle}>
          <Section title="📂 발표 자료 & 강의 소개서 라이브러리" defaultOpen={true} themeColor={colors.theme} isDark={isDark}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {data.slide_shelf.map((slide: any, idx: number) => (
                <div key={idx} style={{ padding: '12px 14px', background: isDark ? 'rgba(255,255,255,0.06)' : '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '0.95rem', color: textColor, display: 'block' }}>{slide.title}</strong>
                    {slide.desc && <span style={{ fontSize: '0.8rem', color: subColor }}>{slide.desc}</span>}
                  </div>
                  <a
                    href={slide.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackClick('slide', slide.title, slide.fileUrl)}
                    style={{ padding: '8px 14px', background: colors.theme, color: 'white', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.8rem' }}
                  >
                    📥 PDF 다운로드
                  </a>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ── 챗봇 & 방명록 ── */}
      <div style={{ padding: '20px' }}>
        {isChatbotEnabled && (
          <ChatBot
            context={data}
            username={params.username}
            themeColor={colors.theme}
            isOpen={chatOpen}
            onOpenChange={setChatOpen}
            initialPrompt={chatInitialPrompt}
          />
        )}
        <div style={{ height: '30px' }} />
        <Guestbook username={params.username} themeColor={colors.theme} isDark={isDark} />
      </div>

      {/* ── 🤝 학회/미팅 만남 기록 모달 ── */}
      {academicNoteModalOpen && (
        <div style={modalOverlay} onClick={() => setAcademicNoteModalOpen(false)}>
          <div
            style={{
              background: isDark ? '#1a1a2e' : 'white',
              color: textColor,
              padding: '24px 20px',
              borderRadius: '24px',
              maxWidth: '360px',
              width: '90%',
              textAlign: 'left',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.2rem', margin: '0 0 6px 0', fontWeight: 'bold' }}>
              🤝 {data.name}님과의 만남 기록 남기기
            </h2>
            <p style={{ fontSize: '0.82rem', color: subColor, margin: '0 0 16px 0' }}>
              어느 학회/세미나에서 만났는지 남겨주시면 서로의 학술 인연을 쉽게 기억할 수 있습니다.
            </p>

            <form onSubmit={handleSendAcademicNote} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 'bold', color: subColor, display: 'block', marginBottom: '4px' }}>성함 *</label>
                <input
                  required
                  type="text"
                  placeholder="예: 홍길동 연구원"
                  value={academicNoteForm.name}
                  onChange={(e) => setAcademicNoteForm({ ...academicNoteForm, name: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 'bold', color: subColor, display: 'block', marginBottom: '4px' }}>학회 / 세미나 / 행사명</label>
                <input
                  type="text"
                  placeholder="예: 2026 한국인공지능학회 하계 학술대회"
                  value={academicNoteForm.event}
                  onChange={(e) => setAcademicNoteForm({ ...academicNoteForm, event: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 'bold', color: subColor, display: 'block', marginBottom: '4px' }}>연락처 (전화번호 / 이메일) *</label>
                <input
                  required
                  type="text"
                  placeholder="010-0000-0000 또는 email@domain.com"
                  value={academicNoteForm.contact}
                  onChange={(e) => setAcademicNoteForm({ ...academicNoteForm, contact: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 'bold', color: subColor, display: 'block', marginBottom: '4px' }}>대화 메모 / 공동 연구 주제</label>
                <textarea
                  placeholder="세미나 세션 내용이나 대화 나누었던 관심 연구 분야"
                  value={academicNoteForm.note}
                  onChange={(e) => setAcademicNoteForm({ ...academicNoteForm, note: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '0.9rem', height: '60px', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="submit"
                  disabled={submittingAcademicNote}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    border: 'none',
                    background: colors.theme,
                    color: 'white',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  {submittingAcademicNote ? '전송 중...' : '만남 기록 전달'}
                </button>
                <button
                  type="button"
                  onClick={() => setAcademicNoteModalOpen(false)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid #ccc',
                    background: 'transparent',
                    color: textColor,
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 🏆 AI 능력치 카드 팝업 모달 ── */}
      {skillCardOpen && (
        <div style={modalOverlay} onClick={() => setSkillCardOpen(false)}>
          <div
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
              color: 'white',
              padding: '28px 22px',
              borderRadius: '24px',
              maxWidth: '360px',
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 15px 40px rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,215,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {loadingSkillCard ? (
              <div style={{ padding: '40px 0' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🤖</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>AI가 능력치를 분석 중입니다...</div>
                <div style={{ fontSize: '0.8rem', color: '#a5b4fc', marginTop: '6px' }}>3토큰 차감 중</div>
              </div>
            ) : skillCardData ? (
              <div>
                <div style={{ display: 'inline-block', background: 'rgba(255,215,0,0.15)', border: '1px solid #fde047', color: '#fde047', padding: '4px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 'bold', marginBottom: '8px' }}>
                  🏆 {skillCardData.summaryBadge || 'S급 AI 전문가'}
                </div>
                <h2 style={{ fontSize: '1.4rem', margin: '0 0 4px 0', fontWeight: '900', color: '#ffffff' }}>
                  {skillCardData.cardTitle || `${data.name}님의 능력치 카드`}
                </h2>
                <p style={{ fontSize: '0.82rem', color: '#cbd5e1', margin: '0 0 16px 0' }}>
                  {data.name} ({data.role})
                </p>

                {/* SVG 5각 헥사곤/펜타곤 레이더 차트 */}
                <div style={{ width: '220px', height: '220px', margin: '0 auto 16px', position: 'relative' }}>
                  <svg width="220" height="220" viewBox="0 0 220 220">
                    {/* 배경 가이드 원 및 축선 */}
                    {[0.2, 0.4, 0.6, 0.8, 1.0].map((rRatio, idx) => {
                      const r = 75 * rRatio;
                      const pointsStr = [0, 1, 2, 3, 4].map(i => {
                        const angle = (Math.PI / 180) * (i * 72 - 90);
                        const x = 110 + r * Math.cos(angle);
                        const y = 110 + r * Math.sin(angle);
                        return `${x},${y}`;
                      }).join(' ');
                      return <polygon key={idx} points={pointsStr} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />;
                    })}

                    {/* 축선 */}
                    {[0, 1, 2, 3, 4].map(i => {
                      const angle = (Math.PI / 180) * (i * 72 - 90);
                      const x = 110 + 75 * Math.cos(angle);
                      const y = 110 + 75 * Math.sin(angle);
                      return <line key={i} x1="110" y1="110" x2={x} y2={y} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />;
                    })}

                    {/* 실체 데이터 레이더 다각형 */}
                    {(() => {
                      const stats = skillCardData.stats || [
                        { label: '전문성', score: 90 }, { label: '구현력', score: 85 },
                        { label: '영향력', score: 88 }, { label: '문제해결', score: 92 },
                        { label: '소통력', score: 80 }
                      ];
                      const polyPoints = stats.map((st: any, i: number) => {
                        const r = 75 * (Math.min(100, Math.max(20, st.score)) / 100);
                        const angle = (Math.PI / 180) * (i * 72 - 90);
                        const x = 110 + r * Math.cos(angle);
                        const y = 110 + r * Math.sin(angle);
                        return `${x},${y}`;
                      }).join(' ');
                      return (
                        <polygon
                          points={polyPoints}
                          fill="rgba(99, 102, 241, 0.45)"
                          stroke="#818cf8"
                          strokeWidth="2.5"
                        />
                      );
                    })()}
                  </svg>
                </div>

                {/* 5개 스탯 항목 표시 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', textAlign: 'left', background: 'rgba(255,255,255,0.05)', padding: '10px 12px', borderRadius: '12px', marginBottom: '14px' }}>
                  {(skillCardData.stats || []).map((st: any, idx: number) => (
                    <div key={idx} style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', color: '#e2e8f0' }}>
                      <span>• {st.label}</span>
                      <strong style={{ color: '#fde047' }}>{st.score}점</strong>
                    </div>
                  ))}
                </div>

                {skillCardData.specialSkill && (
                  <div style={{ fontSize: '0.8rem', background: 'rgba(99,102,241,0.2)', color: '#c7d2fe', padding: '10px', borderRadius: '10px', marginBottom: '16px', border: '1px solid rgba(165,180,252,0.3)' }}>
                    ⚡ <strong>필살기:</strong> {skillCardData.specialSkill}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleShare}
                    style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.88rem' }}
                  >
                    {shareMsg || '📸 카드 공유하기'}
                  </button>
                  <button
                    onClick={() => setSkillCardOpen(false)}
                    style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'white', cursor: 'pointer', fontSize: '0.88rem' }}
                  >
                    닫기
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── 재미 기능 모달 ── */}
      <FunFeatures
        context={data}
        username={params.username}
        activeFeature={activeFeature}
        onClose={() => setActiveFeature(null)}
      />

      {/* ── 현장 교환용 QR 코드 팝업 모달 ── */}
      {qrOpen && (
        <div style={modalOverlay} onClick={() => setQrOpen(false)}>
          <div
            style={{
              background: isDark ? '#1a1a2e' : 'white',
              color: textColor,
              padding: '30px 20px',
              borderRadius: '24px',
              maxWidth: '340px',
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.25rem', margin: '0 0 6px 0', fontWeight: 'bold' }}>{data.name}님의 QR 명함</h2>
            <p style={{ fontSize: '0.85rem', color: subColor, margin: '0 0 20px 0' }}>카메라로 스캔하여 명함을 열어보세요</p>

            <div style={{ background: 'white', padding: '16px', borderRadius: '20px', display: 'inline-block', boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(cardUrl)}`}
                alt="QR Code"
                style={{ width: '200px', height: '200px', display: 'block' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '22px' }}>
              <button
                onClick={handleShare}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '14px',
                  border: 'none',
                  background: colors.theme,
                  color: 'white',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                {shareMsg || '🔗 링크 복사'}
              </button>
              <button
                onClick={() => setQrOpen(false)}
                style={{
                  padding: '12px 18px',
                  borderRadius: '14px',
                  border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid #ddd',
                  background: 'transparent',
                  color: textColor,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 역방향 연락처 전달 모달 ── */}
      {leadModalOpen && (
        <div style={modalOverlay} onClick={() => setLeadModalOpen(false)}>
          <div
            style={{
              background: isDark ? '#1a1a2e' : 'white',
              color: textColor,
              padding: '24px 20px',
              borderRadius: '24px',
              maxWidth: '360px',
              width: '90%',
              textAlign: 'left',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.2rem', margin: '0 0 6px 0', fontWeight: 'bold' }}>
              📩 {data.name}님에게 연락처 전달하기
            </h2>
            <p style={{ fontSize: '0.82rem', color: subColor, margin: '0 0 16px 0' }}>
              명함 주인에게 내 성함과 연락처를 직접 남길 수 있습니다.
            </p>

            <form onSubmit={handleSendLead} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 'bold', color: subColor, display: 'block', marginBottom: '4px' }}>성함 *</label>
                <input
                  required
                  type="text"
                  placeholder="예: 홍길동"
                  value={leadForm.name}
                  onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 'bold', color: subColor, display: 'block', marginBottom: '4px' }}>소속 / 직함</label>
                <input
                  type="text"
                  placeholder="예: 한국대학교 연구원"
                  value={leadForm.affiliation}
                  onChange={(e) => setLeadForm({ ...leadForm, affiliation: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 'bold', color: subColor, display: 'block', marginBottom: '4px' }}>연락처 (전화번호 / 이메일) *</label>
                <input
                  required
                  type="text"
                  placeholder="010-0000-0000 또는 email@domain.com"
                  value={leadForm.contact}
                  onChange={(e) => setLeadForm({ ...leadForm, contact: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 'bold', color: subColor, display: 'block', marginBottom: '4px' }}>메시지 / 메모</label>
                <textarea
                  placeholder="전하고 싶은 메시지나 메모를 남겨주세요"
                  value={leadForm.memo}
                  onChange={(e) => setLeadForm({ ...leadForm, memo: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '0.9rem', height: '60px', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="submit"
                  disabled={submittingLead}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    border: 'none',
                    background: colors.theme,
                    color: 'white',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  {submittingLead ? '전송 중...' : '전달하기'}
                </button>
                <button
                  type="button"
                  onClick={() => setLeadModalOpen(false)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid #ccc',
                    background: 'transparent',
                    color: textColor,
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading && (
        <div style={modalOverlay}>
          <div style={{ color: 'white', fontWeight: 'bold', fontSize: '1.2rem' }}>🤖 AI 분석 중...</div>
        </div>
      )}
    </div>
  );
}

// ── Section 컴포넌트 ────────────────────────────────────────────────────────
const Section = ({ title, children, defaultOpen, themeColor, isDark }: any) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const bg    = isDark ? 'rgba(255,255,255,0.05)' : 'white';
  const color = isDark ? '#ffffff' : '#333';
  return (
    <div style={{ border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #eee', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', background: bg }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{ padding: '15px', background: bg, fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', borderBottom: isOpen ? (isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #f0f0f0') : 'none', color }}
      >
        {title} <span>{isOpen ? '▲' : '▼'}</span>
      </div>
      {isOpen && <div style={{ padding: '20px' }}>{children}</div>}
    </div>
  );
};

// ── 스타일 상수 ────────────────────────────────────────────────────────────
const secWrapStyle  = { padding: '0 20px', marginBottom: '20px' };
const linkStyle     = { display: 'flex', alignItems: 'center', padding: '15px', marginBottom: '10px', background: 'rgba(0,0,0,0.02)', border: '1px solid #eee', borderRadius: '12px', textDecoration: 'none' };
const funBtnStyle   = { flex: 1, padding: '15px', borderRadius: '15px', border: '1px solid #e3f2fd', background: '#f0f9ff', color: '#0288d1', fontWeight: 'bold' as 'bold', cursor: 'pointer', lineHeight: '1.4', fontSize: '0.9rem' };
const headerBtnStyle: React.CSSProperties = { padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: 'white', cursor: 'pointer', fontSize: '0.75rem' };
const modalOverlay  = { position: 'fixed' as 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' };

// ── URL & DOI 링크 감지 렌더링 함수 ──────────────────────────────────────────
function renderTextWithLinks(text: string | undefined | null, themeColor: string) {
  if (!text) return null;

  // URL (http:// 또는 https://) 및 DOI (10.xxxx/...) 정규식 패턴
  const combinedRegex = /(https?:\/\/[^\s]+|\b10\.\d{4,9}\/[^\s]+)/gi;
  const parts = text.split(combinedRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    // 문장 끝 문장부호 (., ;, ), ]) 분리 처리
    let cleanPart = part;
    let trailingPunct = '';
    const matchPunct = part.match(/([.,;:\)]+)$/);
    if (matchPunct) {
      trailingPunct = matchPunct[1];
      cleanPart = part.slice(0, -trailingPunct.length);
    }

    const isUrl = /^https?:\/\//i.test(cleanPart);
    const isDoi = /^\b10\.\d{4,9}\//i.test(cleanPart);

    if (isUrl || isDoi) {
      const href = isUrl ? cleanPart : `https://doi.org/${cleanPart}`;
      return (
        <span key={index}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: themeColor,
              textDecoration: 'underline',
              wordBreak: 'break-all',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {cleanPart}
          </a>
          {trailingPunct}
        </span>
      );
    }

    return <span key={index}>{part}</span>;
  });
}
