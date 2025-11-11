import { useState, useRef, DragEvent, useId } from 'react';
import { Upload } from 'lucide-react';

interface FileUploaderProps {
  label: string;
  hint: string;
  file: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
}

export default function FileUploader({
  label,
  hint,
  file,
  onChange,
  accept = '.csv',
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();

  // when user picks file using the file picker dialog
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    onChange(selectedFile);

    // allow selecting the same file again (some browsers won't fire change otherwise)
    e.target.value = '';
  };

  // --- DRAG & DROP HANDLERS ---
  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault(); // required so onDrop will fire
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0] || null;
    if (droppedFile) {
      onChange(droppedFile);

      // sync the hidden input's FileList for form integrations
      if (inputRef.current) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(droppedFile);
        inputRef.current.files = dataTransfer.files;
      }
    }
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex-1 min-w-[260px]">
      <div className="text-sm font-semibold text-gray-700 mb-3">{label}</div>

      {/* Use htmlFor to trigger the input; no manual .click() -> prevents double dialogs */}
      <label
        htmlFor={inputId}
        className={[
          'flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer transition-all w-full text-center',
          isDragging
            ? 'border-blue-500 bg-blue-50/70'
            : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/50',
        ].join(' ')}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload
          className={`w-8 h-8 mb-2 ${
            isDragging ? 'text-blue-500' : 'text-gray-400'
          }`}
        />
        <span className="text-xs text-gray-600 mb-1">
          {file ? 'Change file' : 'Click to upload or drag & drop'}
        </span>
        <span className="text-[0.65rem] text-gray-400">{accept}</span>

        {/* Visually hidden (not display:none) so label works across browsers */}
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="sr-only"
        />
      </label>

      {file && (
        <div className="mt-3 inline-block bg-sky-100 text-sky-700 text-xs font-medium px-3 py-1.5 rounded-full border border-sky-300 max-w-full truncate">
          {file.name}
        </div>
      )}

      <div className="text-[0.7rem] text-gray-500 mt-2">{hint}</div>
    </div>
  );
}
