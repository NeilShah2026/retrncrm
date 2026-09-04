import * as React from 'react'

/**
 * Dictation via the browser's built-in Web Speech API.
 *
 * This is deliberately *not* a paid transcription service: Chrome, Edge and
 * Safari all ship speech recognition, it costs nothing, needs no key, and no
 * audio ever touches our servers. Browsers without it (Firefox today) fall
 * back to typing — phone keyboards have their own dictation button, which is
 * the same free capability by another route.
 */

// The API is still vendor-prefixed and isn't in TypeScript's DOM lib.
interface SpeechRecognitionAlternativeLike {
  transcript: string
}
interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: SpeechRecognitionAlternativeLike
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: {
    length: number
    [index: number]: SpeechRecognitionResultLike
  }
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export interface SpeechRecognitionState {
  /** The browser can transcribe. False → show the typing fallback. */
  supported: boolean
  listening: boolean
  /** Everything recognised so far this session (finalised phrases only). */
  transcript: string
  /** The phrase currently being spoken, not yet finalised. */
  interim: string
  /** Human-readable problem, e.g. a denied mic permission. */
  error: string | null
  start: () => void
  stop: () => void
  reset: () => void
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone access was blocked — allow it in your browser to dictate.',
  'service-not-allowed': 'Microphone access was blocked — allow it in your browser to dictate.',
  'audio-capture': 'No microphone found.',
  network: 'Speech recognition needs a network connection.',
}

export function useSpeechRecognition(): SpeechRecognitionState {
  const [supported] = React.useState(() => Boolean(getCtor()))
  const [listening, setListening] = React.useState(false)
  const [transcript, setTranscript] = React.useState('')
  const [interim, setInterim] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null)
  // Chrome ends a recognition session on its own after a pause. While the
  // user hasn't pressed stop, restart it so a thinking pause doesn't cut
  // them off mid-sentence.
  const wantListeningRef = React.useRef(false)

  React.useEffect(() => {
    const Ctor = getCtor()
    if (!Ctor) return

    const recognition = new Ctor()
    recognition.lang = navigator.language || 'en-US'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (e) => {
      let finalChunk = ''
      let interimChunk = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        if (result.isFinal) finalChunk += result[0].transcript
        else interimChunk += result[0].transcript
      }
      if (finalChunk) {
        setTranscript((prev) => `${prev} ${finalChunk.trim()}`.trim())
      }
      setInterim(interimChunk.trim())
    }

    recognition.onerror = (e) => {
      // "no-speech" and "aborted" are normal end-of-utterance noise.
      if (e.error === 'no-speech' || e.error === 'aborted') return
      wantListeningRef.current = false
      setListening(false)
      setError(ERROR_MESSAGES[e.error] ?? 'Dictation stopped unexpectedly.')
    }

    recognition.onend = () => {
      if (wantListeningRef.current) {
        try {
          recognition.start()
          return
        } catch {
          // Already restarting — fall through and report as stopped.
        }
      }
      setListening(false)
      setInterim('')
    }

    recognitionRef.current = recognition
    return () => {
      wantListeningRef.current = false
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      try {
        recognition.abort()
      } catch {
        // Nothing to abort.
      }
      recognitionRef.current = null
    }
  }, [])

  const start = React.useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition || wantListeningRef.current) return
    setError(null)
    wantListeningRef.current = true
    try {
      recognition.start()
      setListening(true)
    } catch {
      // start() throws if it's already running — treat that as listening.
      setListening(true)
    }
  }, [])

  const stop = React.useCallback(() => {
    const recognition = recognitionRef.current
    wantListeningRef.current = false
    setListening(false)
    if (!recognition) return
    try {
      recognition.stop()
    } catch {
      // Already stopped.
    }
  }, [])

  const reset = React.useCallback(() => {
    setTranscript('')
    setInterim('')
    setError(null)
  }, [])

  return { supported, listening, transcript, interim, error, start, stop, reset }
}
