// app/api/lemonsqueezy-webhook/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/firebase';
import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';

// Lemon Squeezy Variant ID → 지급할 토큰 수 매핑
export const VARIANT_TOKEN_MAP: Record<string, number> = {
  '2088337': 0,     // 베이직 플랜 (명함 생성 1회 결제)
  '2088339': 1000,  // 스마트 플랜 A (1,000 토큰)
  '2088349': 3000,  // 스마트 플랜 B (3,000 토큰)
  '2088350': 5000,  // 스마트 플랜 C (5,000 토큰)
  '2088352': 10000, // 스마트 플랜 메가 (10,000 토큰)
};

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-signature');
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

    // 1. 보안 검증: HMAC-SHA256 서명 확인 (Secret 설정 시)
    if (secret && signature) {
      const hmac = crypto.createHmac('sha256', secret);
      const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
      const signatureBuffer = Buffer.from(signature, 'utf8');

      if (digest.length !== signatureBuffer.length || !crypto.timingSafeEqual(digest, signatureBuffer)) {
        console.error('Lemon Squeezy Webhook: Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);
    const eventName = payload.meta?.event_name;

    console.log('Lemon Squeezy Webhook Payload:', JSON.stringify(payload, null, 2));

    // 2. 주문 완료(order_created) 이벤트만 처리
    if (eventName !== 'order_created') {
      return NextResponse.json({ message: `Ignored event: ${eventName}` }, { status: 200 });
    }

    const firstOrderItem = payload.data?.attributes?.first_order_item;
    const variantId = String(firstOrderItem?.variant_id || '');
    const variantName = String(firstOrderItem?.variant_name || '');
    const orderTotal = payload.data?.attributes?.total || 0;

    // Variant ID로 토큰 수 매핑 (Variant ID 없으면 Variant Name 매핑 시도)
    const tokenAmount = VARIANT_TOKEN_MAP[variantId] ?? VARIANT_TOKEN_MAP[variantName] ?? 0;

    // 3. 사용자 식별자(username / card_id) 추출
    const customData = payload.meta?.custom_data || {};
    const username = customData.username || customData.card_id || customData.user_id || customData.cardId;

    if (!username) {
      console.error('Lemon Squeezy Webhook: Missing username in custom_data', customData);
      return NextResponse.json({ error: 'Missing username in custom_data' }, { status: 400 });
    }

    // 4. Firestore 토큰 및 누적 결제 금액 업데이트 (트랜잭션)
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', username);
      const userDoc = await transaction.get(userRef);

      const customerEmail = payload.data?.attributes?.user_email || customData.email || '';
      const customerName = payload.data?.attributes?.user_name || customData.name || username;

      // 센트/원 단위 결제금액 환산 (USD 100 = $1.00)
      const paidAmount = typeof orderTotal === 'number' ? Math.round(orderTotal / 100) : 0;

      if (!userDoc.exists()) {
        // 유저 문서가 없으면 셀프 온보딩 자동 생성을 통해 신규 명함 및 템플릿 생성
        transaction.set(userRef, {
          name: customerName,
          role: '전문가 / 연구원',
          intro: '반갑습니다! AI 디지털 명함입니다.',
          owner_email: customerEmail,
          credits: tokenAmount,
          paidTotal: paidAmount,
          isActive: true,
          aiEnabled: true,
          chatbotEnabled: true,
          translationEnabled: true,
          quizEnabled: true,
          synergyEnabled: true,
          links: [],
          history: [],
          projects: [],
          custom_sections: [],
          custom_knowledge: [],
          createdAt: serverTimestamp(),
        });
      } else {
        const userData = userDoc.data();
        const currentCredits = userData.credits || 0;
        const currentPaidTotal = userData.paidTotal || 0;

        transaction.update(userRef, {
          credits: currentCredits + tokenAmount,
          paidTotal: currentPaidTotal + paidAmount,
        });
      }

      const logRef = doc(collection(db, 'users', username, 'logs'));
      transaction.set(logRef, {
        type: '충전(LemonSqueezy)',
        amount: tokenAmount,
        reason: `Lemon Squeezy 결제 (Order ID: ${payload.data?.id || 'N/A'}, Variant: ${variantName || variantId})`,
        date: serverTimestamp(),
      });
    });

    return NextResponse.json({
      ok: true,
      message: `Successfully credited ${tokenAmount} tokens to ${username}`,
    });
  } catch (error: any) {
    console.error('Lemon Squeezy Webhook Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
