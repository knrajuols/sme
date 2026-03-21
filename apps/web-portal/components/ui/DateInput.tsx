'use client';

import React, { useEffect, useState } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Converts a raw digit string (up to 8 digits) to a DD/MM/YYYY display string.
 * e.g. "14032026" → "14/03/2026", "140" → "14/0"
 */
function digitsToDisplay(digits: string): string {
  const d = digits.slice(0, 8);
  let result = d.slice(0, 2);
  if (d.length > 2) result += '/' + d.slice(2, 4);
  if (d.length > 4) result += '/' + d.slice(4, 8);
  return result;
}

/** Converts YYYY-MM-DD → DD/MM/YYYY for seeding the display from a parent value. */
function isoToDisplay(iso: string): string {
  if (!iso || iso.length < 10) return '';
  const [yyyy, mm, dd] = iso.split('-');
  if (!yyyy || !mm || !dd) return '';
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Validates a complete DD/MM/YYYY string and returns YYYY-MM-DD if valid.
 * Returns '' for incomplete or calendar-invalid dates (e.g. 31/02/2025).
 */
function displayToIso(display: string): string {
  if (display.length < 10) return '';
  const parts = display.split('/');
  if (parts.length !== 3 || parts[0].length !== 2 || parts[1].length !== 2 || parts[2].length !== 4) return '';
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return '';
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) return '';
  // Real calendar check — rejects 30/02/2025 etc.
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return '';
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DateInputProps {
  /** Current value in YYYY-MM-DD format (or empty string). */
  value: string;
  /** Fires with the new YYYY-MM-DD ISO string, or '' when the field is cleared/incomplete. */
  onValueChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  /** Hard upper bound in YYYY-MM-DD format — e.g. today for attendance records. */
  maxDate?: string;
  /** Hard lower bound in YYYY-MM-DD format — e.g. startDate for endDate fields. */
  minDate?: string;
}

/**
 * DateInput — manual date entry in DD/MM/YYYY format.
 *
 * Accepts and emits dates as YYYY-MM-DD ISO strings, making it a drop-in
 * replacement for <input type="date"> without exposing the native calendar
 * picker (which is laborious for selecting historical birth / founding years).
 *
 * Issue-238: Replaces all native date pickers across web-portal.
 */
export function DateInput({
  value,
  onValueChange,
  className,
  disabled,
  maxDate,
  minDate,
}: DateInputProps) {
  const [display, setDisplay] = useState<string>(() => isoToDisplay(value));
  const [rangeError, setRangeError] = useState<string>('');

  // Sync display when the parent resets the form or opens the edit panel.
  useEffect(() => {
    setDisplay(isoToDisplay(value));
    if (!value) setRangeError('');
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    // Strip any non-digit characters the user may have typed (e.g. dashes, dots)
    // and reformat to DD/MM/YYYY with auto-inserted slashes.
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    const formatted = digitsToDisplay(digits);
    setDisplay(formatted);

    const iso = displayToIso(formatted);
    if (iso) {
      if (maxDate && iso > maxDate) {
        setRangeError(`Date cannot be after ${isoToDisplay(maxDate)}.`);
        onValueChange('');
        return;
      }
      if (minDate && iso < minDate) {
        setRangeError(`Date cannot be before ${isoToDisplay(minDate)}.`);
        onValueChange('');
        return;
      }
      setRangeError('');
      onValueChange(iso);
    } else {
      setRangeError('');
      onValueChange('');
    }
  }

  return (
    <div>
      <input
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        maxLength={10}
        value={display}
        onChange={handleChange}
        disabled={disabled}
        className={className}
        aria-label="Date (dd/mm/yyyy)"
      />
      {rangeError && (
        <p className="mt-1 text-xs text-red-600">{rangeError}</p>
      )}
    </div>
  );
}
