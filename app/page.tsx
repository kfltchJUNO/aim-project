// app/page.tsx
"use client";

import { useState } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const PLAN_VARIANTS = [
  { id: '2088337', name: '베이직 플랜', price: '30,000원', tokens: '0 토큰 (기본 명함 기능)', badge: '입문용', popular: false },
  { id: '2088339', name: '스마트 플랜 A', price: '45,000원', tokens: '1,000 토큰 (AI 챗봇 포함)', badge: '인기', popular: true },
  { id: '2088349', name: '스마트 플랜 B', price: '55,000원', tokens: '3,000 토큰 (AI 챗봇 + 퀴즈)', badge: '추천', popular: false },
  { id: '2088350', name: '스마트 플랜 C', price: '65,000원', tokens: '5,000 토큰 (여유로운 사용)', badge: '고성능', popular: false },
  { id: '2088352', name: '스마트 메가 플랜', price: '90,000원', tokens: '10,000 토큰 (대용량)', badge: 'VIP', popular: false },
];

export default function HomePage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // 1단계: 명함 ID
  const [desiredId, setDesiredId] = useState('');
  const [checkingId, setCheckingId] = useState(false);
  const [idStatus, setIdStatus] = useState<'none' | 'available' | 'taken' | 'invalid'>('none');

  // 2단계: 기본 정보
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    email: '',
    mobile: '',
    intro: '',
  });

  // 명함 ID 실시간 중복 체크
  const handleCheckId = async (id: string) => {
    const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    setDesiredId(cleanId);

    if (!cleanId || cleanId.length < 2) {
      setIdStatus('invalid');
      return;
    }

    setCheckingId(true);
    try {
      const docRef = doc(db, 'users', cleanId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setIdStatus('taken');
      } else {
        setIdStatus('available');
      }
    } catch (_) {
      setIdStatus('none');
    } finally {
      setCheckingId(false);
    }
  };

  // 3단계: 결제 이동
  const handleProceedToPayment = (variantId: string) => {
    if (!desiredId || idStatus !== 'available') {
      alert('사용 가능한 명함 ID를 먼저 검증해 주세요.');
      setStep(1);
      return;
    }
    if (!formData.name || !formData.email) {
      alert('성함과 이메일 주소를 입력해 주세요.');
      setStep(2);
      return;
    }

    const checkoutUrl = `https://store.lemonsqueezy.com/checkout/buy/${variantId}?checkout[custom][username]=${encodeURIComponent(desiredId)}&checkout[email]=${encodeURIComponent(formData.email)}`;
    window.open(checkoutUrl, '_blank');
  };

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', color: '#f8fafc', fontFamily: 'sans-serif' }}>
      
      {/* ── 상단 네비게이션 ── */}
      <nav style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.8rem' }}>📇</span>
          <span style={{ fontSize: '1.4rem', fontWeight: '900', color: '#ffffff', letterSpacing: '-0.5px' }}>
            AIM <span style={{ fontSize: '0.8rem', background: '#3b82f6', color: 'white', padding: '2px 8px', borderRadius: '10px', verticalAlign: 'middle' }}>AI 명함</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link href="/admin" style={{ padding: '9px 16px', background: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: '12px', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.2)' }}>
            ⚙️ 내 명함 관리 (로그인)
          </Link>
          <a href="#onboarding" style={{ padding: '9px 18px', background: '#3b82f6', color: 'white', borderRadius: '12px', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 'bold' }}>
            🚀 신규 명함 만들기
          </a>
        </div>
      </nav>

      {/* ── HERO 섹션 ── */}
      <section style={{ maxWidth: '900px', margin: '0 auto', padding: '60px 20px 40px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid #60a5fa', color: '#93c5fd', padding: '6px 16px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '20px' }}>
          ✨ 연구자·교원·전문가를 위한 다중 사용자 AI 전자명함 플랫폼
        </div>
        <h1 style={{ fontSize: '2.8rem', lineHeight: 1.25, fontWeight: '900', margin: '0 0 20px 0', background: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          종이 명함 대신 1초 만에 스마트폰으로<br />
          나만의 AI 챗봇 비서를 전달하세요
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#94a3b8', lineHeight: 1.6, maxWidth: '680px', margin: '0 auto 36px' }}>
          학술대회, 미팅 현장에서 QR/NFC/링크 1초 전송! 내 논문과 이력을 완벽히 학습한 <strong>AI 비서가 24시간 나를 대리 답변</strong>해 줍니다.
        </p>

        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="#onboarding" style={{ padding: '16px 32px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', borderRadius: '16px', textDecoration: 'none', fontSize: '1.05rem', fontWeight: 'bold', boxShadow: '0 10px 25px rgba(37, 99, 235, 0.4)' }}>
            ⚡ 30초 만에 셀프 명함 신청하기
          </a>
          <Link href="/junho" target="_blank" style={{ padding: '16px 24px', background: 'rgba(255,255,255,0.08)', color: '#e2e8f0', borderRadius: '16px', textDecoration: 'none', fontSize: '1.05rem', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.15)' }}>
            👀 샘플 명함 체험하기 (/junho)
          </Link>
        </div>
      </section>

      {/* ── 주요 기능 4가지 ── */}
      <section style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px 80px' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '40px' }}>
          💡 차원이 다른 AI 전자명함의 핵심 기능
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          {[
            { icon: '🤖', title: '1:1 AI 챗봇 비서', desc: '내 이력과 논문을 학습하여 방문자 질문에 24시간 실시간 대답' },
            { icon: '📩', title: '역방향 연락처 전달', desc: '명함을 받은 상대방이 성함/연락처를 남기면 엑셀(CSV) 다운로드' },
            { icon: '🏆', title: 'AI 능력치 & 궁합', desc: 'RPG 5각 스탯 카드 생성 및 MBTI 대화 궁합 분석 기능 제공' },
            { icon: '📄', title: 'PDF 논문 AI 자동 학습', desc: '논문 PDF나 CV 파일을 업로드하면 AI가 핵심 업적 자동 수집' },
          ].map((f, i) => (
            <div key={i} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '20px', padding: '24px', textAlign: 'left' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>{f.icon}</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#f1f5f9', margin: '0 0 8px 0' }}>{f.title}</h3>
              <p style={{ fontSize: '0.88rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 셀프 온보딩 위저드 폼 (SECTION #onboarding) ── */}
      <section id="onboarding" style={{ background: '#1e293b', borderTop: '1px solid #334155', padding: '70px 20px' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto', background: '#0f172a', borderRadius: '28px', padding: '40px 30px', border: '1px solid #334155', boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <span style={{ fontSize: '2.6rem' }}>📝</span>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#ffffff', margin: '10px 0 6px 0' }}>
              셀프 신규 명함 신청 & 온보딩
            </h2>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8', margin: 0 }}>
              원하는 명함 주소를 정하고 신청을 완료하면 즉시 생성됩니다.
            </p>
          </div>

          {/* 스텝 표시 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
            {[
              { num: 1, label: 'ID 선택' },
              { num: 2, label: '기본 정보' },
              { num: 3, label: '플랜 & 결제' },
            ].map(s => (
              <div key={s.num} style={{ flex: 1, textAlign: 'center' }}>
                <div
                  style={{
                    width: '36px', height: '36px', borderRadius: '50%', margin: '0 auto 6px',
                    background: step >= s.num ? '#2563eb' : '#334155',
                    color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.9rem',
                  }}
                >
                  {s.num}
                </div>
                <div style={{ fontSize: '0.78rem', color: step >= s.num ? '#60a5fa' : '#64748b', fontWeight: step === s.num ? 'bold' : 'normal' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* ════ STEP 1: 명함 ID ════ */}
          {step === 1 && (
            <div>
              <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', marginBottom: '6px', fontWeight: 'bold' }}>
                1. 사용하고 싶은 명함 주소(ID)
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '20px' }}>
                예: <code>aim-nc.vercel.app/<strong>myname</strong></code>
              </p>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '6px' }}>영문 소문자, 숫자, 하이픈(-)만 가능</label>
                <input
                  type="text"
                  placeholder="예: junho, prof_kim"
                  value={desiredId}
                  onChange={e => handleCheckId(e.target.value)}
                  style={darkInputStyle}
                />

                {/* 중복 결과 피드백 */}
                <div style={{ marginTop: '10px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  {checkingId && <span style={{ color: '#60a5fa' }}>🔎 사용 가능 여부 조회 중...</span>}
                  {!checkingId && idStatus === 'available' && (
                    <span style={{ color: '#4ade80' }}>✅ 사용 가능한 명함 주소입니다! (https://aim-nc.vercel.app/{desiredId})</span>
                  )}
                  {!checkingId && idStatus === 'taken' && (
                    <span style={{ color: '#f87171' }}>❌ 이미 사용 중인 명함 주소입니다. 다른 ID를 입력해 주세요.</span>
                  )}
                  {!checkingId && idStatus === 'invalid' && (
                    <span style={{ color: '#94a3b8' }}>2자 이상의 영문 소문자/숫자를 입력해 주세요.</span>
                  )}
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={idStatus !== 'available'}
                style={{
                  ...primaryBtnStyle,
                  opacity: idStatus === 'available' ? 1 : 0.5,
                  cursor: idStatus === 'available' ? 'pointer' : 'not-allowed',
                }}
              >
                다음 단계 (기본 정보 입력) →
              </button>
            </div>
          )}

          {/* ════ STEP 2: 기본 정보 ════ */}
          {step === 2 && (
            <div>
              <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', marginBottom: '16px', fontWeight: 'bold' }}>
                2. 프로필 기본 정보를 입력하세요
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                <div>
                  <label style={darkLabelStyle}>성함 *</label>
                  <input
                    type="text"
                    placeholder="예: 홍길동"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    style={darkInputStyle}
                  />
                </div>
                <div>
                  <label style={darkLabelStyle}>소속 및 직함 *</label>
                  <input
                    type="text"
                    placeholder="예: 한국대학교 인공지능연구소 연구원"
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    style={darkInputStyle}
                  />
                </div>
                <div>
                  <label style={darkLabelStyle}>이메일 주소 (관리자 로그인용) *</label>
                  <input
                    type="email"
                    placeholder="name@domain.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    style={darkInputStyle}
                  />
                </div>
                <div>
                  <label style={darkLabelStyle}>휴대폰 번호</label>
                  <input
                    type="text"
                    placeholder="010-0000-0000"
                    value={formData.mobile}
                    onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                    style={darkInputStyle}
                  />
                </div>
                <div>
                  <label style={darkLabelStyle}>한 줄 소개</label>
                  <textarea
                    placeholder="간단한 소속이나 인삿말을 적어주세요."
                    value={formData.intro}
                    onChange={e => setFormData({ ...formData, intro: e.target.value })}
                    style={{ ...darkInputStyle, height: '70px', resize: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setStep(1)} style={{ ...darkSecondaryBtn, flex: 1 }}>← 이전</button>
                <button
                  onClick={() => {
                    if (!formData.name || !formData.email) return alert('성함과 이메일을 입력해 주세요.');
                    setStep(3);
                  }}
                  style={{ ...primaryBtnStyle, flex: 2 }}
                >
                  다음 (플랜 선택) →
                </button>
              </div>
            </div>
          )}

          {/* ════ STEP 3: 플랜 & 결제 ════ */}
          {step === 3 && (
            <div>
              <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', marginBottom: '6px', fontWeight: 'bold' }}>
                3. 플랜을 선택하고 신청을 완료하세요
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '20px' }}>
                신청 명함 주소: <strong>https://aim-nc.vercel.app/{desiredId}</strong>
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                {PLAN_VARIANTS.map(p => (
                  <div
                    key={p.id}
                    onClick={() => handleProceedToPayment(p.id)}
                    style={{
                      border: p.popular ? '2px solid #3b82f6' : '1px solid #334155',
                      borderRadius: '16px',
                      padding: '16px 20px',
                      background: p.popular ? 'rgba(59, 130, 246, 0.1)' : '#1e293b',
                      cursor: 'pointer',
                      display: 'flex',
                      justify: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '1.05rem', color: '#f8fafc' }}>{p.name}</strong>
                        <span style={{ fontSize: '0.72rem', background: '#3b82f6', color: 'white', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                          {p.badge}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>{p.tokens}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: '900', color: '#4ade80' }}>{p.price}</div>
                      <div style={{ fontSize: '0.78rem', color: '#60a5fa', fontWeight: 'bold', marginTop: '2px' }}>신청하기 →</div>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={() => setStep(2)} style={{ ...darkSecondaryBtn, width: '100%' }}>← 이전 (기본 정보 수정)</button>
            </div>
          )}

        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid #334155', textAlign: 'center', padding: '30px 20px', color: '#64748b', fontSize: '0.82rem' }}>
        © 2026 AIM Electronic Business Card Platform. All rights reserved.
      </footer>
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = { width: '100%', padding: '14px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' };
const darkSecondaryBtn: React.CSSProperties = { padding: '14px 20px', background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: '14px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem' };
const darkInputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', boxSizing: 'border-box', fontSize: '0.92rem', color: 'white' };
const darkLabelStyle: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#94a3b8', marginBottom: '4px' };
