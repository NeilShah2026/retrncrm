import * as React from 'react'
import { isNative } from '@/lib/platform'

// Loaded lazily (and cached) rather than imported at module top: this file
// is also reachable from the shared web bundle, and a static import would
// ship the plugin's native-bridge JS there even though it would never run —
// `useSpeechRecognition` only ever calls into it when `isNative` is true.
let speechModule: Promise<typeof import('@capacitor-community/speech-recognition')> | null = null
function loadNativeSpeechRecognition() {
  return (speechModule ??= import('@capacitor-community/speech-recognition'))
}

/**
 * Dictation, via whichever engine the platform actually has.
 *
 * On the web this is the browser's built-in Web Speech API — free, no key,
 * no audio ever touches our servers. That API does not exist inside a
 * Capacitor WKWebView on iOS at all (it's a Safari-process-only capability),
 * so native builds instead use `@capacitor-community/speech-recognition`,
 * which wraps iOS's on-device `SFSpeechRecognizer` — same "nothing leaves
 * the device" property, different plumbing. Either way this hook exposes the
 * exact same {supported, listening, transcript, interim, error, start, stop,
 * reset} shape, so nothing above it (VoiceCaptureDialog, AssistantChat) has
 * to know which engine is running.
 */

export interface SpeechRecognitionState {
  /** The platform can transcribe. False → show the typing fallback. */
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

export function useSpeechRecognition(): SpeechRecognitionState {
  // `isNative` is a module-level constant fixed for the app's entire life —
  // this branch is the same on every render of a given app instance, so it
  // never actually violates the rules of hooks despite the shape.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return isNative ? useNativeSpeechRecognition() : useWebSpeechRecognition()
}

// --- Native: @capacitor-community/speech-recognition (iOS SFSpeechRecognizer) ----

function useNativeSpeechRecognition(): SpeechRecognitionState {
  const [supported, setSupported] = React.useState(false)
  const [listening, setListening] = React.useState(false)
  const [transcript, setTranscript] = React.useState('')
  const [interim, setInterim] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  // Mirrors `interim` synchronously so `finalize()` can read the latest
  // value without taking a dependency that would re-create `stop`/`start`.
  const interimRef = React.useRef('')
  const listeningRef = React.useRef(false)

  React.useEffect(() => {
    let active = true
    let partialHandle: { remove: () => void } | undefined
    let stateHandle: { remove: () => void } | undefined

    void loadNativeSpeechRecognition().then(({ SpeechRecognition }) => {
      if (!active) return

      SpeechRecognition.available()
        .then(({ available }) => {
          if (active) setSupported(available)
        })
        .catch(() => {
          if (active) setSupported(false)
        })

      void SpeechRecognition.addListener(
        'partialResults',
        (data: { matches?: string[] }) => {
          const text = data.matches?.[0] ?? ''
          interimRef.current = text
          setInterim(text)
        },
      ).then((h) => {
        if (active) partialHandle = h
        else void h.remove()
      })

      // Safety net alongside `start()`'s own promise resolving below — some
      // plugin versions only reliably signal end-of-utterance one way or
      // the other.
      void SpeechRecognition.addListener(
        'listeningState',
        (data: { status: string }) => {
          if (data.status === 'stopped' && listeningRef.current) finalize()
        },
      ).then((h) => {
        if (active) stateHandle = h
        else void h.remove()
      })
    })

    return () => {
      active = false
      partialHandle?.remove()
      stateHandle?.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Moves whatever's in `interim` into `transcript` and clears it. */
  const finalize = React.useCallback((finalText?: string) => {
    listeningRef.current = false
    setListening(false)
    const chunk = (finalText ?? interimRef.current).trim()
    if (chunk) setTranscript((prev) => `${prev} ${chunk}`.trim())
    interimRef.current = ''
    setInterim('')
  }, [])

  const start = React.useCallback(() => {
    if (listeningRef.current) return
    setError(null)
    void (async () => {
      try {
        const { SpeechRecognition } = await loadNativeSpeechRecognition()
        const perm = await SpeechRecognition.requestPermissions()
        if (perm.speechRecognition !== 'granted') {
          setError(
            'Speech recognition access was blocked — allow it for Retrn in Settings to dictate.',
          )
          return
        }
        listeningRef.current = true
        setListening(true)
        interimRef.current = ''
        setInterim('')
        // Resolves once the recognizer stops — by our own `stop()` below, or
        // iOS ending the utterance on its own after a pause.
        const result = await SpeechRecognition.start({
          language: navigator.language || 'en-US',
          partialResults: true,
          popup: false,
        })
        if (listeningRef.current) finalize(result?.matches?.[0])
      } catch {
        listeningRef.current = false
        setListening(false)
        setError('Dictation stopped unexpectedly.')
      }
    })()
  }, [finalize])

  const stop = React.useCallback(() => {
    if (!listeningRef.current) return
    finalize()
    void loadNativeSpeechRecognition().then(({ SpeechRecognition }) =>
      SpeechRecognition.stop().catch(() => {
        // Already stopped.
      }),
    )
  }, [finalize])

  const reset = React.useCallback(() => {
    setTranscript('')
    setInterim('')
    interimRef.current = ''
    setError(null)
  }, [])

  return { supported, listening, transcript, interim, error, start, stop, reset }
}

// --- Web: the browser's built-in Web Speech API ----------------------------

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

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone access was blocked — allow it in your browser to dictate.',
  'service-not-allowed': 'Microphone access was blocked — allow it in your browser to dictate.',
  'audio-capture': 'No microphone found.',
  network: 'Speech recognition needs a network connection.',
}

function useWebSpeechRecognition(): SpeechRecognitionState {
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
