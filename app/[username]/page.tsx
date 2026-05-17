// app/[username]/page.tsx
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

export default function NameCard({ params }: { params: { username: string } }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeFeature, setActiveFeature] = useState<'quiz' | 'synergy' | null>(null);
  const [shareMsg, setShareMsg] = useState('');

  // 데이터 로드 + 방문자 통계 기록
  useEffect(() => {
    const fetchData = async () => {
      if (!params.username) return;
      const docRef = doc(db, 'users', params.username);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setData(docSnap.data());
      }
      setLoading(false);
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
  }, [params.username]);

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

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', background: colors.background, minHeight: '100vh', paddingBottom: '80px', boxShadow: '0 0 20px rgba(0,0,0,0.07)', position: 'relative' }}>

      {/* ── 프로필 헤더 ── */}
      {(() => {
        const info = getSecInfo('profile', '기본 정보', true);
        return (
          <div style={{ padding: '50px 20px 40px', textAlign: 'center', background: colors.theme, color: 'white', borderRadius: '0 0 30px 30px', marginBottom: '30px' }}>
            <div style={{ width: '110px', height: '110px', borderRadius: '50%', border: '4px solid rgba(255,255,255,0.3)', margin: '0 auto 15px', overflow: 'hidden', background: 'white' }}>
              <img src={data.profile_img || '/profile_default.jpg'} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h1 style={{ fontSize: '1.8rem', margin: '0 0 8px 0', fontWeight: '800' }}>{data.name}</h1>
            <p style={{ fontSize: '0.95rem', opacity: 0.9, margin: 0 }}>{data.role}</p>

            {/* 번역 + 공유 버튼 */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '15px', flexWrap: 'wrap' }}>
              {isTranslationEnabled && (
                <button onClick={handleTranslate} style={headerBtnStyle}>🌐 English</button>
              )}
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
                    <a key={i} href={href} target="_blank" style={{ ...linkStyle, color: textColor }}>
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
                      <p style={{ margin: 0, color: subColor, fontSize: '0.9rem' }}>{item.desc}</p>
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
                        ? <a href={item.link} target="_blank" style={{ color: colors.theme }}>{item.title} 🔗</a>
                        : item.title}
                    </h3>
                    <p style={{ margin: 0, color: subColor, fontSize: '0.9rem' }}>{item.desc}</p>
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
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '1rem', color: textColor }}>{item.title}</h3>
                    <p style={{ margin: 0, color: subColor, fontSize: '0.9rem' }}>{item.desc}</p>
                  </div>
                ))}
              </Section>
            </div>
          );
        }
        return null;
      })}

      {/* ── 챗봇 & 방명록 ── */}
      <div style={{ padding: '20px' }}>
        {isChatbotEnabled && <ChatBot context={data} username={params.username} themeColor={colors.theme} />}
        <div style={{ height: '30px' }} />
        <Guestbook username={params.username} themeColor={colors.theme} isDark={isDark} />
      </div>

      {/* ── 재미 기능 모달 ── */}
      <FunFeatures
        context={data}
        username={params.username}
        activeFeature={activeFeature}
        onClose={() => setActiveFeature(null)}
      />

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