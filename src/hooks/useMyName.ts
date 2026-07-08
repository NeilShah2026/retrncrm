import * as React from 'react'

const KEY = 'retrn-my-name'

/** Persists the user's own name locally, used to mail-merge {{myName}}. */
export function useMyName(): [string, (name: string) => void] {
  const [name, setNameState] = React.useState(
    () => localStorage.getItem(KEY) ?? '',
  )

  const setName = React.useCallback((next: string) => {
    localStorage.setItem(KEY, next)
    setNameState(next)
  }, [])

  return [name, setName]
}
