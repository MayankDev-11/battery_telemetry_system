import { useRef, useState } from 'react';
import { FileUp, UploadCloud } from 'lucide-react';

interface FileUploaderProps {
  onFile: (file: File) => void;
  compact?: boolean;
  busy?: boolean;
}

export default function FileUploader({ onFile, compact = false, busy = false }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const acceptFile = (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      window.alert('Please choose a .csv file.');
      return;
    }
    onFile(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  if (compact) {
    return (
      <>
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => acceptFile(event.target.files?.[0])}
        />
        <button className="button button-primary upload-button" onClick={() => inputRef.current?.click()} disabled={busy}>
          <FileUp size={16} /> {busy ? 'Reading CSV…' : 'Import CSV'}
        </button>
      </>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => acceptFile(event.target.files?.[0])}
      />
      <button
        className={`drop-zone${dragging ? ' drop-zone-active' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          acceptFile(event.dataTransfer.files?.[0]);
        }}
        disabled={busy}
        type="button"
      >
        <span className="drop-icon"><UploadCloud size={22} /></span>
        <span className="drop-copy">
          <strong>{busy ? 'Reading telemetry file…' : 'Drop a BMS CSV here'}</strong>
          <small>or click to browse · .csv files</small>
        </span>
        <span className="drop-action">Browse files</span>
      </button>
    </>
  );
}
