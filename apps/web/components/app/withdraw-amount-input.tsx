"use client";

/**
 * WithdrawAmountInput — inline numeric input for withdraw-settled actions.
 *
 * Shows the settled balance, defaults to max. User can enter any positive
 * amount up to the settled balance. "Max" button resets to max. Confirm
 * calls back with the human-readable amount string.
 */

import { useState, useCallback } from "react";

interface WithdrawAmountInputProps {
  coinSymbol: string;
  maxAmount: number; // human-readable settled balance
  onConfirm: (humanAmount: string) => void;
  onCancel: () => void;
}

export function WithdrawAmountInput({
  coinSymbol,
  maxAmount,
  onConfirm,
  onCancel,
}: WithdrawAmountInputProps) {
  const [value, setValue] = useState(maxAmount.toString());
  const parsed = parseFloat(value);
  const isValid =
    !isNaN(parsed) && parsed > 0 && parsed <= maxAmount + 1e-10;

  const handleMax = useCallback(() => {
    setValue(maxAmount.toString());
  }, [maxAmount]);

  const handleConfirm = useCallback(() => {
    if (!isValid) return;
    onConfirm(parsed.toString());
  }, [isValid, onConfirm, parsed]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "12px 14px",
        border: "1px solid var(--border)",
        borderRadius: 12,
        background: "var(--bg-elev)",
        maxWidth: 340,
      }}
    >
      {/* Label row */}
      <div className="flex items-center justify-between" style={{ fontSize: 12, color: "var(--fg-muted)" }}>
        <span>
          Withdraw <span className="split-mono">{coinSymbol}</span>
        </span>
        <span className="mono" style={{ fontSize: 11 }}>
          max {maxAmount.toLocaleString("en-US", { maximumFractionDigits: 6 })}
        </span>
      </div>

      {/* Input row */}
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={maxAmount}
          step="any"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0.0"
          style={{
            flex: 1,
            height: 38,
            padding: "0 10px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--bg-sub)",
            color: "var(--fg)",
            fontSize: 14,
            fontFamily: "var(--font-mono, monospace)",
            outline: "none",
          }}
          aria-label={`Amount to withdraw in ${coinSymbol}`}
        />
        <button
          type="button"
          onClick={handleMax}
          style={{
            height: 38,
            padding: "0 12px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--bg-sub)",
            color: "var(--fg-muted)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Max
        </button>
      </div>

      {/* Validation hint */}
      {!isValid && value !== "" && (
        <span style={{ fontSize: 11, color: "var(--destructive)" }}>
          {parsed <= 0
            ? "Amount must be greater than 0"
            : `Amount exceeds settled balance (${maxAmount})`}
        </span>
      )}

      {/* CTA row */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          style={{
            flex: 1,
            height: 38,
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--bg-elev)",
            color: "var(--fg)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!isValid}
          onClick={handleConfirm}
          style={{
            flex: 1,
            height: 38,
            border: "none",
            borderRadius: 8,
            background: "var(--accent)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: isValid ? "pointer" : "not-allowed",
            opacity: isValid ? 1 : 0.4,
          }}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
