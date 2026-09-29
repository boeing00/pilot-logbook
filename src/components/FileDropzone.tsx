import { useRef, useState } from 'react'

interface Props {
  onFiles: (files: File[]) => void
  busy: boolean
  disabled?: boolean
  progress: string
}

export function FileDropzone({ onFiles, busy, disabled = false, progress }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const unavailable = busy || disabled

  function handleFiles(fileList: FileList | null) {
    if (unavailable || !fileList || fileList.length === 0) return
    onFiles([...fileList])
  }

  return (
    <div>
    <div
      className={`dropzone${dragging ? ' dropzone--active' : ''}${busy ? ' dropzone--busy' : ''}${disabled ? ' dropzone--disabled' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        if (!unavailable) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        handleFiles(e.dataTransfer.files)
      }}
      onClick={() => !unavailable && inputRef.current?.click()}
      role="button"
      aria-disabled={unavailable}
      aria-busy={busy}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (!unavailable) inputRef.current?.click()
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.bmp,.csv,application/pdf,image/*,text/csv"
        multiple
        hidden
        disabled={unavailable}
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
          <p className="dropzone__title">Drop a logbook photo, JPG, PDF, or exported CSV</p>
          <p className="dropzone__hint">
            {disabled
              ? 'Finish or discard the review below to upload another file.'
              : 'Click to browse · PDF gives the best results · JPG/PNG photos are read on-device'}
          </p>
        </>
      )}
    </div>
    <p className="sr-only" role="status">{busy ? progress || 'Processing your logbook' : ''}</p>
    </div>
  )
}
