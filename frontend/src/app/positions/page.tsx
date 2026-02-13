"use client";

import Navbar from "@/components/Navbar";
import MyPositions from "@/components/MyPositions";

export default function PositionsPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <MyPositions />
        </div>
      </main>
    </div>
  );
}
