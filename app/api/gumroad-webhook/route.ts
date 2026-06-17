// app/api/gumroad-webhook/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';

// Gumroad 상품 permalink → 지급할 토큰 수
// Gumroad 대시보드에서 상품 생성 후, 주소창의 짧은 코드(permalink)를 여기에 채워주세요.
// 예: https://gumroad.com/l/abcde → permalink는 'abcde'
const PRODUCT_TOKEN_MAP: Record<string, number> = {
  'REPLACE_WITH_PERMALINK_A':    1000,  // 15,000원
  'REPLACE_WITH_PERMALINK_B':    3000,  // 25,000원
  'REPLACE_WITH_PERMALINK_C':    5000,  // 35,000원
  'REPLACE_WITH_PERMALINK_MEGA': 10000, // 60,000원
};

// Gumroad 커스텀 필드에 입력받은 "명함 ID"가 webhook payload에서 어떤 키로 오는지는
// Gumroad 설정에 따라 달라집니다. 테스트 결제 1회 후 콘솔 로그를 확인해서
// 아래 CANDIDATE_USERNAME_KEYS에 실제 키 이름을 추가해주세요.
const CANDIDATE_USERNAME_KEYS = ['카드_id', 'card_id', 'username', 'url_params[card_id]'];

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const data: Record<string, string> = {};
    formData.forEach((value, key) => { data[key] = value.toString(); });

    // 디버깅용: 처음 연동할 때는 이 로그로 실제 payload 구조를 확인하세요.
    console.log('Gumroad webhook payload:', data);

    // 본인 Gumroad 계정에서 온 결제인지 확인 (스푸핑 방지)
    if (process.env.GUMROAD_SELLER_ID && data['seller_id'] !== process.env.GUMROAD_SELLER_ID) {
      return NextResponse.json({ error: 'invalid seller' }, { status: 403 });
    }

    const permalink = data['permalink'] || data['product_permalink'] || data['short_product_id'];
    const tokenAmount = permalink ? PRODUCT_TOKEN_MAP[permalink] : undefined;
    if (!tokenAmount) {
      console.error('Gumroad webhook: unknown product permalink ->', permalink);
      return NextResponse.json({ error: 'unknown product' }, { status: 400 });
    }

    let username: string | undefined;
    for (const key of CANDIDATE_USERNAME_KEYS) {
      if (data[key]) { username = data[key]; break; }
    }
    if (!username) {
      console.error('Gumroad webhook: username field not found in payload');
      return NextResponse.json({ error: 'missing username field' }, { status: 400 });
    }

    await runTransaction(db, async transaction => {
      const userRef = doc(db, 'users', username!);
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) throw new Error('user not found: ' + username);
      const current = userDoc.data().credits || 0;
      transaction.update(userRef, { credits: current + tokenAmount });
      const logRef = doc(collection(db, 'users', username!, 'logs'));
      transaction.set(logRef, {
        type: '충전(Gumroad)',
        amount: tokenAmount,
        reason: `Gumroad 결제 (sale_id: ${data['sale_id'] || '알수없음'})`,
        date: serverTimestamp(),
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Gumroad webhook error:', error);
    return NextResponse.json({ error: error.message || 'server error' }, { status: 500 });
  }
}