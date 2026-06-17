// app/setup/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'firebase/auth';

// ▼▼▼ [1] 아래 빈 칸을 채워주세요 ▼▼▼
const CLIENT_DATA = {
  // 1. 기본 정보
  name: "",            // 예: 홍길동
  role: "",            // 예: 한국어 강사
  intro: "",           // 예: 안녕하세요...
  owner_email: "",     // 예: hong@gmail.com (나중에 수정 권한 가질 사람)
  
  // 2. 설정
  credits: 50,                           // 베이직 기본 무료 토큰 (대화 약 25회 분량)
                                          // ※ 스마트 플랜(A/B/C/메가) 구매 고객이면 50 + 구매한 토큰 수를 더해서 입력하세요
                                          //   예: 스마트 B(3,000토큰) 구매 → credits: 3050
  profile_img: "https://placehold.co/150", // 프로필 이미지 주소 (없으면 이대로)
  
  // 3. AI 학습용 데이터 (TMI)
  // * AI가 이 내용을 바탕으로 대답합니다. 줄바꿈하며 자유롭게 적으세요.
  tmi_data: `
  
  `,

  // 4. 이력 / 경력 (필요한 만큼 {} 복사해서 늘리세요)
  history: [
    { date: "", title: "", desc: "" },
    { date: "", title: "", desc: "" },
  ],

  // 5. 자격증
  certifications: [
    { title: "", desc: "" },
  ],

  // 6. 수상 경력
  awards: [
    { title: "", desc: "" },
  ],
  
  // 7. 연구 실적 (없으면 비워두세요)
  research: []
};
// ▲▲▲ [1] 입력 끝 ▲▲▲


// ▼▼▼ [2] 생성할 명함의 ID (주소창에 들어갈 영어 이름) ▼▼▼
const CLIENT_ID = "sample"; 


export default function SetupPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  const handleLogin = async () => await signInWithPopup(auth, new GoogleAuthProvider());

  const handleSetup = async () => {
    if (!user) return alert("관리자 로그인이 필요합니다.");
    
    // 데이터가 비어있으면 경고
    if (!CLIENT_DATA.name) return alert("이름을 입력해주세요!");

    if (!confirm(`'${CLIENT_ID}' 명함을 생성하시겠습니까?`)) return;
    setLoading(true);
    
    try {
      await setDoc(doc(db, "users", CLIENT_ID), CLIENT_DATA);
      alert(`✅ 생성 완료! \nhttp://localhost:3000/${CLIENT_ID} 로 이동합니다.`);
      window.open(`/${CLIENT_ID}`, '_blank');
    } catch (e: any) {
      alert("실패: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{height:'100vh', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', background:'#f0f2f5', gap:'20px'}}>
      <h1 style={{fontSize:'2rem'}}>🏭 명함 제작소 (빈 서식)</h1>
      
      <div style={{background:'white', padding:'40px', borderRadius:'15px', boxShadow:'0 5px 20px rgba(0,0,0,0.1)', textAlign:'center', width:'450px'}}>
        <div style={{marginBottom:'20px', textAlign:'left', background:'#f9f9f9', padding:'15px', borderRadius:'10px', fontSize:'0.9rem'}}>
            <p><strong>생성될 ID:</strong> <span style={{color:'red', fontWeight:'bold'}}>{CLIENT_ID}</span></p>
            <p><strong>이름:</strong> {CLIENT_DATA.name || "(비어있음)"}</p>
        </div>
        
        {user ? (
          <button 
              onClick={handleSetup} 
              disabled={loading}
              style={{
                  width: '100%', padding: '15px', background: '#2979ff', color: 'white', 
                  border: 'none', borderRadius: '10px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer'
              }}
          >
              {loading ? "데이터 입력 중... 💾" : "🚀 명함 생성하기"}
          </button>
        ) : (
          <button 
            onClick={handleLogin}
            style={{
                width: '100%', padding: '15px', background: '#333', color: 'white', 
                border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer'
            }}
          >
            🔒 관리자 로그인
          </button>
        )}
      </div>
    </div>
  );
}