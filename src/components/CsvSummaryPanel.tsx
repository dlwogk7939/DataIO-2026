import { Database } from "lucide-react";
import type { AllCsvInfo } from "@/lib/csvDataParser";

interface Props {
  info: AllCsvInfo;
}

const CsvSummaryPanel = ({ info }: Props) => {
  const entries = Object.entries(info);
  if (entries.length === 0) return null;

  return (
    <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Database className="h-4 w-4 text-primary" />
        <p className="text-xs font-medium text-primary">All datasets loaded successfully</p>
      </div>
      <div className="space-y-2">
        {entries.map(([key, fileInfo]) => (
          <div key={key} className="rounded border border-border/50 bg-card/30 p-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[11px] text-foreground">{fileInfo.fileName}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {fileInfo.rowCount.toLocaleString()} rows · {fileInfo.columns.length} cols
              </span>
            </div>
            <p className="font-mono text-[9px] text-muted-foreground leading-relaxed truncate">
              {fileInfo.columns.join(", ")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CsvSummaryPanel;
