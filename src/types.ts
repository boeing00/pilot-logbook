export interface FlightEntry {
  id: string
  date: string
  aircraftMakeModel: string
  aircraftId: string
  from: string
  to: string
  route: string
  totalTime: number
  pic: number
  sic: number
  dualReceived: number
  dualGiven: number
  solo: number
  night: number
  crossCountry: number
  actualInstrument: number
  simulatedInstrument: number
  dayLandings: number
  nightLandings: number
  approaches: number
  remarks: string
}

export type FlightDraft = Omit<FlightEntry, 'id'>

export interface FlightTotals {
  flights: number
  totalTime: number
  pic: number
  sic: number
  dualReceived: number
  dualGiven: number
  solo: number
  night: number
  crossCountry: number
  actualInstrument: number
  simulatedInstrument: number
  dayLandings: number
  nightLandings: number
  approaches: number
}

export const emptyDraft = (): FlightDraft => ({
  date: new Date().toISOString().slice(0, 10),
  aircraftMakeModel: '',
  aircraftId: '',
  from: '',
  to: '',
  route: '',
  totalTime: 0,
  pic: 0,
  sic: 0,
  dualReceived: 0,
  dualGiven: 0,
  solo: 0,
  night: 0,
  crossCountry: 0,
  actualInstrument: 0,
  simulatedInstrument: 0,
  dayLandings: 0,
  nightLandings: 0,
  approaches: 0,
  remarks: '',
})
