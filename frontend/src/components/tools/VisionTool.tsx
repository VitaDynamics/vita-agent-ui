import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, MapPin } from 'lucide-react';

type VisionToolProps = {
    args: any;
    result?: any;
};

type NormalizedResult = {
    status: string;
    data: any;
    message?: string;
};

function normalizeResult(result: any): NormalizedResult {
    if (!result) {
        return { status: 'unknown', data: undefined };
    }

    if (typeof result === 'string') {
        return { status: 'ok', data: { answer: result } };
    }

    if (typeof result === 'object' && ("status" in result || "data" in result || "message" in result)) {
        return {
            status: (result as any).status ?? 'ok',
            data: (result as any).data ?? result,
            message: (result as any).message,
        };
    }

    return { status: 'ok', data: result };
}

export const VisionTool: React.FC<VisionToolProps> = ({ args, result }) => {
    const rawMode = args?.mode;
    const mode: 'vqa' | 'grounding' | 'unknown' =
        rawMode === 1 || rawMode === 'vqa'
            ? 'vqa'
            : rawMode === 2 || rawMode === 'grounding'
                ? 'grounding'
                : 'unknown';

    const image: string | undefined = args?.image;
    const question: string | undefined = args?.question ?? args?.query;

    const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

    const normalized = useMemo(() => normalizeResult(result), [result]);
    const data = normalized.data ?? {};

    // -----------------------
    // Mode 1: VQA / Analysis
    // -----------------------
    if (mode === 'vqa') {
        const answer =
            typeof data?.answer === 'string'
                ? data.answer
                : typeof data === 'string'
                    ? data
                    : undefined;

        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm my-4"
            >
                {image && (
                    <div className="relative">
                        <img
                            src={image}
                            alt="Analysis Target"
                            className="w-full h-56 object-cover"
                        />
                        <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-md text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                            <Eye size={12} />
                            <span>Vision Analysis</span>
                        </div>
                    </div>
                )}

                <div className="p-4 space-y-3">
                    {question && (
                        <div className="text-sm font-medium text-gray-900 leading-snug">"{question}"</div>
                    )}
                    {answer && (
                        <div className="flex gap-2 items-start mt-2 pt-2 border-t border-gray-100">
                            <div className="bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase mt-0.5">Result</div>
                            <div className="text-sm text-gray-600 leading-relaxed">{answer}</div>
                        </div>
                    )}
                    {!answer && result && (
                        <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                            Raw result:
                            <pre className="mt-1 bg-gray-50 border border-gray-100 rounded-lg p-2 overflow-x-auto">
                                {JSON.stringify(result, null, 2)}
                            </pre>
                        </div>
                    )}
                    {normalized.message && (
                        <div className="text-[11px] text-gray-400 mt-1">{normalized.message}</div>
                    )}
                </div>
            </motion.div>
        );
    }

    // -----------------------
    // Mode 2: Grounding / Object Localization
    // -----------------------
    if (mode === 'grounding') {
        const objects = Array.isArray(data?.objects) ? data.objects : [];

        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm my-4"
            >
                {image && (
                    <div className="relative">
                        <img
                            src={image}
                            alt="Grounding Target"
                            className="w-full h-56 object-cover"
                            onLoad={(e) => {
                                const imgEl = e.currentTarget;
                                if (imgEl.naturalWidth && imgEl.naturalHeight) {
                                    setNaturalSize({ width: imgEl.naturalWidth, height: imgEl.naturalHeight });
                                }
                            }}
                        />
                        <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-md text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                            <MapPin size={12} />
                            <span>Grounding</span>
                        </div>

                        {naturalSize && objects.length > 0 && (
                            <div className="absolute inset-0">
                                {objects.map((obj: any, idx: number) => {
                                    const { pixel_x, pixel_y, label, confidence } = obj;
                                    if (
                                        typeof pixel_x !== 'number' ||
                                        typeof pixel_y !== 'number' ||
                                        !naturalSize.width ||
                                        !naturalSize.height
                                    ) {
                                        return null;
                                    }

                                    const xPct = (pixel_x / naturalSize.width) * 100;
                                    const yPct = (pixel_y / naturalSize.height) * 100;

                                    return (
                                        <div
                                            key={idx}
                                            className="absolute flex flex-col items-center"
                                            style={{
                                                left: `${xPct}%`,
                                                top: `${yPct}%`,
                                                transform: 'translate(-50%, -50%)',
                                            }}
                                        >
                                            <div className="w-5 h-5 rounded-full bg-system-blue/80 border border-white shadow-md flex items-center justify-center">
                                                <MapPin size={12} className="text-white" />
                                            </div>
                                            {label && (
                                                <div className="mt-1 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] backdrop-blur-sm">
                                                    {label}
                                                    {typeof confidence === 'number' && (
                                                        <span className="ml-1 text-[9px] text-gray-200">({(confidence * 100).toFixed(0)}%)</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                <div className="p-4 space-y-3">
                    {question && (
                        <div className="text-sm font-medium text-gray-900 leading-snug">"{question}"</div>
                    )}

                    {objects.length > 0 ? (
                        <div className="mt-2 space-y-2">
                            {objects.map((obj: any, idx: number) => (
                                <div
                                    key={idx}
                                    className="flex items-start justify-between gap-3 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100"
                                >
                                    <div>
                                        <div className="text-xs font-semibold text-gray-800">
                                            {obj.label ?? 'Object'}
                                        </div>
                                        <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-gray-500">
                                            {typeof obj.distance === 'number' && (
                                                <span className="px-1.5 py-0.5 rounded-full bg-white border border-gray-200">{obj.distance.toFixed(2)} m</span>
                                            )}
                                            {typeof obj.angle_deg === 'number' && (
                                                <span className="px-1.5 py-0.5 rounded-full bg-white border border-gray-200">{obj.angle_deg.toFixed(1)}°</span>
                                            )}
                                            {typeof obj.confidence === 'number' && (
                                                <span className="px-1.5 py-0.5 rounded-full bg-white border border-gray-200">{(obj.confidence * 100).toFixed(0)}% conf</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-2 text-xs text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-xl px-3 py-2">
                            No grounded objects were returned.
                        </div>
                    )}

                    {normalized.message && (
                        <div className="text-[11px] text-gray-400 mt-1">{normalized.message}</div>
                    )}
                </div>
            </motion.div>
        );
    }

    return null;
};
