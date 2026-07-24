import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ZoomOut, Check, X } from "lucide-react";

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  aspect?: number;
  onCropSave: (croppedImageBase64: string) => void;
  onCancel: () => void;
}

async function getCroppedImg(imageSrc: string, pixelCrop: { x: number; y: number; width: number; height: number }): Promise<string> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });

  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d");

  if (!ctx) return imageSrc;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return canvas.toDataURL("image/jpeg", 0.9);
}

export function ImageCropModal({ isOpen, imageSrc, aspect = 16 / 9, onCropSave, onCancel }: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    try {
      setIsProcessing(true);
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropSave(croppedImage);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    } catch (e) {
      console.error("Error cropping image:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-lg rounded-3xl p-6 bg-white overflow-hidden z-[1050]">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-slate-900">Recortar y encuadrar foto</DialogTitle>
        </DialogHeader>

        <div className="relative w-full h-72 sm:h-80 bg-slate-900 rounded-2xl overflow-hidden my-4">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
          />
        </div>

        <div className="space-y-2 px-2">
          <div className="flex justify-between items-center text-xs font-bold text-slate-600">
            <span className="flex items-center gap-1"><ZoomOut className="w-4 h-4 text-slate-400" /> Zoom</span>
            <span>{zoom.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-green-600 cursor-pointer h-2 bg-slate-200 rounded-lg appearance-none"
          />
        </div>

        <DialogFooter className="flex gap-2 justify-end pt-4 border-t border-slate-100 mt-2">
          <Button variant="outline" className="rounded-xl font-bold" onClick={onCancel} disabled={isProcessing}>
            <X className="w-4 h-4 mr-1.5" /> Cancelar
          </Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold px-5" onClick={handleSave} disabled={isProcessing}>
            <Check className="w-4 h-4 mr-1.5" /> {isProcessing ? "Guardando..." : "Guardar Recorte"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
