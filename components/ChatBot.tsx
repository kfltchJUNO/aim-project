"use client";

import { useState, useRef, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';

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

  useEffect(() => {
    if (context) {
      setMessages([
        // 멘트 수정됨 (토큰 언급 삭제)
        { role: 'bot', text: `안녕하세요! ${ownerName}님의 AI 비서입니다. 무엇이든 물어봐 주세요. 😄` }
      ]);
    }
  }, [context, ownerName]);

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
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", username);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) throw new Error("사용자 정보를 찾을 수 없습니다.");
        
        const currentCredits = userDoc.data().credits || 0;
        if (currentCredits < 2) {
          throw new Error("토큰이 부족합니다.");
        }

        transaction.update(userRef, { credits: currentCredits - 2 });
        
        const newLogRef = doc(collection(db, "users", username, "logs"));
        transaction.set(newLogRef, {
          type: '사용',
          amount: -2,
          reason: 'AI 챗봇 대화',
          date: serverTimestamp()
        });
      });

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          context: context,
          mode: 'chat'
        }),
      });

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'bot', text: data.reply }]);

    } catch (error: any) {
      console.error(error);
      let errorMsg = "오류가 발생했습니다.";
      // 에러 메시지에서도 토큰 부족 시 '서비스 점검' 등으로 돌려 말하기
      if (error.message === "토큰이 부족합니다.") errorMsg = "현재 AI 서비스가 잠시 중단되었습니다. (Limit Reached)";
      setMessages(prev => [...prev, { role: 'bot', text: errorMsg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      handleSend();
    }
  };

  return (
    <>
      {!isOpen && (
        <button 
            onClick={() => setIsOpen(true)} 
            style={{
                position:'fixed', bottom:'20px', right:'20px', 
                width:'60px', height:'60px', borderRadius:'50%', 
                background:'#1a237e', color:'white', border:'none', 
                fontSize:'30px', zIndex:1000, cursor:'pointer',
                boxShadow:'0 4px 12px rgba(0,0,0,0.3)'
            }}>
            💬
        </button>
      )}

      {isOpen && (
        <div style={{
            position:'fixed', bottom:'20px', right:'20px', 
            width:'350px', height:'500px', background:'white', 
            borderRadius:'20px', border:'1px solid #ddd', 
            display:'flex', flexDirection:'column', zIndex:1001, 
            boxShadow:'0 10px 30px rgba(0,0,0,0.2)', overflow:'hidden'
        }}>
          {/* 헤더 멘트 수정됨 (토큰 언급 삭제) */}
          <div style={{padding:'15px', background:'#1a237e', color:'white', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <span style={{fontWeight:'bold'}}>🤖 AI 비서</span>
            <button onClick={()=>setIsOpen(false)} style={{background:'none', border:'none', color:'white', fontSize:'1.2rem', cursor:'pointer'}}>×</button>
          </div>

          <div ref={scrollRef} style={{flex:1, padding:'15px', overflowY:'auto', background:'#f5f5f5'}}>
            {messages.map((m, i) => (
              <div key={i} style={{textAlign: m.role==='user'?'right':'left', marginBottom:'10px'}}>
                <span style={{
                    background: m.role==='user'?'#1a237e':'white', 
                    color: m.role==='user'?'white':'#333', 
                    padding:'8px 12px', borderRadius:'15px', 
                    display:'inline-block', maxWidth:'80%', 
                    wordBreak:'break-word', boxShadow:'0 1px 3px rgba(0,0,0,0.1)',
                    fontSize:'0.9rem', lineHeight:'1.4'
                }}>
                    {m.text}
                </span>
              </div>
            ))}
            {loading && <div style={{color:'#999', fontSize:'0.8rem', marginLeft:'10px'}}>입력 중... ✍️</div>}
          </div>

          <div style={{padding:'10px', display:'flex', borderTop:'1px solid #eee', background:'white'}}>
            <input 
                value={input} 
                onChange={e=>setInput(e.target.value)} 
                onKeyDown={handleKeyDown}
                style={{flex:1, padding:'10px', border:'1px solid #ddd', borderRadius:'20px', outline:'none'}} 
                placeholder="질문하기..."
                disabled={loading}
            />
            <button 
                onClick={handleSend} 
                disabled={loading}
                style={{
                    marginLeft:'8px', padding:'0 15px', 
                    background: loading ? '#ccc' : '#1a237e', 
                    color:'white', border:'none', borderRadius:'20px', 
                    cursor: loading ? 'not-allowed' : 'pointer'
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