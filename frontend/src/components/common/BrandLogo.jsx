export default function BrandLogo({ className = '', imageClassName = '', alt = '' }) {
  return <span className={`inline-grid shrink-0 place-items-center overflow-hidden ${className}`}><img src="/icu.png" alt={alt} className={`h-full w-full object-contain ${imageClassName}`} /></span>
}
