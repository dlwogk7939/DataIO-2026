import { useCallback, useRef, useState } from "react";
import { Upload, CheckCircle2, Database, X, Loader2, AlertCircle } from "lucide-react";
import { useDataContext, PARQUET_FILE } from "@/contexts/DataContext";

const CsvUploader = () => {
  const {
    uploadedFile,
    fileReady,
    isParsing,
    parseError,
    parquetInfo,
    setFile,
    removeFile,
    processFile,
  } = useDataContext();

  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileDrop = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      const parquet = arr.find(
        (f) => f.name.toLowerCase().trim() === PARQUET_FILE
      );
      if (parquet) {
        setFile(parquet);
      }
    },
    [setFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFileDrop(e.dataTransfer.files);
      }
    },
    [handleFileDrop]
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
      if (e.target.files && e.target.files.length > 0) {
        handleFileDrop(e.target.files);
      }
      e.target.value = "";
    },
    [handleFileDrop]
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 glow-green">
          <Database className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground sm:text-2xl">
          Upload Your Dataset
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          Upload <span className="font-mono text-foreground/80">{PARQUET_FILE}</span> — the pre-cleaned gold dataset containing smart meter, weather, and building data.
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
          accept=".parquet"
          className="hidden"
          onChange={handleFileInput}
        />
        {uploadedFile ? (
          <div className="flex flex-col items-center gap-2">
            <CheckCircle2 className="h-10 w-10 text-primary mb-1" />
            <p className="text-sm font-medium text-foreground">
              {uploadedFile.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB · Click to replace
            </p>
          </div>
        ) : (
          <>
            <Upload className="mx-auto h-10 w-10 text-muted-foreground/60 mb-3" />
            <p className="text-sm font-medium text-foreground">
              {isDragging
                ? "Drop file here..."
                : "Click to browse or drag & drop"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Only <span className="font-mono">{PARQUET_FILE}</span> is accepted
            </p>
          </>
        )}
      </div>

      {/* Uploaded file indicator with remove */}
      {uploadedFile && (
        <div className="mt-4 flex items-center justify-between rounded-md border border-primary/30 bg-primary/10 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Database className="h-4 w-4 text-primary shrink-0" />
            <div>
              <span className="font-mono text-xs text-foreground block">
                {PARQUET_FILE}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Single source of truth for all visualizations
              </span>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeFile();
            }}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Parquet confirmation */}
      {parquetInfo && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
          <Database className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-medium text-primary">
              Dataset loaded successfully
            </p>
            <p className="text-muted-foreground mt-1">
              <span className="font-mono">
                {parquetInfo.rowCount.toLocaleString()}
              </span>{" "}
              rows · {parquetInfo.columns.length} columns
            </p>
            <p className="text-muted-foreground mt-0.5 font-mono text-[10px] leading-relaxed">
              {parquetInfo.columns.join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Error message */}
      {parseError && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">{parseError}</p>
        </div>
      )}

      {/* Process button */}
      <button
        disabled={!fileReady || isParsing}
        onClick={processFile}
        className={`mt-6 flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-all duration-200 ${
          fileReady && !isParsing
            ? "bg-primary text-primary-foreground hover:brightness-110 glow-green cursor-pointer"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        }`}
      >
        {isParsing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Parsing dataset...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            {fileReady ? "Process & Visualize" : "Upload df_gold.parquet to continue"}
          </>
        )}
      </button>
    </div>
  );
};

export default CsvUploader;
