import type { FlightEntry } from '../types'
import { CATEGORY_LABELS, flightCategory } from './category'
import { formatMinutes } from './time'

const HEADER = [
  'Date',
  'Aircraft',
  'Tail',
  'FlightNo',
  'From',
  'To',
  'DutyCode',
  'Category',
  'Duty',
  'Flight',
  'Night',
  'Instrument',
  'T/O',
  'L/D',
]

function cell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function flightsToCsv(flights: FlightEntry[]): string {
  const rows = flights.map((f) =>
    [
      f.date,
      f.aircraft,
      f.tail,
      f.flightNo,
      f.from,
      f.to,
      f.irr,
      CATEGORY_LABELS[flightCategory(f)],
      formatMinutes(f.dutyMin),
      formatMinutes(f.flightMin),
      formatMinutes(f.nightMin),
      formatMinutes(f.instrumentMin),
      f.takeoff ? '1' : '',
      f.landing ? '1' : '',
    ]
      .map(cell)
      .join(','),
  )
  return [HEADER.join(','), ...rows].join('\n')
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
