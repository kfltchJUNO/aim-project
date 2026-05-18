// components/ChatBot.tsx
"use client";

import { useState, useRef, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { getDoc, doc } from 'firebase/firestore';

type Props = {
  context: any;
  username: string;
  themeColor?: string;
};

export default function ChatBot({ context, username, themeColor = '#1a237e' }: Props) {
  const [isOpen, setIsOpen]     = useState(false);
  const [input, setInput]       = useState('');
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [loading, setLoading]   = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ownerName = context?.name || '명함 주인';

  useEffect(() => {
    if (context && messages.length === 0) {
      const initMessages = async () => {
        const msgs: { role: string; text: string }[] = [];
        try {
          const noticeSnap = await getDoc(doc(db, 'settings', 'notice'));
          if (noticeSnap.exists() && noticeSnap.data().isActive && noticeSnap.data().text) {
            msgs.push({ role: 'bot', text: `📢 ${noticeSnap.data().text}` });
          }
        } catch (_) {}
        msgs.push({ role: 'bot', text: `안녕하세요! ${ownerName}님의 AI 비서입니다. 무엇이든 물어봐 주세요. 😄` });
        setMessages(msgs);
      };
      initMessages();
    }
  }, [context, ownerName, messages.length]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, context, username, mode: 'chat' }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'bot', text: data.reply || data.error || '오류가 발생했습니다.' }]);
    } catch (_) {
      setMessages(prev => [...prev, { role: 'bot', text: '네트워크 오류' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* 플로팅 버튼 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 30px)',
            right: 'calc(env(safe-area-inset-right, 0px) + 20px)',
            width: '60px', height: '60px', borderRadius: '50%',
            background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}cc 100%)`,
            color: 'white', border: 'none', fontSize: '28px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)', cursor: 'pointer', zIndex: 999999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: 'translateZ(0)', WebkitTapHighlightColor: 'transparent',
          }}
        >
          💬
        </button>
      )}

      {/* 채팅창 */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
          right: 'calc(env(safe-area-inset-right, 0px) + 20px)',
          width: '340px', height: '500px',
          maxWidth: 'calc(100vw - 40px)',
          maxHeight: 'calc(100vh - env(safe-area-inset-bottom, 0px) - 40px)',
          background: 'white', borderRadius: '20px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', zIndex: 999999,
          border: '1px solid #eee', transform: 'translateZ(0)',
        }}>
          {/* 헤더 */}
          <div style={{ padding: '15px', background: themeColor, color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>🤖 AI 비서</span>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.4rem', cursor: 'pointer', padding: '0 5px' }}>×</button>
          </div>

          {/* 메시지 영역 */}
          <div ref={scrollRef} style={{ flex: 1, padding: '15px', overflowY: 'auto', background: '#f8f9fa', WebkitOverflowScrolling: 'touch' as any }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ marginBottom: '12px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                <div style={{
                  display: 'inline-block', padding: '10px 14px', borderRadius: '16px',
                  borderTopRightRadius: msg.role === 'user' ? '4px' : '16px',
                  borderTopLeftRadius:  msg.role === 'bot'  ? '4px' : '16px',
                  background: msg.role === 'user' ? themeColor : 'white',
                  color: msg.role === 'user' ? 'white' : '#333',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  maxWidth: '85%', wordBreak: 'break-word', fontSize: '0.95rem', lineHeight: '1.4',
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && <div style={{ textAlign: 'left', color: '#888', fontSize: '0.8rem', marginLeft: '10px', marginTop: '5px' }}>AI가 생각 중... ✍️</div>}
          </div>

          {/* 입력 영역 */}
          <div style={{ padding: '10px', background: 'white', borderTop: '1px solid #eee', display: 'flex', gap: '8px' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSend()}
              placeholder="질문하기..."
              style={{ flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: '25px', outline: 'none', fontSize: '16px' }}
            />
            <button
              onClick={handleSend}
              disabled={loading}
              style={{ padding: '0 15px', borderRadius: '25px', border: 'none', background: loading ? '#ccc' : themeColor, color: 'white', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.9rem', minWidth: '60px' }}
            >
              전송
            </button>
          </div>
        </div>
      )}
    </>
  );
}