import { Link } from 'react-router'

export function SetApiKeyWarning() {
  return (
    <div className="text-xs bg-warning px-2 rounded-md flex items-center gap-1 border border-warning-border">
      Please set API Key on
      <Link to="/api-keys" className="text-blue-500 hover:underline">API Keys</Link>
      {' '}
      page
    </div>
  )
}
