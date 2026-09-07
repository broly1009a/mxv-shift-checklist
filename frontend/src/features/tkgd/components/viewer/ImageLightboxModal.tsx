import React from 'react';
import { RotateCw, X, Download } from 'lucide-react';
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
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
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
          gap: '12px',
          backgroundColor: 'rgba(30, 41, 59, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '30px',
          padding: '8px 20px',
          color: '#fff',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
        }}
      >
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{previewImage.title}</span>
        {onRotate && (
          <button
            onClick={onRotate}
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
            }}
            title="Xoay ảnh 90 độ"
          >
            <RotateCw size={14} /> Xoay 90°
          </button>
        )}
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
        <button
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
          }}
          title="Đóng (ESC)"
        >
          <X size={16} />
        </button>
      </div>

      {/* Image Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '90vw',
          maxHeight: '80vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.25s ease',
          transform: `rotate(${previewImage.rotation || 0}deg)`,
        }}
      >
        <img
          src={previewImage.url}
          alt={previewImage.title}
          style={{
            maxWidth: '100%',
            maxHeight: '80vh',
            objectFit: 'contain',
            borderRadius: '8px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
          }}
        />
      </div>
    </div>
  );
};
