interface Props {
  src: string
  alt: string
  className?: string
}

/** A "screenshot inside a browser window" chrome, used throughout the marketing page. */
export function BrowserFrame({ src, alt, className }: Props) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-white/10 bg-[#0b0b12] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] ${className ?? ''}`}
    >
      <div className="flex items-center gap-1.5 border-b border-white/5 bg-white/[0.03] px-3 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
      </div>
      <img src={src} alt={alt} className="block w-full" loading="lazy" />
    </div>
  )
}
