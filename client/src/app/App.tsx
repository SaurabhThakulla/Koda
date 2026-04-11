import './App.css'
import type { editor as MonacoEditor } from 'monaco-editor'
import { MonacoBinding } from 'y-monaco'
import { useRef, useMemo, useState, useEffect } from 'react'
import * as Y from 'yjs'
import { SocketIOProvider } from 'y-socket.io'
import { Editor } from '@monaco-editor/react'

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
  

  useEffect(() => {
    if (username && editorRef.current) {
      const model = editorRef.current.getModel()
      if (!model) return

      const provider = new SocketIOProvider('http://localhost:5000', 'monaco', ydoc, { autoConnect: true})
      provider.awareness.setLocalStateField('user', { username })

      provider.awareness.on('change', () => {
        const states = Array.from(provider.awareness.getStates().values())
        setUsers(states.filter(user=> user.username).map(user => user.user.username))
        console.log('Active users:', states.map(state => state.user?.username).filter(Boolean))
      })
      function handlebeforeunload() {
        provider.awareness.setLocalState("user", null)
      }
      window.addEventListener('beforeunload', handlebeforeunload)

      new MonacoBinding(
        ytext,
        model,
        new Set([editorRef.current]),
        provider.awareness
      )
    }

  }, [username, ydoc, ytext])

  const handleMount = (editor: MonacoEditor.IStandaloneCodeEditor) => {
    editorRef.current = editor

    const provider = new SocketIOProvider('http://localhost:5000', 'monaco', ydoc, { autoConnect: true})
    const model = editor.getModel()
    if (!model) return
    
    new MonacoBinding(
      ytext,
      model,
      new Set([editor]),
      provider.awareness
    )
  }


  const handlejoin = (e) => {
    e.preventDefault()
    const value = pendingUsername.trim()
    if (!value) return
    setUsername(value)
    window.history.pushState({}, '', `?username=${value}`)
    setPendingUsername('')
  }

  if (!username) {
    return (
      <main className='h-screen w-full bg-gray-950 flex gap-4 p-4 items-center justify-center'>
        <form className='bg-neutral-50 p-4 rounded-lg flex flex-col gap-4 items-center' onSubmit={handlejoin}>
          <h1 className='text-2xl font-bold'>Enter your username</h1>
          <input
            type="text"
            value={pendingUsername}
            onChange={(e) => setPendingUsername(e.target.value)}
            className='border border-gray-300 rounded-lg p-2 w-full'
            name='username'
          />
          <button type="submit">Join</button>
        </form>
      </main>
    )
  }

  return (
    <>
      <main className="h-screen w-full bg-gray-950 flex gap-4 p-2">
        <aside className='h-full w-1/4 bg-amber-50 rounded-lg'>
          <div className='w-full h-10 bg-gray-500 text-amber-50 rounded-lg items-center p-1'>{username}</div>
        </aside>
        <section className='h-full w-3/4 bg-neutral-50 rounded-lg'>
          <Editor
            height="100%"
            defaultLanguage="javascript"
            defaultValue="// Write your code here"
            onMount={handleMount}
          />
        </section>
      </main>
    </>
  )
}

export default App
