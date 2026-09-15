import { isNative } from '@/lib/platform'

type HapticsModule = typeof import('@capacitor/haptics')

let modulePromise: Promise<HapticsModule> | null = null

/**
 * Physical feedback for touches that commit to something. Native-only, and
 * deliberately fire-and-forget: the plugin is imported dynamically so none of
 * its JS reaches the web bundle this same `src/` also builds, and a haptic
 * that fails must never interrupt the interaction it was decorating (a device
 * with no Taptic Engine, or the Simulator, simply does nothing).
 */
function run(effect: (m: HapticsModule) => Promise<void>): void {
  if (!isNative) return
  modulePromise ??= import('@capacitor/haptics')
  void modulePromise.then(effect).catch(() => {})
}

/** Moving between equivalent options: a tab, a segment, a picker row. */
export function selectionFeedback(): void {
  run(({ Haptics }) => Haptics.selectionChanged())
}

/** A tap that did something small: a button, a row, a toggle. */
export function tapFeedback(): void {
  run(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
}

/** Something substantial opened or closed: a sheet, a dialog. */
export function impactFeedback(): void {
  run(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Medium }))
}

/** A task finished. */
export function successFeedback(): void {
  run(({ Haptics, NotificationType }) =>
    Haptics.notification({ type: NotificationType.Success }),
  )
}

/** A task failed, or input was rejected. */
export function errorFeedback(): void {
  run(({ Haptics, NotificationType }) =>
    Haptics.notification({ type: NotificationType.Error }),
  )
}
