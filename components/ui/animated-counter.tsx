"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface AnimatedCounterProps {
  value: number
  duration?: number
  className?: string
  prefix?: string
  suffix?: string
  decimals?: number
}

export function AnimatedCounter({
  value,
  duration = 2,
  className,
  prefix = "",
  suffix = "",
  decimals = 0
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = React.useState(0)
  const valueRef = React.useRef(0)

  React.useEffect(() => {
    const startValue = valueRef.current
    const delta = value - startValue
    if (delta === 0) return

    const durationMs = Math.max(0, duration * 1000)
    if (durationMs === 0) {
      valueRef.current = value
      setDisplayValue(value)
      return
    }

    const start = performance.now()
    let frameId = 0

    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / durationMs, 1)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = startValue + delta * eased
      valueRef.current = next
      setDisplayValue(next)
      if (progress < 1) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [value, duration])

  const formattedValue = React.useMemo(() => {
    const parts = displayValue.toFixed(decimals).split(".");
    parts[0] = Number(parts[0]).toLocaleString();
    const formatted = parts.length > 1 && decimals > 0 ? parts.join(".") : parts[0];
    return `${prefix}${formatted}${suffix}`;
  }, [displayValue, prefix, suffix, decimals]);

  return (
    <span className={cn("tabular-nums", className)}>{formattedValue}</span>
  )
}
