import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

const Toaster = ({
  ...props
}) => {
  const { theme = "light" } = useTheme()

  return (
    <Sonner
      theme={theme === 'dark' ? 'dark' : 'light'}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white dark:group-[.toaster]:bg-slate-900 group-[.toaster]:text-slate-900 dark:group-[.toaster]:text-slate-100 group-[.toaster]:border-slate-200 dark:group-[.toaster]:border-slate-700 group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-slate-600 dark:group-[.toast]:text-slate-400",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-slate-100 dark:group-[.toast]:bg-slate-800 group-[.toast]:text-slate-700 dark:group-[.toast]:text-slate-300",
          success: "group-[.toast]:bg-green-50 dark:group-[.toast]:bg-green-900/30 group-[.toast]:text-green-900 dark:group-[.toast]:text-green-100 group-[.toast]:border-green-200 dark:group-[.toast]:border-green-800",
          error: "group-[.toast]:bg-red-50 dark:group-[.toast]:bg-red-900/30 group-[.toast]:text-red-900 dark:group-[.toast]:text-red-100 group-[.toast]:border-red-200 dark:group-[.toast]:border-red-800",
          warning: "group-[.toast]:bg-blue-50 dark:group-[.toast]:bg-blue-900/30 group-[.toast]:text-blue-900 dark:group-[.toast]:text-blue-100 group-[.toast]:border-blue-200 dark:group-[.toast]:border-blue-800",
          info: "group-[.toast]:bg-blue-50 dark:group-[.toast]:bg-blue-900/30 group-[.toast]:text-blue-900 dark:group-[.toast]:text-blue-100 group-[.toast]:border-blue-200 dark:group-[.toast]:border-blue-800",
        },
      }}
      {...props} />
  );
}

export { Toaster, toast }
