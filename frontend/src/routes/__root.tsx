import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { ThemeProvider } from "@/components/theme-provider"
import { Header } from "@/components/Header"

export const Route = createRootRoute({
  component: () => (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Header />
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <Outlet />
      </main>
      <TanStackRouterDevtools />
    </ThemeProvider>
  ),
})