import { useParams, Link } from 'react-router-dom'

export function SnapshotView() {
  const { id } = useParams()

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Срез {id}</h1>
        <Link to="/">К обзору</Link>
      </div>
      <section className="card">
        <p className="muted">Просмотр отдельного среза ещё не сделан.</p>
      </section>
    </div>
  )
}
