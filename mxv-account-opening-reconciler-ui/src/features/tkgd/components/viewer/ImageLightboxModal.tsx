import React, { useState, useEffect, useRef } from 'react';
import { RotateCw, X, Download, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { PreviewImageState } from '../../types/tkgd.types';

interface ImageLightboxModalProps {
  previewImage: PreviewImageState;
  onClose: () => void;
  onRotate?: () => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  previewImage,
  onClose,
  onRotate,
}) => {
  const [rotation, setRotation] = useState<number>(previewImage.rotation || 0);
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });

  // Reset transform khi đổi ảnh mới
  useEffect(() => {
    setRotation(previewImage.rotation || 0);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [previewImage.url]);

  // Phím tắt bàn phím: ESC, R, +, -, 0
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'r' || e.key === 'R') {
        handleRotate();
      } else if (e.key === '+' || e.key === '=') {
        zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        zoomOut();
      } else if (e.key === '0') {
        resetTransform();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
    if (onRotate) onRotate();
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(Math.round((prev + 0.25) * 100) / 100, 5));
  };

  const zoomOut = () => {
    setScale((prev) => {
      const next = Math.max(Math.round((prev - 0.25) * 100) / 100, 0.5);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const resetTransform = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  // Lăn chuột giữa: Lăn lên = Phóng to, Lăn xuống = Thu nhỏ
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const zoomFactor = 1.15;
    if (e.deltaY < 0) {
      // Zoom In
      setScale((prev) => Math.min(Math.round(prev * zoomFactor * 100) / 100, 5));
    } else {
      // Zoom Out
      setScale((prev) => {
        const next = Math.max(Math.round((prev / zoomFactor) * 100) / 100, 0.5);
        if (next <= 1) setPosition({ x: 0, y: 0 });
        return next;
      });
    }
  };

  // Kéo rê ảnh (Pan) khi đã zoom > 1
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;
    setPosition({
      x: dragStartRef.current.posX + deltaX,
      y: dragStartRef.current.posY + deltaY,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Nhấp đúp chuột vào ảnh để phóng to 2x / trở về 1x
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scale > 1) {
      resetTransform();
    } else {
      setScale(2);
    }
  };

  return (
    <div
      onClick={onClose}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.92)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Control Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          borderRadius: '30px',
          padding: '8px 18px',
          color: '#fff',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6)',
          zIndex: 10001,
          flexWrap: 'wrap',
          maxWidth: '95vw',
        }}
      >
        <span style={{ fontSize: '0.85rem', fontWeight: 700, paddingRight: '6px', borderRight: '1px solid #334155' }}>
          {previewImage.title}
        </span>

        {/* Nút Xoay 90 độ */}
        <button
          type="button"
          onClick={handleRotate}
          style={{
            background: 'rgba(255,255,255,0.12)',
            border: 'none',
            color: '#fff',
            padding: '6px 12px',
            borderRadius: '20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.78rem',
            fontWeight: 600,
            transition: 'background 0.15s ease',
          }}
          className="hover:bg-white/20 active:scale-95"
          title="Xoay ảnh 90 độ (Phím tắt: R)"
        >
          <RotateCw size={14} /> Xoay 90°
        </button>

        {/* Cụm Phóng to / Thu nhỏ / Zoom Level */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderRadius: '20px',
            padding: '2px 4px',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <button
            type="button"
            onClick={zoomOut}
            disabled={scale <= 0.5}
            style={{
              background: 'transparent',
              border: 'none',
              color: scale <= 0.5 ? '#64748b' : '#fff',
              padding: '4px 8px',
              borderRadius: '50%',
              cursor: scale <= 0.5 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Thu nhỏ (-)"
          >
            <ZoomOut size={14} />
          </button>

          <span
            onClick={resetTransform}
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              minWidth: '42px',
              textAlign: 'center',
              cursor: 'pointer',
              fontFamily: 'monospace',
              color: scale !== 1 ? '#60a5fa' : '#e2e8f0',
            }}
            title="Click để đặt lại 100%"
          >
            {Math.round(scale * 100)}%
          </span>

          <button
            type="button"
            onClick={zoomIn}
            disabled={scale >= 5}
            style={{
              background: 'transparent',
              border: 'none',
              color: scale >= 5 ? '#64748b' : '#fff',
              padding: '4px 8px',
              borderRadius: '50%',
              cursor: scale >= 5 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Phóng to (+)"
          >
            <ZoomIn size={14} />
          </button>
        </div>

        {/* Nút Đặt lại kích thước vừa khung */}
        {(scale !== 1 || rotation !== 0 || position.x !== 0 || position.y !== 0) && (
          <button
            type="button"
            onClick={resetTransform}
            style={{
              background: 'rgba(59, 130, 246, 0.25)',
              border: '1px solid rgba(59, 130, 246, 0.5)',
              color: '#93c5fd',
              padding: '5px 10px',
              borderRadius: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.74rem',
              fontWeight: 600,
            }}
            title="Đặt lại ban đầu (Phím tắt: 0)"
          >
            <Maximize2 size={12} /> Vừa khung
          </button>
        )}

        {/* Nút Tải ảnh */}
        <a
          href={previewImage.url}
          download
          target="_blank"
          rel="noreferrer"
          style={{
            background: 'rgba(255,255,255,0.12)',
            border: 'none',
            color: '#fff',
            padding: '6px 12px',
            borderRadius: '20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.78rem',
            fontWeight: 600,
            textDecoration: 'none',
          }}
          title="Tải ảnh về máy"
        >
          <Download size={14} /> Tải ảnh
        </a>

        {/* Nút Đóng */}
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'rgba(239, 68, 68, 0.25)',
            border: 'none',
            color: '#ef4444',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s ease',
          }}
          className="hover:bg-red-600 hover:text-white"
          title="Đóng (ESC)"
        >
          <X size={16} />
        </button>
      </div>

      {/* Image Container with Zoom & Pan */}
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        style={{
          maxWidth: '92vw',
          maxHeight: '82vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg) scale(${scale})`,
          transition: isDragging ? 'none' : 'transform 0.18s cubic-bezier(0.2, 0, 0, 1)',
          cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
        }}
      >
        <img
          src={previewImage.url}
          alt={previewImage.title}
          draggable={false}
          style={{
            maxWidth: '100%',
            maxHeight: '82vh',
            objectFit: 'contain',
            borderRadius: '8px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Hint hướng dẫn ở góc dưới */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          color: 'rgba(255, 255, 255, 0.55)',
          fontSize: '0.72rem',
          pointerEvents: 'none',
          display: 'flex',
          gap: '16px',
        }}
      >
        <span>Lăn chuột giữa: Phóng to / Thu nhỏ</span>
        <span>•</span>
        <span>Giữ chuột kéo: Di chuyển khi phóng to</span>
        <span>•</span>
        <span>Phím tắt: R (Xoay) • +/- (Zoom) • 0 (Vừa khung) • ESC (Đóng)</span>
      </div>
    </div>
  );
};

