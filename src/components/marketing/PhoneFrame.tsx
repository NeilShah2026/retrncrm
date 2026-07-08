interface Props {
  src: string
  alt: string
  className?: string
}

/** An iPhone-style device frame for showing a screen at mobile viewport. */
export function PhoneFrame({ src, alt, className }: Props) {
  return (
    <div
      className={`relative mx-auto w-[260px] rounded-[2.6rem] border-[10px] border-[#0b0b12] bg-[#0b0b12] shadow-[0_40px_90px_-25px_rgba(0,0,0,0.65)] ${className ?? ''}`}
    >
      <div className="relative overflow-hidden rounded-[2rem]">
        <img src={src} alt={alt} className="block w-full" loading="lazy" />
        {/* Dynamic-island style notch */}
        <div className="absolute left-1/2 top-2.5 h-6 w-24 -translate-x-1/2 rounded-full bg-[#0b0b12]" />
      </div>
      {/* Home indicator */}
      <div className="absolute bottom-2 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-white/25" />
    </div>
  )
}
