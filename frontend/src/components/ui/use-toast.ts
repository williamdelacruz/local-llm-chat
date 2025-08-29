// src/components/ui/use-toast.ts

import * as React from "react"
import {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  useToast as useToastShadcn,
} from "./toast"

export function useToast() {
  const { toast } = useToastShadcn()
  return {
    toast,
  }
}

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
}
