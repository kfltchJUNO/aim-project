// components/Guestbook.tsx
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { serverTimestamp } from 'firebase/firestore';

async function sha256(text: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

type Props = {
  username: string;
  themeColor?: string;
  isDark?: boolean;
};

export default function Guestbook({ username, themeColor = '#1a237e', isDark = false }: Props) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput]       = useState({ name: '', pw: '', text: '' });
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'guestbooks'),
      where('to_user', '==', username)
    );
    const unsubscribe = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.name || !input.pw || !input.text) { alert('모든 내용을 입력해주세요.'); return; }
    setLoading(true);
    try {
      const hashed = await sha256(input.pw);
      await addDoc(collection(db, 'guestbooks'), {
        to_user:  username,
        name:     input.name,
        password: hashed,
        content:  input.text,
        createdAt: serverTimestamp(),
      });
      setInput({ name: '', pw: '', text: '' });
    } catch (err) {
      alert('등록 실패: ' + err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, correctHashedPw: string) => {
    const userPw = prompt('삭제하려면 비밀번호를 입력하세요.');
    if (!userPw) return;
    const hashed = await sha256(userPw);
    if (hashed === correctHashedPw) {
      await deleteDoc(doc(db, 'guestbooks', id));
      alert('삭제되었습니다.');
    } else {
      alert('비밀번호가 틀렸습니다.');
    }
  };

  const bg      = isDark ? 'rgba(255,255,255,0.06)' : '#f8f9fa';
  const cardBg  = isDark ? 'rgba(255,255,255,0.1)' : 'white';
  const txtColor = isDark ? '#ffffff' : '#333';
  const borderC  = isDark ? 'rgba(255,255,255,0.15)' : '#ddd';

  const inputStyle: React.CSSProperties = {
    border: `1px solid ${borderC}`, padding: '8px', borderRadius: '8px',
    fontSize: '0.9rem', outline: 'none', flex: 1,
    background: isDark ? 'rgba(255,255,255,0.1)' : 'white',
    color: txtColor,
  };

  return (
    <div style={{ marginTop: '40px', padding: '20px', background: bg, borderRadius: '16px' }}>
      <h3 style={{ marginBottom: '15px', color: themeColor, fontWeight: 'bold' }}>
        📖 방명록 ({messages.length})
      </h3>

      {/* 입력 폼 */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input placeholder="이름" value={input.name} onChange={e => setInput({ ...input, name: e.target.value })} maxLength={10} style={inputStyle} />
          <input type="password" placeholder="비밀번호(4자리)" value={input.pw} onChange={e => setInput({ ...input, pw: e.target.value })} maxLength={4} style={inputStyle} />
        </div>
        <textarea placeholder="응원의 한마디를 남겨주세요!" value={input.text} onChange={e => setInput({ ...input, text: e.target.value })} style={{ ...inputStyle, height: '60px', resize: 'none', flex: 'unset' }} />
        <button type="submit" disabled={loading} style={{ background: themeColor, color: 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          {loading ? '등록 중...' : '등록하기'}
        </button>
      </form>

      {/* 목록 */}
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {messages.length === 0 && <p style={{ color: '#999', textAlign: 'center', fontSize: '0.9rem' }}>첫 방문자가 되어주세요! 👋</p>}
        {messages.map(msg => (
          <div key={msg.id} style={{ background: cardBg, padding: '12px', borderRadius: '10px', marginBottom: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
              <span style={{ fontWeight: 'bold', color: txtColor }}>{msg.name}</span>
              <button onClick={() => handleDelete(msg.id, msg.password)} style={{ border: 'none', background: 'none', color: '#ccc', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ fontSize: '0.95rem', color: txtColor, whiteSpace: 'pre-wrap' }}>{msg.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}