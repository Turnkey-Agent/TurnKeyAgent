"use client";

import { useState } from "react";
import { CheckCircle, Star, Clock, DollarSign, Briefcase, ChevronDown, ChevronUp } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { Quote } from "@/lib/types";

interface QuoteComparisonProps {
  quotes: Quote[];
  incidentId: string;
  approvedVendorId: string | null;
  onApprove: (vendorId: string) => Promise<void>;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      <Star size={10} className="fill-yellow-400 text-yellow-400" />
      <span className="text-[11px] text-yellow-400 font-medium">{rating.toFixed(1)}</span>
    </div>
  );
}

function QuoteCard({
  quote,
  isRecommended,
  isApproved,
  isDisabled,
  onApprove,
}: {
  quote: Quote;
  isRecommended: boolean;
  isApproved: boolean;
  isDisabled: boolean;
  onApprove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    try {
      await onApprove();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "relative rounded-xl border p-4 flex flex-col gap-3 transition-all",
        isApproved
          ? "border-emerald-500/40 bg-emerald-500/5"
          : isRecommended
          ? "border-blue-500/40 bg-blue-500/5"
          : "border-[var(--border)] bg-[var(--surface)]",
        isDisabled && !isApproved && "opacity-40"
      )}
    >
      {(isRecommended || isApproved) && (
        <div
          className={cn(
            "absolute -top-2.5 left-4 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
            isApproved
              ? "bg-emerald-900 border-emerald-500/50 text-emerald-300"
              : "bg-blue-900 border-blue-500/50 text-blue-300"
          )}
        >
          {isApproved ? "✓ Approved" : "✦ AI Recommended"}
        </div>
      )}

      <div className="mt-1">
        <p className="text-sm font-semibold text-[var(--text)]">{quote.vendor_name}</p>
        <StarRating rating={quote.vendor_rating} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5 bg-[var(--surface-2)] rounded-lg px-2.5 py-2">
          <DollarSign size={12} className="text-green-400" />
          <span className="text-sm font-bold text-[var(--text)]">
            {formatCurrency(quote.amount)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-[var(--surface-2)] rounded-lg px-2.5 py-2">
          <Clock size={12} className="text-orange-400" />
          <span className="text-sm font-bold text-[var(--text)]">{quote.eta_days}d</span>
        </div>
        <div className="col-span-2 flex items-center gap-1.5 bg-[var(--surface-2)] rounded-lg px-2.5 py-2">
          <Briefcase size={12} className="text-blue-400" />
          <span className="text-[11px] text-[var(--text-subtle)]">
            <span className="text-[var(--text)] font-medium">{quote.vendor_jobs_on_property}</span>{" "}
            prior jobs on this property
          </span>
        </div>
      </div>

      {quote.call_transcript && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-subtle)] transition-colors"
          >
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            Call transcript
          </button>
          {expanded && (
            <div className="mt-2 text-[10px] text-[var(--text-muted)] bg-[var(--background)] rounded-lg p-2.5 leading-relaxed border border-[var(--border)] max-h-24 overflow-y-auto">
              {quote.call_transcript}
            </div>
          )}
        </div>
      )}

      {!isApproved && !isDisabled && (
        <button
          onClick={handleApprove}
          disabled={loading}
          className={cn(
            "w-full py-2 rounded-lg text-xs font-semibold transition-all border",
            isRecommended
              ? "bg-blue-600 hover:bg-blue-500 border-blue-500 text-white"
              : "bg-[var(--surface-2)] hover:bg-[var(--border)] border-[var(--border)] text-[var(--text-subtle)] hover:text-[var(--text)]",
            loading && "opacity-60 cursor-wait"
          )}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              Approving...
            </span>
          ) : isRecommended ? (
            "Approve (Recommended)"
          ) : (
            "Override & Approve"
          )}
        </button>
      )}

      {isApproved && (
        <div className="flex items-center justify-center gap-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle size={13} className="text-emerald-400" />
          <span className="text-xs font-medium text-emerald-400">Approved — Agent resuming</span>
        </div>
      )}
    </div>
  );
}

export function QuoteComparison({
  quotes,
  incidentId,
  approvedVendorId,
  onApprove,
}: QuoteComparisonProps) {
  if (quotes.length === 0) return null;

  const recommended = quotes.find((q) => q.recommended);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--text)] uppercase tracking-wider">
          Quote Comparison
        </span>
        <span className="text-[10px] text-[var(--text-muted)]">
          {quotes.length} vendor{quotes.length > 1 ? "s" : ""} responded
        </span>
      </div>

      {recommended && !approvedVendorId && (
        <div className="flex items-start gap-2.5 bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
          <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-[10px]">✦</span>
          </div>
          <div>
            <p className="text-xs font-medium text-blue-300">
              Gemini recommends {recommended.vendor_name}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
              {formatCurrency(recommended.amount)} · {recommended.eta_days} days · best price/speed
              ratio for this property
            </p>
          </div>
        </div>
      )}

      <div
        className={cn(
          "grid gap-3",
          quotes.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
        )}
      >
        {quotes.map((quote) => (
          <QuoteCard
            key={quote.vendor_id}
            quote={quote}
            isRecommended={quote.vendor_id === recommended?.vendor_id}
            isApproved={quote.vendor_id === approvedVendorId}
            isDisabled={!!approvedVendorId && quote.vendor_id !== approvedVendorId}
            onApprove={() => onApprove(quote.vendor_id)}
          />
        ))}
      </div>
    </div>
  );
}
