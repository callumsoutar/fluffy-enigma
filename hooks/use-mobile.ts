import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Start with false to match server-side rendering (no window access)
  const [isMobile, setIsMobile] = React.useState<boolean>(false)
  const [mounted, setMounted] = React.useState<boolean>(false)

  React.useEffect(() => {
    // Mark as mounted on client side
    setMounted(true)
    
    // Only access window after component mounts (client-side only)
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    
    // Initial check
    checkMobile()
    
    // Set up media query listener
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    mql.addEventListener("change", checkMobile)
    
    return () => {
      mql.removeEventListener("change", checkMobile)
    }
  }, [])

  // Return false during SSR and initial render to prevent hydration mismatch
  // Only return actual mobile state after component mounts
  return mounted ? isMobile : false
}
