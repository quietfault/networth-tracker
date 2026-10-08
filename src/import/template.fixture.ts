import { fileURLToPath } from 'node:url'

// The import contract itself is the fixture: tests read the very file the owner
// copies, not a separate sample that could drift from it.
export const TEMPLATE_PATH = fileURLToPath(new URL('../../docs/import/import-template.xlsx', import.meta.url))
