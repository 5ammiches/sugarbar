import { useState } from "react"

interface ToastProps {
  title: string
  description?: string
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastProps[]>([])

  const toast = ({ title, description }: ToastProps) => {
    const newToast = { title, description }
    setToasts(prev => [...prev, newToast])
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t !== newToast))
    }, 3000)
  }

  return { toast, toasts }
}

export const toast = ({ title, description }: ToastProps) => {
  alert(`${title}: ${description}`)
} 