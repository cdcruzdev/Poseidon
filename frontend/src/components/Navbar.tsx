"use client";

import Link from "next/link";
import Image from "next/image";
import WalletButton from "./WalletButton";

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 pointer-events-auto">
            <Image
              src="/poseidon-icon.png"
              alt="Poseidon"
              width={40}
              height={40}
              className="rounded-lg"
            />
            <span className="text-lg sm:text-xl tracking-widest text-[#e0e8f0]" style={{ fontFamily: 'var(--font-bebas)' }}>
              POSEIDON
            </span>
          </Link>

          {/* Wallet Button */}
          <div className="flex items-center gap-4 pointer-events-auto">
            <WalletButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
