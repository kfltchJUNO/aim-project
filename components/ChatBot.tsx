// components/ChatBot.tsx
"use client";
import { useState, useRef, useEffect } from 'react';

export default function ChatBot({ userData }: { userData: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: string, text: string }[]>([
    { role: 'bot', text: `안녕하세요! ${userData.name}님의 AI 비서입니다. 무엇이든 물어봐 주세요. 😄` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 스크롤 자동 내리기
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, context: userData })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'bot', text: data.reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'bot', text: "오류가 발생했습니다. 잠시 후 다시 시도해주세요." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* 1. 플로팅 버튼 (우측 하단) */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed', bottom: '30px', right: '30px',
          width: '60px', height: '60px', borderRadius: '50%',
          backgroundColor: '#1a237e', color: 'white', border: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontSize: '30px', cursor: 'pointer', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* 2. 채팅 창 */}
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: '100px', right: '30px',
          width: '350px', height: '500px', backgroundColor: 'white',
          borderRadius: '20px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 1000,
          border: '1px solid #eee'
        }}>
          {/* 헤더 */}
          <div style={{ padding: '15px', background: '#1a237e', color: 'white', fontWeight: 'bold' }}>
            🤖 AI 비서 (Beta)
          </div>

          {/* 메시지 영역 */}
          <div style={{ flex: 1, padding: '15px', overflowY: 'auto', background: '#f8f9fa' }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '10px'
              }}>
                <div style={{
                  maxWidth: '80%', padding: '10px 14px', borderRadius: '14px', fontSize: '0.9rem',
                  backgroundColor: m.role === 'user' ? '#1a237e' : 'white',
                  color: m.role === 'user' ? 'white' : '#333',
                  boxShadow: m.role === 'bot' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none',
                  borderTopLeftRadius: m.role === 'bot' ? '2px' : '14px',
                  borderTopRightRadius: m.role === 'user' ? '2px' : '14px'
                }}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && <div style={{ fontSize: '0.8rem', color: '#999', textAlign: 'center' }}>AI가 생각 중입니다...</div>}
            <div ref={messagesEndRef} />
          </div>

          {/* 입력창 */}
          <div style={{ padding: '10px', borderTop: '1px solid #eee', display: 'flex', gap: '5px' }}>
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="질문을 입력하세요..."
              style={{ flex: 1, padding: '10px', borderRadius: '20px', border: '1px solid #ddd', outline: 'none' }}
            />
            <button onClick={sendMessage} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>🚀</button>
          </div>
        </div>
      )}
    </>
  );
}