import { useCallback, useRef, useState } from "react";
import { Upload, CheckCircle2, Circle, FileText, X, Loader2, AlertCircle, Database } from "lucide-react";
import { useDataContext, REQUIRED_CSV_FILES, PARQUET_FILE, REQUIRED_FILES } from "@/contexts/DataContext";

const CsvUploader = () => {
  const {
    uploadedFiles,
    allFilesReady,
    isParsing,
    parseError,
    parquetInfo,
    addFiles,
    removeFile,
    processFiles,
  } = useDataContext();

  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
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
        addFiles(e.target.files);
      }
      e.target.value = "";
    },
    [addFiles]
  );

  const uploadedCount = REQUIRED_FILES.filter((f) => uploadedFiles.has(f)).length;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 glow-green">
          <Upload className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground sm:text-2xl">
          Upload Your Datasets
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          This dashboard requires the following CSV files and the gold parquet dataset
          for analysis and visualization. Drag &amp; drop them below or click to browse.
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
          accept=".csv,.parquet"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
        <FileText className="mx-auto h-10 w-10 text-muted-foreground/60 mb-3" />
        <p className="text-sm font-medium text-foreground">
          {isDragging ? "Drop files here..." : "Click to browse or drag & drop CSV / Parquet files"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {uploadedCount}/{REQUIRED_FILES.length} files uploaded
        </p>
      </div>

      {/* File checklist */}
      <div className="mt-6 rounded-lg border border-border bg-card p-4">
        {/* Parquet file (highlighted) */}
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Gold Dataset (Required)
        </h3>
        <div className="mb-4">
          {(() => {
            const isUploaded = uploadedFiles.has(PARQUET_FILE);
            return (
              <div
                className={`flex items-center justify-between rounded-md px-3 py-2.5 text-sm transition-colors ${
                  isUploaded
                    ? "bg-primary/10 border border-primary/30"
                    : "bg-muted/30 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {isUploaded ? (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <Database className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  )}
                  <div>
                    <span
                      className={`font-mono text-xs block ${
                        isUploaded ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {PARQUET_FILE}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Single source of truth for all visualizations
                    </span>
                  </div>
                </div>
                {isUploaded && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(PARQUET_FILE);
                    }}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })()}
        </div>

        {/* CSV files */}
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Raw CSV Files
        </h3>
        <div className="space-y-2">
          {REQUIRED_CSV_FILES.map((fileName) => {
            const isUploaded = uploadedFiles.has(fileName);
            return (
              <div
                key={fileName}
                className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                  isUploaded
                    ? "bg-primary/5 border border-primary/20"
                    : "bg-muted/30 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {isUploaded ? (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  )}
                  <span
                    className={`font-mono text-xs ${
                      isUploaded ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {fileName}
                  </span>
                </div>
                {isUploaded && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(fileName);
                    }}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Parquet confirmation */}
      {parquetInfo && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
          <Database className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-medium text-primary">
              df_gold.parquet loaded successfully
            </p>
            <p className="text-muted-foreground mt-1">
              <span className="font-mono">{parquetInfo.rowCount.toLocaleString()}</span> rows · {parquetInfo.columns.length} columns
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
                }`}
          </>
        )}
      </button>
    </div>
  );
};

export default CsvUploader;
