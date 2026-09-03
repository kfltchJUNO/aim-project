// app/setup/page.tsx
"use client";

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const PLAN_VARIANTS = [
  { id: '2088337', name: '베이직 플랜', price: '30,000원', tokens: '0 토큰 (기본 명함 기능)', badge: '입문용' },
  { id: '2088339', name: '스마트 플랜 A', price: '45,000원', tokens: '1,000 토큰 (AI 챗봇 포함)', badge: '인기' },
  { id: '2088349', name: '스마트 플랜 B', price: '55,000원', tokens: '3,000 토큰 (AI 챗봇 + 퀴즈)', badge: '추천' },
  { id: '2088350', name: '스마트 플랜 C', price: '65,000원', tokens: '5,000 토큰 (여유로운 AI 사용)', badge: '고성능' },
  { id: '2088352', name: '스마트 메가 플랜', price: '90,000원', tokens: '10,000 토큰 (대용량 사용)', badge: 'VIP' },
];

export default function OnboardingPage() {
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
      alert('사용 가능한 명함 ID를 먼저 확인해 주세요.');
      setStep(1);
      return;
    }
    if (!formData.name || !formData.email) {
      alert('성함과 이메일 주소를 입력해 주세요.');
      setStep(2);
      return;
    }

    // 레몬 스퀴지 Checkout 파라미터 자동 바인딩
    const checkoutUrl = `https://store.lemonsqueezy.com/checkout/buy/${variantId}?checkout[custom][username]=${encodeURIComponent(desiredId)}&checkout[email]=${encodeURIComponent(formData.email)}`;
    window.open(checkoutUrl, '_blank');
  };

  return (
    <div style={{ background: '#f5f7fa', minHeight: '100vh', padding: '40px 20px 80px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '540px', margin: '0 auto', background: 'white', borderRadius: '24px', padding: '36px 28px', boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>

        {/* ── 헤더 ── */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span style={{ fontSize: '2.5rem' }}>🚀</span>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#1a237e', margin: '8px 0 4px 0' }}>
            나만의 AI 전자명함 신청
          </h1>
          <p style={{ fontSize: '0.9rem', color: '#666', margin: 0 }}>
            원하는 명함 주소를 정하고 신청을 완료해보세요.
          </p>
        </div>

        {/* ── 스텝 바 ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', position: 'relative' }}>
          {[
            { num: 1, label: 'ID 선택' },
            { num: 2, label: '기본 정보' },
            { num: 3, label: '플랜 & 결제' },
          ].map(s => (
            <div key={s.num} style={{ flex: 1, textAlign: 'center', zIndex: 1 }}>
              <div
                style={{
                  width: '36px', height: '36px', borderRadius: '50%', margin: '0 auto 6px',
                  background: step >= s.num ? '#1a237e' : '#e0e0e0',
                  color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.9rem',
                }}
              >
                {s.num}
              </div>
              <div style={{ fontSize: '0.78rem', color: step >= s.num ? '#1a237e' : '#999', fontWeight: step === s.num ? 'bold' : 'normal' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* ════════ STEP 1: 명함 ID ════════ */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: '1.15rem', color: '#333', marginBottom: '8px', fontWeight: 'bold' }}>
              1. 사용하고 싶은 명함 주소(ID)를 정해주세요
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '20px' }}>
              예: <code>aim-nc.vercel.app/<strong>myname</strong></code>
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>영문 소문자, 숫자, 하이픈(-) 사용 가능</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <input
                  type="text"
                  placeholder="예: junho, professor_kim"
                  value={desiredId}
                  onChange={e => handleCheckId(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>

              {/* 중복 확인 결과 피드백 */}
              <div style={{ marginTop: '10px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                {checkingId && <span style={{ color: '#0288d1' }}>🔎 중복 확인 중...</span>}
                {!checkingId && idStatus === 'available' && (
                  <span style={{ color: '#2e7d32' }}>✅ 사용 가능한 명함 주소입니다! (https://aim-nc.vercel.app/{desiredId})</span>
                )}
                {!checkingId && idStatus === 'taken' && (
                  <span style={{ color: '#c62828' }}>❌ 이미 존재하는 명함 주소입니다. 다른 ID를 입력해 주세요.</span>
                )}
                {!checkingId && idStatus === 'invalid' && (
                  <span style={{ color: '#888' }}>2자 이상의 영문 소문자/숫자를 입력해 주세요.</span>
                )}
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={idStatus !== 'available'}
              style={{
                ...primaryBtn,
                width: '100%',
                opacity: idStatus === 'available' ? 1 : 0.5,
                cursor: idStatus === 'available' ? 'pointer' : 'not-allowed',
              }}
            >
              다음 (기본 정보 입력) →
            </button>
          </div>
        )}

        {/* ════════ STEP 2: 기본 정보 ════════ */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: '1.15rem', color: '#333', marginBottom: '16px', fontWeight: 'bold' }}>
              2. 프로필 기본 정보를 입력해 주세요
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              <div>
                <label style={labelStyle}>성함 *</label>
                <input
                  type="text"
                  placeholder="예: 홍길동"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>소속 및 직함 *</label>
                <input
                  type="text"
                  placeholder="예: 한국대학교 인공지능연구소 연구원"
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>이메일 주소 (관리자 로그인용) *</label>
                <input
                  type="email"
                  placeholder="name@domain.com"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>휴대폰 번호</label>
                <input
                  type="text"
                  placeholder="010-0000-0000"
                  value={formData.mobile}
                  onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>한 줄 소개</label>
                <textarea
                  placeholder="간단한 소속이나 인삿말을 적어주세요."
                  value={formData.intro}
                  onChange={e => setFormData({ ...formData, intro: e.target.value })}
                  style={{ ...inputStyle, height: '70px', resize: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep(1)} style={{ ...secondaryBtn, flex: 1 }}>← 이전</button>
              <button
                onClick={() => {
                  if (!formData.name || !formData.email) return alert('성함과 이메일을 입력해 주세요.');
                  setStep(3);
                }}
                style={{ ...primaryBtn, flex: 2 }}
              >
                다음 (플랜 선택) →
              </button>
            </div>
          </div>
        )}

        {/* ════════ STEP 3: 플랜 & 결제 ════════ */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: '1.15rem', color: '#333', marginBottom: '8px', fontWeight: 'bold' }}>
              3. 플랜을 선택하고 정산을 완료하세요
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '20px' }}>
              결제 완료 시 명함 주소(<strong>{desiredId}</strong>)가 즉시 세팅됩니다.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {PLAN_VARIANTS.map(p => (
                <div
                  key={p.id}
                  onClick={() => handleProceedToPayment(p.id)}
                  style={{
                    border: '2px solid #e3f2fd',
                    borderRadius: '16px',
                    padding: '16px 20px',
                    background: '#fbfcfd',
                    cursor: 'pointer',
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '1.05rem', color: '#1a237e' }}>{p.name}</strong>
                      <span style={{ fontSize: '0.72rem', background: '#e3f2fd', color: '#1565c0', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                        {p.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#666', marginTop: '4px' }}>{p.tokens}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: '900', color: '#2e7d32' }}>{p.price}</div>
                    <div style={{ fontSize: '0.78rem', color: '#1a237e', fontWeight: 'bold', marginTop: '2px' }}>결제하기 →</div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setStep(2)} style={{ ...secondaryBtn, width: '100%' }}>← 이전 (기본 정보 수정)</button>
          </div>
        )}

      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = { padding: '14px 20px', background: '#1a237e', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' };
const secondaryBtn: React.CSSProperties = { padding: '14px 20px', background: '#f5f5f5', color: '#333', border: '1px solid #ddd', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '10px', boxSizing: 'border-box', fontSize: '0.92rem' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#555', marginBottom: '4px' };