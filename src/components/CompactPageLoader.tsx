import { Loader2 } from "lucide-react";

export function CompactPageLoader({ label }: { label: string }) {
    return (
        <div className="space-y-4">
            <div
                role="status"
                className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm text-blue-800 shadow-sm"
            >
                <Loader2 className="size-4 animate-spin" />
                <span>{label}</span>
            </div>
        </div>
    );
}
