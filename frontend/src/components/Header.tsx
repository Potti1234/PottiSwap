import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ModeToggle } from "./mode-toggle";

export function Header() {
  return (
    <header className="sticky top-0 z-10 bg-white dark:bg-gray-900 p-4 border-b-2 border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">PottiSwap</h1>
        </div>
        <div className="flex items-center gap-4">
          <ModeToggle />
          <ConnectButton />
        </div>
      </div>
    </header>
  );
} 