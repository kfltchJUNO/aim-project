// components/Guestbook.tsx
"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';

export default function Guestbook({ username }: { username: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState({ name: '', pw: '', text: '' });
  const [loading, setLoading] = useState(false);

  // 방명록 목록 실시간 불러오기
  useEffect(() => {
    const q = query(
      collection(db, "guestbooks"),
      where("to_user", "==", username),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [username]);

  // 방명록 쓰기
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.name || !input.pw || !input.text) return alert("모든 내용을 입력해주세요.");
    
    setLoading(true);
    try {
      await addDoc(collection(db, "guestbooks"), {
        to_user: username,
        name: input.name,
        password: input.pw,
        content: input.text,
        createdAt: serverTimestamp()
      });
      setInput({ name: '', pw: '', text: '' }); // 초기화
    } catch (err) {
      alert("등록 실패: " + err);
    } finally {
      setLoading(false);
    }
  };

  // 방명록 삭제 (비번 확인)
  const handleDelete = async (id: string, correctPw: string) => {
    const userPw = prompt("삭제하려면 비밀번호를 입력하세요.");
    if (userPw === correctPw) {
      await deleteDoc(doc(db, "guestbooks", id));
      alert("삭제되었습니다.");
    } else if (userPw) {
      alert("비밀번호가 틀렸습니다.");
    }
  };

  return (
    <div style={{ marginTop: '40px', padding: '20px', background: '#f8f9fa', borderRadius: '16px' }}>
      <h3 style={{ marginBottom: '15px', color: '#1a237e', fontWeight: 'bold' }}>📖 방명록 ({messages.length})</h3>
      
      {/* 입력 폼 */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input 
            placeholder="이름" value={input.name} onChange={(e)=>setInput({...input, name:e.target.value})} maxLength={10}
            style={inputStyle} 
          />
          <input 
            type="password" placeholder="비밀번호(4자리)" value={input.pw} onChange={(e)=>setInput({...input, pw:e.target.value})} maxLength={4}
            style={inputStyle} 
          />
        </div>
        <textarea 
          placeholder="응원의 한마디를 남겨주세요!" value={input.text} onChange={(e)=>setInput({...input, text:e.target.value})}
          style={{ ...inputStyle, height: '60px', resize: 'none' }} 
        />
        <button type="submit" disabled={loading} style={btnStyle}>
          {loading ? "등록 중..." : "등록하기"}
        </button>
      </form>

      {/* 목록 리스트 */}
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {messages.length === 0 ? <p style={{color:'#999', textAlign:'center', fontSize:'0.9rem'}}>첫 방문자가 되어주세요! 👋</p> : null}
        
        {messages.map((msg) => (
          <div key={msg.id} style={{ background: 'white', padding: '12px', borderRadius: '10px', marginBottom: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
              <span style={{ fontWeight: 'bold' }}>{msg.name}</span>
              <button onClick={()=>handleDelete(msg.id, msg.password)} style={{ border:'none', background:'none', color:'#ccc', cursor:'pointer' }}>×</button>
            </div>
            <div style={{ fontSize: '0.95rem', color: '#333', whiteSpace: 'pre-wrap' }}>{msg.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle = { border: '1px solid #ddd', padding: '8px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', flex: 1 };
const btnStyle = { background: '#1a237e', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };