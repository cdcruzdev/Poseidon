"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { TOKENS, type Token } from "@/lib/tokens";

interface TokenSelectorProps {
  selectedToken: Token | null;
  onSelect: (token: Token) => void;
  excludeToken?: Token | null;
  label?: string;
  amount: string;
  onAmountChange: (amount: string) => void;
  balance?: number;
  maxBalance?: number;
  disabled?: boolean;
  usdPrice?: number;
  tokenBalances?: Record<string, number>;
}

export default function TokenSelector({
  selectedToken,
  onSelect,
  excludeToken,
  label,
  amount,
  onAmountChange,
  balance,
  disabled = false,
  usdPrice = 0,
  tokenBalances = {},
  maxBalance,
}: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredTokens = TOKENS.filter((token) => {
    if (excludeToken && token.symbol === excludeToken.symbol) return false;
    if (!search) return true;
    return (
      token.symbol.toLowerCase().includes(search.toLowerCase()) ||
      token.name.toLowerCase().includes(search.toLowerCase())
    );
  }).sort((a, b) => {
    const balA = tokenBalances[a.symbol] || 0;
    const balB = tokenBalances[b.symbol] || 0;
    if (balA > 0 && balB <= 0) return -1;
    if (balB > 0 && balA <= 0) return 1;
    return 0;
  });

  const handleSelect = (token: Token) => {
    onSelect(token);
    setIsOpen(false);
    setSearch("");
  };

  const handleMaxClick = () => {
    const max = maxBalance !== undefined ? maxBalance : balance;
    if (max !== undefined) {
      onAmountChange(parseFloat(max.toFixed(4)).toString());
    }
  };

  return (
    <div className="bg-[#0d1d30]/80 rounded-xl p-4 border border-[#1a3050] transition-colors hover:border-[#2a4060]">
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-[#7090a0]">{label}</span>
          <span className="text-sm text-[#7090a0]">
            Balance: <span className="text-[#ffffff]">{(balance ?? 0).toFixed(4)}</span>
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* Token Selector Button */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            className="flex items-center gap-2 px-3 py-2 bg-[#0a1520]/80 rounded-lg border border-[#1a3050] hover:border-[#2a4060] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selectedToken ? (
              <>
                <Image
                  src={selectedToken.logo}
                  alt={selectedToken.symbol}
                  width={28}
                  height={28}
                  className="rounded-full"
                  unoptimized
                />
                <span className="font-semibold">{selectedToken.symbol}</span>
              </>
            ) : (
              <span className="text-[#5a7090]">Select</span>
            )}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {/* Dropdown */}
          {isOpen && (
            <div
              className="absolute top-full left-0 mt-2 w-64 bg-[#0a1520]/95 backdrop-blur-md border border-[#1a3050] rounded-xl shadow-xl shadow-black/50 z-50 overflow-hidden animate-dropdown-in"
              style={{ transformOrigin: "top center" }}
            >
              {/* Search */}
              <div className="p-3 border-b border-[#1a3050]">
                <input
                  type="text"
                  placeholder="Search tokens..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0d1d30]/80 border border-[#1a3050] rounded-lg focus:border-[#2a4060] focus:outline-none text-sm"
                  autoFocus
                />
              </div>

              {/* Token List */}
              <div className="max-h-60 overflow-y-auto">
                {filteredTokens.length === 0 ? (
                  <div className="p-4 text-center text-[#5a7090] text-sm">
                    No tokens found
                  </div>
                ) : (
                  filteredTokens.map((token) => {
                    const bal = tokenBalances[token.symbol];
                    return (
                      <button
                        key={token.symbol}
                        onClick={() => handleSelect(token)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1a3050]/50 transition-colors cursor-pointer"
                      >
                        <Image
                          src={token.logo}
                          alt={token.symbol}
                          width={36}
                          height={36}
                          className="rounded-full"
                          unoptimized
                        />
                        <div className="text-left flex-1">
                          <div className="font-medium">{token.symbol}</div>
                          <div className="text-xs text-[#5a7090]">{token.name}</div>
                        </div>
                        {bal !== undefined && bal > 0 && (
                          <span className="text-sm text-[#5a7090]/70 font-mono">
                            {bal < 0.0001 ? "<0.0001" : bal < 1 ? bal.toFixed(4) : bal < 1000 ? bal.toFixed(2) : bal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Amount Input */}
        <div className="flex-1 relative">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              let v = e.target.value.replace(/[^0-9.]/g, '');
              const parts = v.split('.');
              if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
              if (parts.length === 2 && parts[1].length > 4) v = parts[0] + '.' + parts[1].slice(0, 4);
              onAmountChange(v);
            }}
            placeholder="0.00"
            disabled={disabled}
            className="w-full bg-transparent text-xl sm:text-2xl font-semibold text-right focus:outline-none placeholder-[#5a7090] disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Max Button */}
        {balance !== undefined && balance > 0 && (
          <button
            onClick={handleMaxClick}
            disabled={disabled}
            className="px-2 py-1 text-xs font-semibold text-[#7ec8e8] bg-[#7ec8e8]/10 rounded-md hover:bg-[#7ec8e8]/20 transition-colors disabled:opacity-50"
          >
            MAX
          </button>
        )}
      </div>

      {/* USD Value - always rendered, animated visibility */}
      <div className={`overflow-hidden transition-all duration-200 ease-out text-right text-sm text-[#5a7090] ${
        amount && parseFloat(amount) > 0 && usdPrice > 0 ? "max-h-8 opacity-100 mt-2" : "max-h-0 opacity-0 mt-0"
      }`}>
        ~ ${(parseFloat(amount || "0") * usdPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </div>
  );
}
