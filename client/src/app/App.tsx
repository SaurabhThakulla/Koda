import './App.css'
import type { editor as MonacoEditor } from 'monaco-editor'
import { MonacoBinding } from 'y-monaco'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import { SocketIOProvider } from 'y-socket.io'
import { Editor } from '@monaco-editor/react'

type ConnectionState = 'connecting' | 'connected' | 'disconnected'
type RoomSession = {
  room: string
  username: string
}

const accentPalette = ['#7ce7ac', '#7dd3fc', '#fcd34d', '#fca5a5', '#c4b5fd', '#f59e0b', '#34d399']

const socketUrl = (() => {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL as string
  if (import.meta.env.DEV) return 'http://localhost:5000'
  return window.location.origin
})()

const colorForName = (name: string) => {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash)
  }
  return accentPalette[Math.abs(hash) % accentPalette.length]
}

const normalizeRoomCode = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')

const createRoomCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const segments = Array.from({ length: 2 }, () =>
    Array.from(
      { length: 4 },
      () => alphabet[Math.floor(Math.random() * alphabet.length)]
    ).join('')
  )

  return segments.join('-')
}

const readSessionFromUrl = () => {
  const params = new URLSearchParams(window.location.search)
  return {
    room: normalizeRoomCode(params.get('room') || ''),
    username: (params.get('username') || '').trim(),
  }
}

const buildInviteLink = (room: string) => {
  const url = new URL(window.location.href)
  url.searchParams.set('room', room)
  url.searchParams.delete('username')
  return url.toString()
}

function RoomWorkspace({ room, username, onLeave }: RoomSession & { onLeave: () => void }) {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const statusResetRef = useRef<number | null>(null)
  const [users, setUsers] = useState<string[]>([])
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const [statusMessage, setStatusMessage] = useState(`Connecting to room ${room}...`)
  const ydoc = useMemo(() => new Y.Doc(), [room])
  const ytext = useMemo(() => ydoc.getText('monaco'), [ydoc])
  const provider = useMemo(
    () => new SocketIOProvider(socketUrl, room, ydoc, { autoConnect: true }),
    [room, ydoc]
  )

  useEffect(() => {
    const { socket } = provider

    const handleConnect = () => {
      setConnectionState('connected')
      setStatusMessage(`Live in room ${room}`)
    }

    const handleDisconnect = () => {
      setConnectionState('disconnected')
      setStatusMessage(`Reconnecting to ${room}...`)
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
      if (statusResetRef.current) window.clearTimeout(statusResetRef.current)
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleError)
      provider.disconnect()
      provider.destroy()
      ydoc.destroy()
    }
  }, [provider, room, ydoc])

  useEffect(() => {
    const handleChange = () => {
      const states = Array.from(provider.awareness.getStates().values())
      const nextUsers = states
        .map((state) => state.user?.username)
        .filter((value): value is string => Boolean(value))

      setUsers(Array.from(new Set(nextUsers)))
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
  }, [provider, username])

  const setTemporaryStatus = (message: string) => {
    setStatusMessage(message)

    if (statusResetRef.current) window.clearTimeout(statusResetRef.current)
    statusResetRef.current = window.setTimeout(() => {
      setStatusMessage(
        provider.socket.connected ? `Live in room ${room}` : `Reconnecting to ${room}...`
      )
    }, 2200)
  }

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

    new MonacoBinding(ytext, model, new Set([editor]), provider.awareness)
  }

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(buildInviteLink(room))
      setTemporaryStatus('Invite link copied')
    } catch (error) {
      console.warn('Clipboard unavailable', error)
      setTemporaryStatus('Clipboard unavailable')
    }
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room)
      setTemporaryStatus('Room code copied')
    } catch (error) {
      console.warn('Clipboard unavailable', error)
      setTemporaryStatus('Clipboard unavailable')
    }
  }

  const handleNativeShare = async () => {
    if (!navigator.share) return

    try {
      await navigator.share({
        title: `Join room ${room}`,
        text: `${username} invited you to collaborate in room ${room}.`,
        url: buildInviteLink(room),
      })
      setTemporaryStatus('Invite shared')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      console.warn('Share failed', error)
      setTemporaryStatus('Share failed')
    }
  }

  const handleEmailInvite = () => {
    const subject = encodeURIComponent(`Join my room: ${room}`)
    const body = encodeURIComponent(
      `${username} invited you to join room ${room}.\n\nOpen this link:\n${buildInviteLink(room)}`
    )
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  const presentUsers = users.length ? users : [username]
  const participantCount = presentUsers.length

  return (
    <main className="min-h-screen bg-pattern text-slate-50 px-4 py-6">
      <div className="mx-auto flex h-[calc(100vh-48px)] max-w-7xl flex-col gap-4">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-lg font-black text-slate-900 shadow-lg">
              RM
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/80">Room {room}</p>
              <h1 className="text-xl font-semibold leading-tight">Collaborative code room</h1>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <div className="glass flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm">
              <span className={`status-dot ${connectionState}`} />
              <span>{statusMessage}</span>
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
            >
              Copy room code
            </button>
            <button
              type="button"
              onClick={handleCopyInvite}
              className="rounded-full border border-emerald-300/50 bg-white/5 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-white/10"
            >
              Copy invite link
            </button>
            {typeof navigator.share === 'function' ? (
              <button
                type="button"
                onClick={handleNativeShare}
                className="rounded-full border border-cyan-300/50 bg-white/5 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-white/10"
              >
                Share invite
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleEmailInvite}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
            >
              Email invite
            </button>
            <button
              type="button"
              onClick={onLeave}
              className="rounded-full border border-rose-300/40 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/20"
            >
              Leave room
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-12 gap-4">
          <aside className="glass col-span-12 flex flex-col gap-4 rounded-3xl border border-white/10 p-4 lg:col-span-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">People</p>
                <p className="text-lg font-semibold">{participantCount} online</p>
              </div>
              <span className="text-xs text-slate-400">You: {username}</span>
            </div>

            <div className="custom-scroll space-y-2 overflow-auto pr-1">
              {presentUsers.map((user) => (
                <div
                  key={user}
                  className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 px-3 py-2"
                >
                  <span
                    className="grid h-9 w-9 place-items-center rounded-xl font-semibold text-slate-950"
                    style={{ background: colorForName(user) }}
                  >
                    {user.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="flex flex-col leading-tight">
                    <span className="font-medium">{user === username ? `${user} (you)` : user}</span>
                    <span className="text-xs text-slate-400">Editing room {room}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 rounded-2xl border border-white/5 bg-white/5 px-3 py-3 text-sm text-slate-300">
              <p className="font-semibold text-slate-50">Invite details</p>
              <p>Room code: {room}</p>
              <p>Share this code or send the invite link from the header.</p>
            </div>

            <div className="space-y-1 rounded-2xl border border-white/5 bg-white/5 px-3 py-3 text-sm text-slate-300">
              <p className="font-semibold text-slate-50">Connection</p>
              <p>Socket: {socketUrl}</p>
              <p>Document: {room}</p>
            </div>
          </aside>

          <section className="glass col-span-12 flex min-h-0 flex-col rounded-3xl border border-white/10 p-3 lg:col-span-9">
            <div className="flex items-center justify-between gap-2 border-b border-white/5 px-2 py-2">
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
                defaultValue={`// Room ${room} is live with ${participantCount} participant(s).\n// Share the room code or invite link to bring someone in.\n\nfunction greet(name) {\n  return \`Hello, \${name}!\`\n}\n\nconsole.log(greet('${username}'));\n`}
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

function App() {
  const initialSession = readSessionFromUrl()
  const [session, setSession] = useState<RoomSession | null>(() =>
    initialSession.room && initialSession.username
      ? { room: initialSession.room, username: initialSession.username }
      : null
  )
  const [pendingUsername, setPendingUsername] = useState(() => initialSession.username)
  const [pendingRoom, setPendingRoom] = useState(() => initialSession.room)
  const [lobbyMessage, setLobbyMessage] = useState(
    initialSession.room ? `Invite ready for room ${initialSession.room}` : 'Create a room or join one with a code.'
  )

  const enterRoom = ({ room, username }: RoomSession) => {
    const nextSession = { room: normalizeRoomCode(room), username: username.trim() }
    const url = new URL(window.location.href)

    url.searchParams.set('room', nextSession.room)
    url.searchParams.set('username', nextSession.username)
    window.history.pushState({}, '', url)

    setSession(nextSession)
    setPendingRoom(nextSession.room)
    setPendingUsername(nextSession.username)
    setLobbyMessage(`You are in room ${nextSession.room}`)
  }

  const handleCreateRoom = () => {
    const username = pendingUsername.trim()
    if (!username) {
      setLobbyMessage('Add your name before creating a room.')
      return
    }

    enterRoom({ room: createRoomCode(), username })
  }

  const handleJoinRoom = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const username = pendingUsername.trim()
    const room = normalizeRoomCode(pendingRoom)

    if (!username) {
      setLobbyMessage('Add your name before joining a room.')
      return
    }

    if (!room) {
      setLobbyMessage('Enter a room code or create a new room.')
      return
    }

    enterRoom({ room, username })
  }

  const handleLeaveRoom = () => {
    const url = new URL(window.location.href)
    url.searchParams.set('room', session?.room || pendingRoom)
    url.searchParams.delete('username')
    window.history.pushState({}, '', url)
    setSession(null)
    setLobbyMessage(`You left room ${session?.room || pendingRoom}. Invite code is still ready.`)
  }

  if (session) {
    return <RoomWorkspace room={session.room} username={session.username} onLeave={handleLeaveRoom} />
  }

  return (
    <main className="min-h-screen bg-pattern px-4 py-8 text-slate-50">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="glass overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl">
          <div className="border-b border-white/10 bg-white/5 px-8 py-6">
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/80">Frontend room flow</p>
            <h1 className="mt-3 max-w-lg text-4xl font-semibold leading-tight">
              Create a room, invite someone, and start coding together in seconds.
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-300">
              This is a frontend lobby for live collaboration. Create a fresh room code, or paste an invite code to join the same workspace.
            </p>
          </div>

          <div className="grid gap-6 px-8 py-8 md:grid-cols-[1.15fr_0.85fr]">
            <form className="space-y-5" onSubmit={handleJoinRoom}>
              <div className="space-y-2">
                <label className="text-sm text-slate-300" htmlFor="username">
                  Your display name
                </label>
                <input
                  id="username"
                  type="text"
                  value={pendingUsername}
                  onChange={(event) => setPendingUsername(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base placeholder:text-slate-500 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  placeholder="ex. KodaDev"
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-300" htmlFor="room-code">
                  Room code
                </label>
                <input
                  id="room-code"
                  type="text"
                  value={pendingRoom}
                  onChange={(event) => setPendingRoom(normalizeRoomCode(event.target.value))}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base uppercase tracking-[0.18em] placeholder:tracking-normal placeholder:text-slate-500 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/35"
                  placeholder="ABCD-EFGH"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleCreateRoom}
                  className="rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-5 py-3 font-semibold text-slate-900 shadow-lg shadow-emerald-500/25 transition hover:-translate-y-0.5"
                >
                  Create room
                </button>
                <button
                  type="submit"
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-slate-100 transition hover:bg-white/10"
                >
                  Join room
                </button>
              </div>

              <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                {lobbyMessage}
              </p>
            </form>

            <div className="space-y-4 rounded-[1.75rem] border border-white/10 bg-slate-950/35 p-5">
              <div className="rounded-[1.5rem] border border-emerald-300/15 bg-gradient-to-br from-emerald-400/15 via-cyan-300/10 to-transparent p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/80">Invite flow</p>
                <p className="mt-3 text-xl font-semibold">Create it, copy it, share it.</p>
                <p className="mt-2 text-sm text-slate-300">
                  Once you enter a room, the header gives you a share link, room code copy button, native share action, and quick email invite.
                </p>
              </div>

              <div className="space-y-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="font-semibold text-slate-50">1. Create room</p>
                  <p>We generate a code like `ABCD-EFGH` and open that realtime workspace.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="font-semibold text-slate-50">2. Send invite</p>
                  <p>Share the room code or copy the invite link so another person lands in the same room.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="font-semibold text-slate-50">3. Collaborate live</p>
                  <p>Everyone in the same room code joins the same synced Monaco document.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="glass flex flex-col justify-between rounded-[2rem] border border-white/10 p-8 shadow-2xl">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Ready to join</p>
            <p className="mt-3 text-2xl font-semibold leading-tight">
              {pendingRoom ? `Room ${pendingRoom}` : 'No room code yet'}
            </p>
            <p className="mt-3 text-sm text-slate-300">
              If someone shares a room link, this screen automatically preloads the room code so all you need is your name.
            </p>
          </div>

          <div className="mt-8 space-y-3 rounded-[1.75rem] border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
            <p className="font-semibold text-slate-50">What this changes</p>
            <p>The room is no longer fixed to `monaco`.</p>
            <p>Invite links now target a specific room.</p>
            <p>Joining from the frontend works without editing the URL by hand.</p>
          </div>
        </aside>
      </div>
    </main>
  )
}

export default App
