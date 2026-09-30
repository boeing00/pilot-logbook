import type { FlightEntry } from '../types'

/**
 * Identity used to de-duplicate sectors across sources (PDF, OCR pass, CSV).
 *
 * Tail is part of the key so two sectors flown on the same day, same flight
 * number and same route but on different airframes (aircraft swap, return
 * after diversion) are kept as separate flights instead of being silently
 * collapsed. Report times are excluded because CSV exports do not carry them.
 * Uppercased so OCR case wobble does not create duplicates. Leading zeros of
 * the flight number are ignored: Excel turns "011" into "11" when an exported
 * CSV is re-saved, and that must still be the same sector as the PDF's 011.
 */
export function flightId(f: FlightEntry): string {
  const flightNo = f.flightNo.replace(/^0+(?=\d)/, '')
  return `${f.date}|${flightNo}|${f.from}|${f.to}|${f.tail}`.toUpperCase()
}
