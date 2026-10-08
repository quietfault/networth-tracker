import { Link } from 'react-router-dom'

export function Overview() {
  return (
    <section className="stack">
      <div className="page-head">
        <h1>Обзор</h1>
      </div>
      <p className="muted">
        Дашборд появится на второй неделе пересборки. Пока можно загрузить историю — <Link to="/import">Импорт</Link>.
      </p>
    </section>
  )
}
