"use client";

import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function App() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-light dark:bg-dark p-4 border-b-2 border-slate-200 dark:border-slate-800">
        Convex + React
      </header>
      <main className="p-8 flex flex-col gap-16">
        <h1 className="text-4xl font-bold text-center">Convex + React</h1>
        <ConnectButton />
      </main>
    </>
  );
}
