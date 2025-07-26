import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  return (
    <div className="p-8 flex flex-col gap-16">
      <h1 className="text-4xl font-bold text-center">Welcome to PottiSwap</h1>
      <div className="text-center">
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Your decentralized exchange platform
        </p>
      </div>
    </div>
  )
}