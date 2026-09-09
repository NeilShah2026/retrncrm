interface Props {
  title: string
  description?: string
  /** Actions. One primary at most; the rest outline or ghost. */
  children?: React.ReactNode
}

/** Page title row. 20px title, one-line description, actions on the right. */
export function PageHeader({ title, description, children }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-[-0.02em]">{title}</h1>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  )
}
