import { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { Camera, RefreshCw, X, Check } from "lucide-react";

interface CameraCaptureProps {
    onCapture: (file: File) => void;
    onCancel: () => void;
}

export default function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
    const webcamRef = useRef<Webcam>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            setCapturedImage(imageSrc);
        }
    }, [webcamRef]);

    const retake = () => {
        setCapturedImage(null);
    };

    const confirm = async () => {
        if (!capturedImage) return;

        // Convert base64 to File
        const res = await fetch(capturedImage);
        const blob = await res.blob();
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });

        onCapture(file);
    };

    return (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-[100]">
            <div className="relative w-full max-w-4xl bg-gray-900 rounded-2xl overflow-hidden shadow-2xl pb-24">

                {/* Header */}
                <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
                    <h3 className="text-white font-semibold text-xl drop-shadow-md flex items-center gap-2">
                        <Camera size={24} /> Camera Capture
                    </h3>
                    <button
                        onClick={onCancel}
                        className="p-2 bg-black/50 hover:bg-black/80 rounded-full text-white transition-all shadow-md active:scale-95"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Viewfinder / Captured Image */}
                <div className="w-full aspect-video bg-black flex items-center justify-center relative">
                    {!capturedImage ? (
                        <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            videoConstraints={{ facingMode: "environment" }}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
                    )}
                </div>

                {/* Controls */}
                <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-12 z-10">
                    {!capturedImage ? (
                        <button
                            onClick={capture}
                            className="w-20 h-20 rounded-full bg-white border-[6px] border-gray-300 flex items-center justify-center hover:bg-gray-100 hover:scale-105 transition-all active:scale-95 shadow-[0_0_20px_rgba(0,0,0,0.5)]"
                        >
                            <div className="w-14 h-14 rounded-full border-2 border-gray-800 flex items-center justify-center">
                                <Camera size={28} className="text-gray-900" />
                            </div>
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={retake}
                                className="w-16 h-16 rounded-full bg-gray-800 border-2 border-gray-600 text-white flex items-center justify-center hover:bg-gray-700 hover:scale-105 transition-all active:scale-95 shadow-xl"
                                title="Retake"
                            >
                                <RefreshCw size={28} />
                            </button>
                            <button
                                onClick={confirm}
                                className="w-20 h-20 rounded-full bg-accent-500 border-4 border-accent-300 text-white flex items-center justify-center hover:bg-accent-600 hover:scale-105 transition-all active:scale-95 shadow-xl"
                                title="Use Photo"
                            >
                                <Check size={40} />
                            </button>
                        </>
                    )}
                </div>

            </div>
        </div>
    );
}
