// app/api/seed-kang/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export const KANG_SAMPLE_DATA = {
  name: '강철민',
  role: '체형 교정 & 스포츠 데이터 피트니스 트레이너',
  intro: '안녕하세요! 12년 차 퍼스널 트레이너이자 스포츠 의학 기반 체형 교정 전문가 강철민입니다. 1:1 체형 분석 및 근골격 재활 트레이닝을 진행합니다.',
  owner_email: 'kang@sample.com',
  profile_img: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&auto=format&fit=crop&q=80',
  cover_img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80',
  avatar_shape: 'rounded',
  credits: 3000,
  paidTotal: 55000,
  isActive: true,
  aiEnabled: true,
  chatbotEnabled: true,
  translationEnabled: true,
  quizEnabled: true,
  synergyEnabled: true,
  ownerMbti: 'ESTJ',
  ai_prompt: '너는 12년 차 퍼스널 트레이너 강철민 팀장의 AI 비서야. 방문자에게 체형 교정 팁, 식단 관리 노하우, P.T 수업 상담을 친절하고 열정적으로 안내해줘.',
  custom_knowledge: [
    '강철민 트레이너는 생활스포츠지도사 1급 및 NASM-CPT(미국스포츠의학회) 국제 자격증을 보유하고 있습니다.',
    '1:1 체형 교정 및 근골격 재활 P.T 전문으로 500명 이상의 비포애프터 성공 사례가 있습니다.',
    '수업 장소: 강남 메디컬 피트니스 센터 (무료 주차 가능, 상담 문의는 1:1 연락처 참조).',
    '식단 관리는 무작정 굶는 다이어트가 아닌 개인 기초대사량 기반 맞춤 영양 설계를 제공합니다.',
  ],
  links: [
    { type: 'mobile', label: '전화 상담', value: '010-9876-5432' },
    { type: 'email', label: '이메일 문의', value: 'kang_pt@fitness.com' },
    { type: 'insta', label: '인스타그램', value: 'https://instagram.com' },
    { type: 'youtube', label: '피트니스 유튜브', value: 'https://youtube.com' },
  ],
  history: [
    { date: '2020~현재', title: '메디컬 피트니스 센터 수석 팀장', desc: '1:1 재활 피트니스 및 체형 교정 센터 전담 운영' },
    { date: '2016~2020', title: '스포츠 선수단 트레이닝 분과 팀장', desc: '선수단 근골격 재활 트레이닝 및 피트니스 파트 담당' },
    { date: '2014', title: '체육학 석사 학위 취득', desc: '스포츠 의학 및 운동 생리학 전공' },
  ],
  projects: [
    { title: '거북목 & 굽은등 4주 개선 챌린지', desc: '현대인을 위한 10분 셀프 스트레칭 및 골격 교정 가이드북 집필' },
    { title: '바디프로필 90일 성공 프로젝트', desc: '체지방률 8% 달성 1:1 밀착 식단 및 고강도 피트니스 클래스' },
  ],
  custom_sections: [
    {
      id: 'pt_info',
      title: '🏋️ P.T 프로그램 안내',
      items: [
        { title: '1:1 재활 & 체형 교정 P.T', desc: '체형 측정 분석 후 통증 완화 및 균형 잡힌 골격 교정 훈련' },
        { title: '단기 체지방 감량 바디프로필반', desc: '개인 맞춤 영양 식단표 제공 및 개별 운동 일지 밀착 케어' },
      ],
    },
  ],
  updatedAt: serverTimestamp(),
};

export async function GET() {
  try {
    await setDoc(doc(db, 'users', 'kang'), KANG_SAMPLE_DATA, { merge: true });
    return NextResponse.json({ ok: true, message: 'Successfully seeded /kang card data in Firestore!' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
