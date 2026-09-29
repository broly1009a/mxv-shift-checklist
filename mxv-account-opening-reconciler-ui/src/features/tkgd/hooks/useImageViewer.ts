import { useState, useCallback } from 'react';
import { PreviewImageState, PreviewPdfState } from '../types/tkgd.types';

export function useImageViewer() {
  const [previewImage, setPreviewImage] = useState<PreviewImageState | null>(null);
  const [previewPdf, setPreviewPdf] = useState<PreviewPdfState | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  const openImage = useCallback((url: string, title: string, source: 'MAIL' | 'MS' = 'MAIL') => {
    setPreviewImage({ url, title, source, rotation: 0 });
    setZoomLevel(1);
    setRotation(0);
  }, []);

  const closeImage = useCallback(() => {
    setPreviewImage(null);
    setZoomLevel(1);
    setRotation(0);
  }, []);

  const rotateCw = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const rotateCcw = useCallback(() => {
    setRotation((prev) => (prev - 90 + 360) % 360);
  }, []);

  const zoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

  const resetTransform = useCallback(() => {
    setZoomLevel(1);
    setRotation(0);
  }, []);

  const openPdf = useCallback((url: string, title: string) => {
    setPreviewPdf({ url, title });
  }, []);

  const closePdf = useCallback(() => {
    setPreviewPdf(null);
  }, []);

  return {
    previewImage,
    setPreviewImage,
    previewPdf,
    setPreviewPdf,
    zoomLevel,
    rotation,
    openImage,
    closeImage,
    rotateCw,
    rotateCcw,
    zoomIn,
    zoomOut,
    resetTransform,
    openPdf,
    closePdf,
  };
}
