// app/[username]/page.tsx
import { Metadata } from 'next';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import NameCardClient from './NameCardClient';

type Props = {
  params: { username: string };
};

// 동적 OpenGraph (OG) 및 Twitter 메타 태그 생성 (서버 사이드)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const docRef = doc(db, 'users', params.username);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return {
        title: '명함을 찾을 수 없습니다 - AIM',
        description: '존재하지 않는 명함 프로필입니다.',
      };
    }

    const data = docSnap.data();
    const name = data.name || params.username;
    const role = data.role || '전자명함';
    const title = `${name} | ${role}`;
    const description = data.intro || `${name}님의 AIM 전자명함입니다.`;
    const imageUrl = data.profile_img || 'https://aim-nc.vercel.app/profile_default.jpg';
    const cardUrl = `https://aim-nc.vercel.app/${params.username}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: cardUrl,
        siteName: 'AIM 전자명함',
        images: [
          {
            url: imageUrl,
            width: 800,
            height: 800,
            alt: `${name} 프로필 이미지`,
          },
        ],
        type: 'profile',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [imageUrl],
      },
    };
  } catch (_) {
    return {
      title: 'AIM 전자명함',
      description: '다중 사용자 지원 전자명함 플랫폼 AIM',
    };
  }
}

import { KANG_SAMPLE_DATA } from '@/app/api/seed-kang/route';

export default async function NameCardPage({ params }: Props) {
  let initialData = null;
  try {
    const docRef = doc(db, 'users', params.username);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      initialData = docSnap.data();
    } else if (params.username === 'kang') {
      initialData = KANG_SAMPLE_DATA;
    }
  } catch (_) {
    if (params.username === 'kang') initialData = KANG_SAMPLE_DATA;
  }

  return <NameCardClient params={params} initialData={initialData} />;
}