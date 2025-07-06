'use client'
import { useEffect, useRef, useState } from 'react'

interface Message {
  role: 'user' | 'model';
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const sessionIdRef = useRef<string>('')
  const userId = 'user1'
  const appName = 'chat'

  useEffect(() => {
    // create session on first load
    async function createSession() {
      const res = await fetch(`/apps/${appName}/users/${userId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      sessionIdRef.current = data.id
    }
    createSession()
  }, [])

  async function sendMessage() {
    const text = input.trim()
    if (!text) return
    setMessages((msgs) => [...msgs, { role: 'user', content: text }])
    setInput('')

    const payload = {
      app_name: appName,
      user_id: userId,
      session_id: sessionIdRef.current,
      new_message: { role: 'user', parts: [{ text }] },
    }
    const res = await fetch('/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const events = await res.json()
    const reply = events.find((e: any) => e.type === 'content')
    if (reply) {
      const textResp = reply.data.parts?.[0]?.text || ''
      setMessages((msgs) => [...msgs, { role: 'model', content: textResp }])
    }
  }

  return (
    <div className="flex flex-col h-screen p-4">
      <div className="flex-1 overflow-y-auto mb-4 space-y-2">
        {messages.map((m, idx) => (
          <div key={idx} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <span className="inline-block rounded px-2 py-1 bg-gray-200">{m.content}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 border p-2 rounded"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') sendMessage() }}
        />
        <button className="px-4 py-2 bg-blue-500 text-white rounded" onClick={sendMessage}>Send</button>
      </div>
    </div>
  )
}
