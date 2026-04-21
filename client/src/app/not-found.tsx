type NotFoundProps = {
  onGoHome?: () => void
}

function NotFound({ onGoHome }: NotFoundProps) {
  return (
    <main className="min-h-screen bg-pattern px-4 py-8 text-slate-50">
      <section className="mx-auto flex min-h-[calc(100vh-64px)] max-w-4xl items-center">
        <div className="glass w-full overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl">
          <div className="border-b border-white/10 bg-white/5 px-8 py-6">
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/80">404 not found</p>
            <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight">
              This room link does not point anywhere useful yet.
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-300">
              Head back to the lobby to create a room, join with an invite code, or start fresh with a new collaborative workspace.
            </p>
          </div>

          <div className="grid gap-6 px-8 py-8 md:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[1.75rem] border border-emerald-300/15 bg-gradient-to-br from-emerald-400/15 via-cyan-300/10 to-transparent p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/80">Lost route</p>
              <p className="mt-3 text-6xl font-black text-slate-50">404</p>
              <p className="mt-3 text-sm text-slate-300">
                The collaboration lobby lives at the home route. Invite details should come through the room code in the URL query.
              </p>
            </div>

            <div className="flex flex-col justify-between gap-6 rounded-[1.75rem] border border-white/10 bg-slate-950/35 p-5">
              <div>
                <p className="font-semibold text-slate-50">Need a room?</p>
                <p className="mt-2 text-sm text-slate-300">
                  Return to the lobby and enter your name. You can create a new code or paste the one someone shared with you.
                </p>
              </div>

              {onGoHome ? (
                <button
                  type="button"
                  onClick={onGoHome}
                  className="w-fit rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-5 py-3 font-semibold text-slate-900 shadow-lg shadow-emerald-500/25 transition hover:-translate-y-0.5"
                >
                  Back to lobby
                </button>
              ) : (
                <a
                  href="/"
                  className="w-fit rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-5 py-3 font-semibold text-slate-900 shadow-lg shadow-emerald-500/25 transition hover:-translate-y-0.5"
                >
                  Back to lobby
                </a>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default NotFound
