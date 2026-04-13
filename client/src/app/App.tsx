import './App.css'
import type { editor as MonacoEditor } from 'monaco-editor'
import { MonacoBinding } from 'y-monaco'
import { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import * as Y from 'yjs'
import { SocketIOProvider } from 'y-socket.io'
import { Editor } from '@monaco-editor/react'

type ConnectionState = 'connecting' | 'connected' | 'disconnected'

const accentPalette = ['#7ce7ac', '#7dd3fc', '#fcd34d', '#fca5a5', '#c4b5fd', '#f59e0b', '#34d399']

const colorForName = (name: string) => {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return accentPalette[Math.abs(hash) % accentPalette.length]
}

const socketUrl = (() => {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL as string
  if (import.meta.env.DEV) return 'http://localhost:5000'
  return window.location.origin
})()

function App() {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const [username, setUsername] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('username') || ''
  })
  const [pendingUsername, setPendingUsername] = useState('')
  const [users, setUsers] = useState<string[]>([])
  const ydoc = useMemo(() => new Y.Doc(), [])
  const ytext = useMemo(() => ydoc.getText('monaco'), [ydoc])
  const provider = useMemo(
    () => new SocketIOProvider(socketUrl, 'monaco', ydoc, { autoConnect: true }),
    [ydoc]
  )
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const [statusMessage, setStatusMessage] = useState('Connecting to collaboration server…')

  useEffect(() => {
    const { socket } = provider

    const handleConnect = () => {
      setConnectionState('connected')
      setStatusMessage('Live & synced')
    }

    const handleDisconnect = () => {
      setConnectionState('disconnected')
      setStatusMessage('Reconnecting…')
    }

    const handleError = (error: Error) => {
      setConnectionState('disconnected')
      setStatusMessage(error.message || 'Connection error')
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleError)

    if (socket.connected) handleConnect()

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleError)
      provider.disconnect()
      provider.destroy()
      ydoc.destroy()
    }
  }, [provider, ydoc])
  

  useEffect(() => {
    if (!username) return

    const handleChange = () => {
      const states = Array.from(provider.awareness.getStates().values())
      setUsers(
        states
          .filter((state) => state.user?.username)
          .map((state) => state.user.username)
      )
    }

    provider.awareness.setLocalStateField('user', { username, color: colorForName(username) })
    provider.awareness.on('change', handleChange)
    handleChange()

    const handleBeforeUnload = () => {
      provider.awareness.setLocalStateField('user', null)
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      provider.awareness.off('change', handleChange)
      provider.awareness.setLocalStateField('user', null)
    }
  }, [username, provider])

  const handleMount = (editor: MonacoEditor.IStandaloneCodeEditor) => {
    editorRef.current = editor

    editor.updateOptions({
      fontLigatures: true,
      fontSize: 14,
      minimap: { enabled: false },
      smoothScrolling: true,
    })

    const model = editor.getModel()
    if (!model) return
    
    new MonacoBinding(
      ytext,
      model,
      new Set([editor]),
      provider.awareness
    )
  }


  const handleJoin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const value = pendingUsername.trim()
    if (!value) return
    setUsername(value)
    window.history.pushState({}, '', `?username=${value}`)
    setPendingUsername('')
  }

  const handleCopyLink = useCallback(async () => {
    const url = new URL(window.location.href)
    url.searchParams.set('username', username || 'guest')

    try {
      await navigator.clipboard.writeText(url.toString())
      setStatusMessage('Invite link copied')
      setTimeout(() => setStatusMessage('Live & synced'), 1800)
    } catch (error) {
      console.warn('Clipboard unavailable', error)
      setStatusMessage('Clipboard unavailable')
    }
  }, [username])

  if (!username) {
    return (
      <main className="min-h-screen bg-pattern text-slate-50 flex items-center justify-center px-4">
        <div className="glass w-full max-w-xl rounded-3xl border border-white/10 p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 grid place-items-center text-slate-900 font-black text-xl shadow-lg">
              λ
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/80">Live editor</p>
              <h1 className="text-2xl font-semibold leading-tight">Join the canvas</h1>
              <p className="text-sm text-slate-400">Real-time Monaco editor synced over WebSockets.</p>
            </div>
          </div>
          <form className="space-y-3" onSubmit={handleJoin}>
            <label className="text-sm text-slate-400">Pick a display name</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={pendingUsername}
                onChange={(e) => setPendingUsername(e.target.value)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base placeholder:text-slate-500 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                name="username"
                autoFocus
                required
              />
              <button
                type="submit"
                className="shrink-0 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-5 py-3 text-slate-900 font-semibold shadow-lg shadow-emerald-500/30 transition hover:translate-y-[-1px]"
              >
                Enter
              </button>
            </div>
          </form>
          <p className="text-sm text-slate-400">We’ll sync you as soon as you enter. Share the invite link after you join.</p>
        </div>
      </main>
    )
  }

  const presentUsers = users.length ? users : [username]
  const participantCount = presentUsers.length

  return (
    <main className="min-h-screen bg-pattern text-slate-50 px-4 py-6">
      <div className="max-w-7xl mx-auto h-[calc(100vh-48px)] flex flex-col gap-4">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 grid place-items-center text-slate-900 font-black text-lg shadow-lg">
              λ
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/80">Room: monaco</p>
              <h1 className="text-xl font-semibold leading-tight">Collaborative code room</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="glass flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm">
              <span className={`status-dot ${connectionState}`} />
              <span>{statusMessage}</span>
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className="hidden sm:inline-flex items-center gap-2 rounded-full border border-emerald-300/50 bg-white/5 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-white/10 transition"
            >
              Copy invite
            </button>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
          <aside className="col-span-12 lg:col-span-3 glass rounded-3xl border border-white/10 p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">People</p>
                <p className="text-lg font-semibold">{presentUsers.length} online</p>
              </div>
              <span className="text-xs text-slate-400">You: {username}</span>
            </div>
            <div className="space-y-2 overflow-auto pr-1 custom-scroll">
              {presentUsers.map((user) => (
                <div
                  key={user}
                  className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 px-3 py-2"
                >
                  <span
                    className="h-9 w-9 rounded-xl grid place-items-center text-slate-950 font-semibold"
                    style={{ background: colorForName(user) }}
                  >
                    {user.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="flex flex-col leading-tight">
                    <span className="font-medium">
                      {user === username ? `${user} (you)` : user}
                    </span>
                    <span className="text-xs text-slate-400">Editing shared doc</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/5 px-3 py-3 text-sm text-slate-300 space-y-1">
              <p className="font-semibold text-slate-50">Connection</p>
              <p>Socket: {socketUrl}</p>
              <p>Document: monaco</p>
            </div>
          </aside>

          <section className="col-span-12 lg:col-span-9 glass rounded-3xl border border-white/10 p-3 flex flex-col min-h-0">
            <div className="flex items-center justify-between gap-2 px-2 py-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Active as</span>
                <span className="font-semibold text-slate-50">{username}</span>
              </div>
              <div className="text-xs text-slate-400">Changes sync in realtime</div>
            </div>
            <div className="flex-1 min-h-[60vh]">
              <Editor
                height="100%"
                theme="vs-dark"
                defaultLanguage="javascript"
                defaultValue={`// You are live with ${participantCount} participant(s).\n// Start typing to share changes.\n\nfunction greet(name) {\n  return \`Hello, \${name}!\`\n}\n\nconsole.log(greet('${username || 'dev'}'));\n`}
                onMount={handleMount}
                options={{ padding: { top: 16 } }}
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

export default App
