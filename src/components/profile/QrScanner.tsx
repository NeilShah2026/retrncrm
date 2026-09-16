import * as React from 'react'
import { Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isNative } from '@/lib/platform'

type State = 'idle' | 'starting' | 'scanning' | 'error'

/** How often frames are actually decoded. Every frame is wasted battery. */
const DECODE_EVERY_MS = 100
/** Frames are scaled down to this before decoding — plenty for a QR code. */
const DECODE_WIDTH = 480

/**
 * The camera, decoding QR codes in the page rather than through a native
 * scanner plugin: `getUserMedia` works inside the iOS WebView (with
 * `NSCameraUsageDescription` in Info.plist) and jsQR reads the frames, so
 * this behaves the same in the app, in a phone browser and on a desktop
 * with a webcam — and adds no native dependency to build or review.
 *
 * jsQR is loaded on demand, so it costs nothing until someone scans.
 */
export function QrScanner({ onScan }: { onScan: (text: string) => void }) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const [state, setState] = React.useState<State>('idle')
  const [error, setError] = React.useState<string | null>(null)
  // Kept in a ref so the loop always calls the latest handler.
  const onScanRef = React.useRef(onScan)
  onScanRef.current = onScan

  const stop = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  // Whatever happens, the camera light goes out when this leaves the screen.
  React.useEffect(() => stop, [stop])

  async function start() {
    setState('starting')
    setError(null)
    try {
      const [{ default: jsQR }, stream] = await Promise.all([
        import('jsqr'),
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        }),
      ])
      streamRef.current = stream
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
      setState('scanning')

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      let last = 0
      const tick = (now: number) => {
        if (!streamRef.current || !ctx) return
        if (now - last >= DECODE_EVERY_MS && video.readyState >= video.HAVE_CURRENT_DATA) {
          last = now
          const scale = Math.min(1, DECODE_WIDTH / (video.videoWidth || DECODE_WIDTH))
          canvas.width = Math.round(video.videoWidth * scale)
          canvas.height = Math.round(video.videoHeight * scale)
          if (canvas.width > 0 && canvas.height > 0) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const code = jsQR(frame.data, frame.width, frame.height, {
              inversionAttempts: 'dontInvert',
            })
            if (code?.data) {
              stop()
              setState('idle')
              onScanRef.current(code.data)
              return
            }
          }
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    } catch (err) {
      stop()
      setState('error')
      setError(cameraMessage(err))
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-[14px] bg-foreground/[0.06]">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
          autoPlay
          aria-label="Camera"
        />
        {state !== 'scanning' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <Camera className="h-7 w-7 text-muted-foreground" strokeWidth={1.8} />
            <p className="text-ios-subhead text-muted-foreground">
              {state === 'error'
                ? error
                : state === 'starting'
                  ? 'Starting the camera…'
                  : 'Point your camera at someone’s Retrn code.'}
            </p>
            <Button
              className="mt-1"
              onClick={() => void start()}
              disabled={state === 'starting'}
              loading={state === 'starting'}
            >
              {state === 'error' ? 'Try again' : 'Open camera'}
            </Button>
          </div>
        )}
        {state === 'scanning' && (
          // A viewfinder: four corners over a dimmed frame, so it's obvious
          // where the code has to sit.
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute inset-[14%] rounded-[18px] shadow-[0_0_0_100vmax_rgba(0,0,0,0.35)]" />
            <div className="absolute inset-[14%] rounded-[18px] border-2 border-white/90" />
          </div>
        )}
      </div>

      {state === 'scanning' && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            stop()
            setState('idle')
          }}
        >
          Stop scanning
        </Button>
      )}
    </div>
  )
}

/** Camera failures, as something a person can act on. */
function cameraMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return isNative
      ? 'Retrn doesn’t have camera access. Turn it on in Settings → Retrn.'
      : 'Your browser blocked the camera. Allow it for this site and try again.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No camera on this device.'
  }
  if (name === 'NotReadableError') {
    return 'Something else is using the camera. Close it and try again.'
  }
  return 'Couldn’t start the camera.'
}
