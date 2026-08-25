export default function SourceReference({ source, number, onSelect }) {
  const label = `[${number}]`
  const title = source.page
    ? `${source.fileName} · Page ${source.page}`
    : `${source.fileName} · Retrieved passage ${source.chunkIndex != null ? source.chunkIndex + 1 : number}`
  const className = 'citation-reference mx-0.5 inline-flex min-w-[1.45rem] items-center justify-center rounded-md border border-teal/25 bg-teal/[.08] px-1.5 py-0.5 align-baseline text-[10px] font-bold leading-none text-[#087f75] no-underline transition hover:-translate-y-px hover:border-teal/60 hover:bg-teal/[.14] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brandblue'

  if (onSelect) {
    return <button type="button" onClick={() => onSelect(source)} title={`Open source: ${title}`} aria-label={`Open source ${number}: ${title}`} className={className}>{label}</button>
  }
  if (source.url) {
    return <a href={source.url} target="_blank" rel="noreferrer" title={title} className={className}>{label}</a>
  }
  return <span title={title} className={className}>{label}</span>
}
