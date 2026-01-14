// components/ChatBot.tsx
"use client";

import { useState, useRef, useEffect } from 'react';

type Props = {
  context: any; 
  username: string; 
};

export default function ChatBot({ context, username }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: string, text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ownerName = context?.name || '명함 주인';

  // 초기 메시지 설정
  useEffect(() => {
    if (context && messages.length === 0) {
      setMessages([
        { role: 'bot', text: `안녕하세요! ${ownerName}님의 AI 비서입니다. 무엇이든 물어봐 주세요. 😄` }
      ]);
    }
  }, [context, ownerName, messages.length]);

  // 스크롤 자동 내리기
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
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
        body: JSON.stringify({
          message: userMsg,
          context: context,
          username: username,
          mode: 'chat'
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'bot', text: data.reply || "죄송합니다. 오류가 발생했습니다." }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', text: "네트워크 오류가 발생했습니다." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* 1. 둥둥 떠있는 버튼 (플로팅 버튼) - 디자인 개선 */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed', 
            bottom: '25px', 
            right: '25px',
            width: '60px', 
            height: '60px', 
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #1a237e 0%, #3949ab 100%)', // 고급스러운 그라데이션
            color: 'white', 
            border: 'none', 
            fontSize: '28px',
            boxShadow: '0 6px 20px rgba(26, 35, 126, 0.4)', // 부드러운 그림자
            cursor: 'pointer', 
            zIndex: 1000,
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            transition: 'transform 0.2s ease', // 눌렀을 때 애니메이션 효과용 (CSS hover 시)
          }}
          aria-label="AI 챗봇 열기"
        >
          💬
        </button>
      )}

      {/* 2. 채팅창 본문 */}
      {isOpen && (
        <div style={{
          position: 'fixed', 
          bottom: '25px', 
          right: '25px',
          width: '340px', 
          height: '520px', 
          maxWidth: 'calc(100vw - 50px)', // 모바일 대응
          background: 'white',
          borderRadius: '20px', 
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden', 
          zIndex: 1001,
          border: '1px solid #eee'
        }}>
          {/* 헤더 */}
          <div style={{
            padding: '18px', 
            background: '#1a237e', 
            color: 'white',
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            fontWeight: 'bold'
          }}>
            <span style={{display:'flex', alignItems:'center', gap:'8px'}}>🤖 AI 비서 <span style={{fontSize:'0.7rem', opacity:0.8, fontWeight:'normal'}}>(2토큰/건)</span></span>
            <button onClick={() => setIsOpen(false)} style={{background:'none', border:'none', color:'white', fontSize:'1.4rem', cursor:'pointer', padding:'0 5px'}}>×</button>
          </div>

          {/* 메시지 영역 */}
          <div ref={scrollRef} style={{flex: 1, padding: '15px', overflowY: 'auto', background: '#f8f9fa'}}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{
                marginBottom: '12px',
                textAlign: msg.role === 'user' ? 'right' : 'left'
              }}>
                <div style={{
                  display: 'inline-block',
                  padding: '10px 15px',
                  borderRadius: '18px',
                  borderTopRightRadius: msg.role === 'user' ? '4px' : '18px',
                  borderTopLeftRadius: msg.role === 'bot' ? '4px' : '18px',
                  background: msg.role === 'user' ? '#1a237e' : 'white',
                  color: msg.role === 'user' ? 'white' : '#333',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  maxWidth: '85%',
                  wordBreak: 'break-word',
                  fontSize: '0.95rem',
                  lineHeight: '1.5'
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && <div style={{textAlign:'left', color:'#888', fontSize:'0.8rem', marginLeft:'10px', marginTop:'5px'}}>AI가 답변을 작성 중입니다... ✍️</div>}
          </div>

          {/* 입력 영역 */}
          <div style={{padding: '12px', background: 'white', borderTop: '1px solid #eee', display: 'flex', gap:'8px'}}>
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSend()}
              placeholder="궁금한 점을 물어보세요..."
              style={{flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: '25px', outline: 'none', fontSize:'0.95rem'}}
            />
            <button 
              onClick={handleSend}
              disabled={loading}
              style={{
                padding: '0 20px', borderRadius: '25px',
                border: 'none', background: loading ? '#ccc' : '#1a237e', color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer', fontWeight:'bold'
              }}
            >
              전송
            </button>
          </div>
        </div>
      )}
    </>
  );
}