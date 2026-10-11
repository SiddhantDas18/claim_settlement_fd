import { useEffect, useState } from 'react'

// Minimal hash router: #/claims/12 -> ['claims', '12']. Enough for this app, no dependency needed.
function current(): string[] {
  return window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
}

export function useRoute(): string[] {
  const [route, setRoute] = useState(current)
  useEffect(() => {
    const onChange = () => setRoute(current())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function navigate(path: string): void {
  window.location.hash = path
}
