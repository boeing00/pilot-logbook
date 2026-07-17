import { useRef, useState } from 'react'

interface Props {
  onFiles: (files: File[]) => void
  busy: boolean
  progress: string
}

export function FileDropzone({ onFiles, busy, progress }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    onFiles([...fileList])
  }

  return (
    <div
      className={`dropzone${dragging ? ' dropzone--active' : ''}${busy ? ' dropzone--busy' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (!busy) handleFiles(e.dataTransfer.files)
      }}
      onClick={() => !busy && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !busy) inputRef.current?.click()
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.bmp,application/pdf,image/*"
        multiple
        hidden
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      {busy ? (
        <div className="dropzone__busy">
          <div className="spinner" aria-hidden />
          <p className="dropzone__title">Processing…</p>
          <p className="dropzone__hint">{progress || 'Working on your logbook'}</p>
        </div>
      ) : (
        <>
          <div className="dropzone__icon" aria-hidden>
            &#9992;
          </div>
          <p className="dropzone__title">Drop a logbook photo, JPG, or PDF</p>
          <p className="dropzone__hint">
            or click to browse — phone photos are read with on-device OCR
          </p>
        </>
      )}
    </div>
  )
}
