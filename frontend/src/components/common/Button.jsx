export default function Button({ children, className = '', ...props }) {
  return <button className={`transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal ${className}`} {...props}>{children}</button>
}
