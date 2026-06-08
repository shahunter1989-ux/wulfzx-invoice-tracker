"use client";

export function PrintButton() {
  return (
    <button type="button" className="secondary-button" onClick={() => window.print()}>
      Print
    </button>
  );
}
