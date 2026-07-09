import { useParams } from 'react-router-dom'

export function SnapshotView() {
  const { id } = useParams()
  return (
    <div>
      <h1>Снимок {id}</h1>
      <p>Здесь будет просмотр конкретного снимка.</p>
    </div>
  )
}
