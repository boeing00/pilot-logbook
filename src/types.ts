export interface FlightEntry {
  /** Official logbook flight date, YYYY/MM/DD (from the Date column). */
  date: string
  /** Aircraft type, e.g. B777, A380. */
  aircraft: string
  /** Tail / registration suffix (HL column), e.g. 7732. */
  tail: string
  /** Flight number, e.g. 272. */
  flightNo: string
  /** Departure airport (IATA), e.g. ICN. */
  from: string
  /** Arrival airport (IATA), e.g. SEA. */
  to: string
  /** Irregularity / layover code, e.g. 2Z. */
  irr: string
  /** Report-out (block-out) timestamp text, e.g. "03/02 12:05". */
  reportOut: string
  /** Report-in (block-in) timestamp text, e.g. "03/02 22:22". */
  reportIn: string
  /** Duty time in minutes. */
  dutyMin: number
  /** Flight (block/T-S) time in minutes. */
  flightMin: number
  /** Night time in minutes. */
  nightMin: number
  /** Instrument time in minutes. */
  instrumentMin: number
  /** Pilot-flying take-off credited on this sector (T/O marker). */
  takeoff: boolean
  /** Pilot-flying landing credited on this sector (L/D marker). */
  landing: boolean
}

/** Career / cumulative summary block reported at the top of the logbook file. */
export interface LogbookSummary {
  totalFlightMin?: number
  typeFlightLabel?: string
  typeFlightMin?: number
  typeCaptainLabel?: string
  typeCaptainMin?: number
  captainFlightMin?: number
  nightFlightMin?: number
  instrumentFlightMin?: number
  monthFlightMin?: number
  monthDeadheadMin?: number
}

export interface PilotInfo {
  name?: string
  empNo?: string
  aircraft?: string
  duty?: string
  nationality?: string
}

export interface ParsedLogbook {
  pilot: PilotInfo
  summary: LogbookSummary
  flights: FlightEntry[]
}

export interface Totals {
  flights: number
  flightMin: number
  nightMin: number
  instrumentMin: number
  dutyMin: number
  takeoffs: number
  landings: number
}

export interface MonthGroup {
  /** Month key, YYYY-MM. */
  key: string
  year: string
  month: string
  flights: FlightEntry[]
  totals: Totals
  /** Per-aircraft-type flight minutes within the month. */
  byAircraft: Record<string, number>
}

export interface YearGroup {
  year: string
  months: MonthGroup[]
  totals: Totals
  byAircraft: Record<string, number>
}
