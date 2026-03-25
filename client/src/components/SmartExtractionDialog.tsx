import { useState, useRef } from "react";
import { UploadCloud } from "lucide-react";
import { api } from "../lib/api";

interface SmartExtractionDialogProps {
    onClose: () => void;
    onExtracted: (data: any) => void;
}

export default function SmartExtractionDialog({ onClose, onExtracted }: SmartExtractionDialogProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setError("");

        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/ai/extract", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to extract data");
            }

            const json = await res.json();
            onExtracted(json.data);
        } catch (err: any) {
            setError(err.message || "Something went wrong.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-extrabold text-gray-800 flex items-center gap-2">
                            <span className="text-primary-600 bg-primary-50 p-2 rounded-lg">✨</span> Smart Extraction
                        </h2>
                        <button
                            onClick={onClose}
                            disabled={isUploading}
                            className="text-gray-400 hover:text-gray-600 transition disabled:opacity-50"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="text-center mb-6">
                        <p className="text-gray-600">
                            Upload a picture or scan of an old patient file. Our AI will automatically extract demographics to save you time!
                        </p>
                    </div>

                    <div
                        onClick={() => !isUploading && fileInputRef.current?.click()}
                        className={`border-4 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all ${isUploading ? 'border-primary-200 bg-primary-50 cursor-not-allowed' : 'border-primary-100 bg-white hover:border-primary-300 hover:bg-primary-50/50'
                            }`}
                    >
                        {isUploading ? (
                            <>
                                <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
                                <h3 className="text-xl font-bold text-gray-800 mb-2">Analyzing Document...</h3>
                                <p className="text-gray-500 text-sm">This usually takes a few seconds.</p>
                            </>
                        ) : (
                            <>
                                <div className="bg-primary-100 text-primary-600 p-4 rounded-full mb-4">
                                    <UploadCloud size={48} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-800 mb-2">Click to Upload</h3>
                                <p className="text-gray-500 text-sm text-center">
                                    Supports Images (JPG, PNG) & PDF formats.<br />Max file size 10MB.
                                </p>
                            </>
                        )}
                        <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            disabled={isUploading}
                        />
                    </div>

                    {error && (
                        <div className="mt-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium">
                            {error}
                        </div>
                    )}
                </div>

                <div className="bg-gray-50 p-6 flex justify-end">
                    <button
                        onClick={onClose}
                        disabled={isUploading}
                        className="px-6 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl shadow-sm hover:bg-gray-50 transition disabled:opacity-50"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
