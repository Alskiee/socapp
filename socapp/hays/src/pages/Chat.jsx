import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import Avatar from '@/components/Avatar';
import api from '@/api/axios';
import { getSocket } from '@/services/socket';
import { useAuth } from '@/context/AuthContext';

export default function Chat() {
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [convos, setConvos] = useState([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [input, setInput] = useState('');
  const [activeId, setActiveId] = useState(paramId || null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all'); // all | unread

  const bottomRef = useRef(null);
  const startingRef = useRef(false);
  const msgSeenRef = useRef(new Set());
  const sentMessageIdsRef = useRef(new Set());
  const readMarkedRef = useRef(new Set());

  const msgKey = (m) => String(m?.id || `${m?.timestamp || m?.created_at}-${m?.sender_id || ''}-${(m?.content || '').slice(0,16)}`);

  const normalizeConvoId = (id) => {
    if (!id) return id;
    const s = String(id);
    if (!s.startsWith('convo:')) return s;
    // Keep only the first 'convo' token and the first two unique user tokens
    const parts = s.split(':'); // e.g., ['convo','u1','convo','u1','u2']
    const users = [];
    for (let i = 1; i < parts.length; i += 1) {
      const p = parts[i];
      if (p && p !== 'convo' && !users.includes(p)) users.push(p);
      if (users.length === 2) break;
    }
    if (users.length < 2) return s; // not enough tokens; leave unchanged to avoid breaking
    users.sort(); // ensure canonical order matches backend (_sorted_pair_str)
    return `convo:${users[0]}:${users[1]}`;
  };

  // Fetch conversation list
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingConvos(true);
        // Expected backend: GET /messages/conversations -> [{ id, user: { id, username, profile_pic }, last_message: { content, created_at } }]
        const res = await api.get('/messages/conversations', { params: { limit: 20, offset: 0 } });
        if (!mounted) return;
        const list = Array.isArray(res.data) ? res.data : [];
        // Normalize, deduplicate by other user id, then sort by last message time desc
        const seen = new Set();
        const unique = [];
        for (const raw of list) {
          const c = raw || {};
          const otherId = String(c?.user?.id ?? c?.oid ?? c?.id ?? '');
          if (!otherId) continue;
          if (seen.has(otherId)) continue;
          seen.add(otherId);
          // normalize last_message timestamp key for rendering
          const lm = c?.last_message || null;
          const normalizedLast = lm ? {
            ...lm,
            timestamp: lm.timestamp || lm.created_at || lm.mcreated || lm.time || null,
          } : null;
          unique.push({ ...c, last_message: normalizedLast });
        }
        unique.sort((a, b) => {
          const ta = a?.last_message?.timestamp ? new Date(a.last_message.timestamp).getTime() : 0;
          const tb = b?.last_message?.timestamp ? new Date(b.last_message.timestamp).getTime() : 0;
          return tb - ta; // desc
        });
        setConvos(unique);
        // If no active, pick first (after sorting)
        if (!activeId && unique.length) {
          setActiveId(String(unique[0].id));
          navigate(`/chat/${unique[0].id}`, { replace: true });
        }
      } catch (e) {
        console.error('Failed to load conversations', e);
      } finally {
        if (mounted) setLoadingConvos(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Resolve /chat/:id where :id can be conversation id OR user id
  useEffect(() => {
    (async () => {
      if (!paramId) return;
      const isConvoId = String(paramId).startsWith('convo:');
      const normalizedParam = normalizeConvoId(paramId);
      // If it matches a conversation id, just set it (normalized)
      const convoById = convos.find((c) => String(c.id) === String(normalizedParam));
      if (isConvoId) {
        // Do not attempt user-based endpoints with a conversation id; use it directly
        if (String(activeId) !== String(normalizedParam)) {
          setActiveId(String(normalizedParam));
          navigate(`/chat/${normalizedParam}`, { replace: true });
        }
        return;
      }
      if (convoById) {
        if (String(activeId) !== String(normalizedParam)) setActiveId(String(normalizedParam));
        return;
      }
      // Else try to find by user id
      const byUser = convos.find((c) => String(c.user?.id) === String(paramId));
      if (byUser) {
        if (String(activeId) !== String(byUser.id)) {
          setActiveId(String(byUser.id));
          navigate(`/chat/${byUser.id}`, { replace: true });
        }
        return;
      }
      // Else try to fetch existing conversation without creating one
      try {
        // Sanitize user id to avoid accidental convo prefix propagation
        const cleanUserId = String(paramId).replace(/^convo:/, '').split(':').pop();
        const res = await api.get(`/messages/conversation/with/${cleanUserId}`);
        const cid = res?.data?.conversation_id || null;
        if (cid) {
          // Insert/replace in list so header has user info; sidebar will hide if last_message is null
          setConvos((prev) => {
            const exists = prev.some((c) => String(c.id) === String(cid));
            const item = {
              id: String(cid),
              user: res?.data?.user || { id: String(paramId) },
              last_message: res?.data?.last_message || null,
              unread_count: 0,
            };
            if (exists) return prev.map((c) => String(c.id) === String(cid) ? item : c);
            return [item, ...prev];
          });
          const norm = normalizeConvoId(cid);
          setActiveId(String(norm));
          navigate(`/chat/${norm}`, { replace: true });
          return;
        }
      } catch (e) {
        // proceed to create if not found
      }

      // Create/start conversation (guard to avoid duplicate requests); do not add to sidebar until a message exists
      if (startingRef.current) return;
      startingRef.current = true;
      try {
        const res = await api.post('/messages/start', { user_id: String(paramId) });
        const cid = res?.data?.conversation_id || res?.data?.id;
        if (cid) {
          // Optionally keep header data by adding an entry with no last_message (sidebar filters will hide it)
          setConvos((prev) => {
            if (prev.some((c) => String(c.id) === String(cid))) return prev;
            return [
              {
                id: String(cid),
                user: res?.data?.user ? res.data.user : { id: String(paramId) },
                last_message: null,
                unread_count: 0,
              },
              ...prev,
            ];
          });
          const norm = normalizeConvoId(cid);
          setActiveId(String(norm));
          navigate(`/chat/${norm}`, { replace: true });
        }
      } catch (e) {
        console.warn('Could not start conversation for user', paramId, e);
      } finally {
        startingRef.current = false;
      }
    })();
  }, [paramId, convos]);

  // Reset message de-dup cache when switching rooms
  useEffect(() => {
    msgSeenRef.current = new Set();
  }, [activeId]);

  // Fetch messages for active conversation
  useEffect(() => {
    if (!activeId) return;
    let mounted = true;
    (async () => {
      try {
        setLoadingMsgs(true);
        // Expected backend: GET /messages?conversation_id=...
        const res = await api.get('/messages', { params: { conversation_id: normalizeConvoId(activeId) } });
        if (!mounted) return;
        const list = res.data || [];
        setMessages(list);
        // Seed de-dup so socket echoes of history don't duplicate
        const next = new Set();
        for (const m of list) next.add(msgKey(m));
        msgSeenRef.current = next;
        // Mark as read (best-effort), throttle to once per conversation
        const normId = normalizeConvoId(activeId);
        if (!readMarkedRef.current.has(normId)) {
          try {
            await api.post('/messages/mark_read', { conversation_id: normId });
            readMarkedRef.current.add(normId);
            setConvos((prev) => prev.map((c) => String(c.id) === String(normId) ? { ...c, unread_count: 0 } : c));
          } catch {}
        }
      } catch (e) {
        console.error('Failed to load messages', e);
      } finally {
        if (mounted) setLoadingMsgs(false);
      }
    })();
    return () => { mounted = false; };
  }, [activeId]);

  // Socket.IO real-time
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Join room per-conversation for targeted events
    if (activeId) {
      socket.emit('join_conversation', { conversation_id: normalizeConvoId(activeId) });
    }

    const onIncoming = (evt) => {
      const { conversation_id, message } = evt || {};
      if (!conversation_id || !message) return;
      const sk = msgKey(message);
      // If we just sent this message locally, ignore this socket echo once
      if (sentMessageIdsRef.current.has(sk)) {
        sentMessageIdsRef.current.delete(sk);
        return;
      }
      const k = sk;
      if (msgSeenRef.current.has(k)) return; // drop duplicates from any source
      msgSeenRef.current.add(k);
      if (String(conversation_id) === String(activeId)) {
        setMessages((prev) => {
          const exists = prev.some((m) => msgKey(m) === k);
          return exists ? prev : [...prev, message];
        });
      }
      // Optionally update previews
      setConvos((prev) => prev.map((c) => String(c.id) === String(conversation_id) ? { ...c, last_message: message } : c));
    };

    socket.on('message:new', onIncoming);

    return () => {
      socket.off('message:new', onIncoming);
      if (activeId) socket.emit('leave_conversation', { conversation_id: activeId });
    };
  }, [activeId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || !activeId) return;
    try {
      // Backend: POST /messages/send { conversation_id, content }
      const res = await api.post('/messages/send', { conversation_id: normalizeConvoId(activeId), content });
      const payload = res.data || {};
      const cid = payload.conversation_id || activeId;
      const msg = payload.message || payload;
      // If backend returns a different conversation_id, switch
      if (cid && String(cid) !== String(activeId)) {
        setActiveId(String(cid));
        navigate(`/chat/${cid}`, { replace: true });
      }
      const k = msgKey(msg);
      // Track as locally sent so the socket echo can be ignored once
      sentMessageIdsRef.current.add(k);
      if (!msgSeenRef.current.has(k)) {
        msgSeenRef.current.add(k);
        setMessages((prev) => {
          const exists = prev.some((m) => msgKey(m) === k);
          return exists ? prev : [...prev, msg];
        });
      }
      setConvos((prev) => prev.map((c) => String(c.id) === String(cid)
        ? { ...c, last_message: msg, unread_count: 0 }
        : c
      ));
      setInput('');
      // Emit via socket for instant updates
      const socket = getSocket();
      socket.emit('message:send', { conversation_id: activeId, message: msg });
    } catch (e) {
      console.error('Failed to send message', e);
    }
  };

  const openConversation = (cid) => {
    const norm = normalizeConvoId(cid);
    setActiveId(String(norm));
    navigate(`/chat/${norm}`);
  };

  const renderTime = (ts) => {
    try { return new Date(ts).toLocaleTimeString(); } catch { return ''; }
  };

  const renderShortTime = (ts) => {
    try {
      const d = new Date(ts);
      const diff = (Date.now() - d.getTime()) / 1000;
      if (diff < 60) return `${Math.floor(diff)}s`;
      if (diff < 3600) return `${Math.floor(diff/60)}m`;
      if (diff < 86400) return `${Math.floor(diff/3600)}h`;
      return `${Math.floor(diff/86400)}d`;
    } catch { return ''; }
  };

  const filteredConvos = useMemo(() => {
    let list = convos;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((c) => (c.user?.username || '').toLowerCase().includes(q));
    }
    if (tab === 'unread') {
      list = list.filter((c) => (c.unread_count || 0) > 0);
    }
    // Only show conversations that have a last message
    return list.filter((c) => !!c.last_message);
  }, [convos, query, tab]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-purple-200 to-purple-300">
      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          <Sidebar />
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Conversations panel */}
            <div className="bg-white/85 rounded-2xl shadow-md border border-purple-100 p-3 md:col-span-1 overflow-hidden flex flex-col">
              {/* Top bar */}
              <div className="px-2 pb-2">
                <div className="flex items-center justify-between">
                  <div className="text-xl font-semibold text-gray-900">Chats</div>
                </div>
                <div className="mt-2">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search Messenger"
                    className="w-full rounded-xl border border-purple-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                </div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => setTab('all')} className={`px-3 py-1.5 rounded-full text-sm ${tab==='all' ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-800'}`}>All</button>
                  <button onClick={() => setTab('unread')} className={`px-3 py-1.5 rounded-full text-sm ${tab==='unread' ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-800'}`}>Unread</button>
                </div>
              </div>
              {/* List */}
              <div className="space-y-1 overflow-auto pr-2" style={{ maxHeight: '70vh' }}>
                {loadingConvos ? (
                  <div className="text-purple-600 px-2">Loading...</div>
                ) : filteredConvos.length === 0 ? (
                  <div className="text-gray-600 px-2">No conversations yet.</div>
                ) : (
                  filteredConvos.map((c) => (
                    <button
                      key={String(c.id)}
                      onClick={() => openConversation(c.id)}
                      className={`w-full text-left flex items-center gap-3 p-2 rounded-xl hover:bg-purple-50 ${String(activeId) === String(c.id) ? 'bg-purple-100' : ''}`}
                    >
                      <Avatar src={c.user?.profile_pic || c.user?.avatar_url} username={c.user?.username} name={c.user?.name} size={40} showBorder={false} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-gray-900 truncate">{c.user?.username || 'User'}</div>
                          <div className="text-[11px] text-gray-500 ml-2">{c.last_message?.timestamp ? renderShortTime(c.last_message.timestamp) : ''}</div>
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="text-xs text-gray-600 truncate">
                            {c.last_message ? ((c.last_message?.from_me ? 'You: ' : '') + (c.last_message?.content || '')) : 'No messages yet'}
                          </div>
                          {(c.unread_count || 0) > 0 && <span className="ml-auto inline-block h-2.5 w-2.5 bg-blue-500 rounded-full" />}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Chat window */}
            <div className="bg-white/85 rounded-2xl shadow-md border border-purple-100 p-3 md:col-span-2 flex flex-col min-h-[70vh]">
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-purple-100 pb-3 mb-3">
                {activeId ? (
                  <>
                    {(() => {
                      const c = convos.find((x) => String(x.id) === String(activeId));
                      return (
                        <>
                          <Avatar src={c?.user?.profile_pic || c?.user?.avatar_url} username={c?.user?.username} name={c?.user?.name} size={40} showBorder={false} />
                          <div className="font-semibold text-gray-900">{c?.user?.username || 'Conversation'}</div>
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <div className="text-gray-600">Select a conversation</div>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-auto space-y-2 pr-2">
                {loadingMsgs ? (
                  <div className="text-purple-600">Loading...</div>
                ) : messages.length === 0 ? (
                  <div className="text-gray-600">No messages yet.</div>
                ) : (
                  messages.map((m) => {
                    const mine = String(m.sender_id) === String(user?.id);
                    return (
                      <div key={m.id || `${m.timestamp || m.created_at}-${m.sender_id || ''}`} className={`flex items-end gap-2 ${mine ? 'justify-end' : ''}`}>
                        {!mine && (
                          <Avatar src={(convos.find((c)=>String(c.id)===String(activeId))?.user?.profile_pic) || (convos.find((c)=>String(c.id)===String(activeId))?.user?.avatar_url)} username={(convos.find((c)=>String(c.id)===String(activeId))?.user?.username)} size={28} showBorder={false} />
                        )}
                        <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow ${mine ? 'bg-purple-600 text-white' : 'bg-purple-100 text-gray-900'}`}>
                          <div>{m.content}</div>
                          <div className={`text-[10px] mt-1 ${mine ? 'text-purple-100' : 'text-gray-500'}`}>{renderTime(m.created_at || m.timestamp)}</div>
                        </div>
                        {mine && (
                          <Avatar src={user?.profile_pic || user?.avatar_url} username={user?.username} size={28} showBorder={false} />
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="mt-3 flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                  placeholder="Type a message..."
                  className="flex-1 rounded-xl border border-purple-200 text-purple-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
                <button onClick={handleSend} className="px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700">Send</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
