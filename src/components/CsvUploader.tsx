import { useCallback, useRef, useState } from "react";
import {
  Upload,
  CheckCircle2,
  Circle,
  Database,
  X,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import { useDataContext, REQUIRED_FILES } from "@/contexts/DataContext";
import { FILE_DESCRIPTIONS, type RequiredFileName } from "@/lib/csvDataParser";
import CsvSummaryPanel from "./CsvSummaryPanel";

const CsvUploader = () => {
  const {
    uploadedFiles,
    allFilesReady,
    isParsing,
    parseError,
    csvInfo,
    addFile,
    removeFile,
    processFiles,
  } = useDataContext();

  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList | File[]) => {
      const arr = Array.from(fileList);
      for (const f of arr) {
        addFile(f);
      }
    },
    [addFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
      e.target.value = "";
    },
    [handleFiles]
  );

  const uploadedCount = REQUIRED_FILES.filter((f) => uploadedFiles.has(f)).length;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 glow-green">
          <Database className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground sm:text-2xl">Upload Your Datasets</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          Upload all five required CSV files to power the energy analytics dashboard. All charts
          are driven entirely by your data — no mock or demo data is used.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-muted-foreground/40 hover:bg-card/60"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
        <Upload className="mx-auto h-10 w-10 text-muted-foreground/60 mb-3" />
        <p className="text-sm font-medium text-foreground">
          {isDragging ? "Drop CSV files here..." : "Click to browse or drag & drop"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Select one or more CSV files at a time ·{" "}
          <span className="font-mono text-foreground/80">
            {uploadedCount}/{REQUIRED_FILES.length}
          </span>{" "}
          uploaded
        </p>
      </div>

      {/* File checklist */}
      <div className="mt-5 space-y-2">
        {REQUIRED_FILES.map((fileName) => {
          const isUploaded = uploadedFiles.has(fileName);
          const file = uploadedFiles.get(fileName);
          return (
            <FileChecklistItem
              key={fileName}
              fileName={fileName}
              description={FILE_DESCRIPTIONS[fileName]}
              isUploaded={isUploaded}
              fileSize={file?.size}
              onRemove={() => removeFile(fileName)}
            />
          );
        })}
      </div>

      {/* CSV summary panel */}
      {csvInfo && <CsvSummaryPanel info={csvInfo} />}

      {/* Error message */}
      {parseError && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">{parseError}</p>
        </div>
      )}

      {/* Process button */}
      <button
        disabled={!allFilesReady || isParsing}
        onClick={processFiles}
        className={`mt-6 flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-all duration-200 ${
          allFilesReady && !isParsing
            ? "bg-primary text-primary-foreground hover:brightness-110 glow-green cursor-pointer"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        }`}
      >
        {isParsing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Parsing datasets...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            {allFilesReady
              ? "Process & Visualize"
              : `Upload ${REQUIRED_FILES.length - uploadedCount} more file${
                  REQUIRED_FILES.length - uploadedCount !== 1 ? "s" : ""
                } to continue`}
          </>
        )}
      </button>
    </div>
  );
};

// ── Checklist item ──────────────────────────────────────────────────────────

function FileChecklistItem({
  fileName,
  description,
  isUploaded,
  fileSize,
  onRemove,
}: {
  fileName: string;
  description: string;
  isUploaded: boolean;
  fileSize?: number;
  onRemove: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-md border px-3 py-2.5 transition-colors ${
        isUploaded
          ? "border-primary/30 bg-primary/10"
          : "border-border bg-card/50"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {isUploaded ? (
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="font-mono text-xs text-foreground truncate">{fileName}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {isUploaded && fileSize && (
          <span className="text-[10px] text-muted-foreground font-mono">
            {(fileSize / (1024 * 1024)).toFixed(1)} MB
          </span>
        )}
        {isUploaded && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default CsvUploader;
