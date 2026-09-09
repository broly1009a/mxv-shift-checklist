'use client';

import React, { useState, useMemo } from 'react';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import { useTutorial } from '@/context/TutorialContext';
import { tkgdTutorialSteps, tkgdConfigTutorialSteps } from '@/tutorials/tkgdTutorial';
import TkgdConfigPanel from '@/components/tkgd/TkgdConfigPanel';
import { TkgdNotificationDropdown } from './TkgdNotificationDropdown';

import {
  FileSpreadsheet,
  RefreshCw,
  HelpCircle,
  Moon,
  Sun,
  Settings,
  Loader2,
  Clock,
} from 'lucide-react';

import { CleanRecord } from '../types/tkgd.types';
import { useTkgdData } from '../hooks/useTkgdData';
import { useTkgdActions } from '../hooks/useTkgdActions';
import { useImageViewer } from '../hooks/useImageViewer';

import { TkgdActionToolbar } from './TkgdActionToolbar';
import { TkgdStatsCards } from './TkgdStatsCards';
import { TkgdFilterBar } from './TkgdFilterBar';
import { TkgdRecordsTable } from './TkgdRecordsTable';
import { TkgdInspectionModal } from './modal/TkgdInspectionModal';
import { TkgdActivityLogsModal } from './modal/TkgdActivityLogsModal';
import { ImageLightboxModal } from './viewer/ImageLightboxModal';
import { PdfPreviewFrame } from './viewer/PdfPreviewFrame';

export const TkgdDashboard: React.FC = () => {
  const { user, theme, changeTheme } = useAuth();
  const { startTutorial, isActive: isTutorialActive, resetTutorial } = useTutorial();

  // Tab chính: Đối Soát Hồ Sơ vs Cấu Hình Bot
  const [mainTab, setMainTab] = useState<'RECONCILE' | 'CONFIG'>('RECONCILE');

  // Modal Nhật Ký Tác Vụ Độc Lập TKGD (Audit Logs)
  const [showLogsModal, setShowLogsModal] = useState(false);

  // Hook quản lý dữ liệu Master
  const {
    records,
    loading,
    total,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    filter: statusFilter,
    setFilter: setStatusFilter,
    batchDate: dateFilter,
    setBatchDate: setDateFilter,
    searchTerm: searchQuery,
    setSearchTerm: setSearchQuery,
    isCompactView: compactView,
    toggleCompactView,
    expandedRowId,
    setExpandedRowId,
    showStats,
    setShowStats,
    toggleStats,
    accountManifest,
    loadingManifest,
    fetchRecords,
    fetchStats,
    setRecords,
    stats: tkgdStats,
    inspectRecord,
    setInspectRecord,
  } = useTkgdData();

  // Hook điều khiển hành động Pipeline / Xuất Excel
  const {
    isProcessing,
    processingStage,
    progress,
    sprintMode,
    setSprintMode,
    syncingRowCode,
    autoStatus,
    handleToggleAutoPipeline,
    handleSyncMail,
    handleSyncMSystem,
    handleReparseAccount,
    handleRunPipelineAll,
    handleRunReconcile,
    handleDownloadExcel,
  } = useTkgdActions({ onSuccess: fetchRecords, batchDate: dateFilter });

  // Hook xem phóng to & xoay ảnh CCCD / Chữ ký / PDF
  const {
    previewImage,
    setPreviewImage,
    previewPdf,
    setPreviewPdf,
    rotateCw,
  } = useImageViewer();

  // Mở modal đối soát chi tiết
  const handleOpenInspection = (record: CleanRecord) => {
    setInspectRecord(record);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        padding: '24px',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-primary)',
      }}
    >
      {/* =========================================================================
       * 1. TOP HEADER & NAVIGATION BAR
       * ========================================================================= */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '16px 24px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Left: Branding & Subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)',
            }}
          >
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  color: '#3b82f6',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Thanh Toán Bù Trừ
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>MXV Automation Tool</span>
            </div>
            <h1
              style={{
                fontSize: '1.3rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                margin: '2px 0 0 0',
              }}
            >
              Đối Soát & Mở Tài Khoản Giao Dịch
            </h1>
          </div>
        </div>

        {/* Center: Main Tab Switcher (Đối Soát vs Cấu Hình) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '4px',
            gap: '4px',
          }}
        >
          <button
            onClick={() => setMainTab('RECONCILE')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: '9px',
              fontSize: '0.8rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: mainTab === 'RECONCILE' ? '#3b82f6' : 'transparent',
              color: mainTab === 'RECONCILE' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: mainTab === 'RECONCILE' ? '0 2px 8px rgba(59, 130, 246, 0.35)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <FileSpreadsheet size={15} />
            <span>Đối Soát Hồ Sơ</span>
          </button>

          <button
            onClick={() => setMainTab('CONFIG')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: '9px',
              fontSize: '0.8rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: mainTab === 'CONFIG' ? '#10b981' : 'transparent',
              color: mainTab === 'CONFIG' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: mainTab === 'CONFIG' ? '0 2px 8px rgba(16, 185, 129, 0.35)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <Settings size={15} />
            <span>Cài Đặt & Cấu Hình Bot</span>
          </button>
        </div>

        {/* Right: Quick Actions & Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* User profile */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              fontSize: '0.75rem',
            }}
          >
            <div
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
              }}
            />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {user?.fullName || 'Trương Hoàng Hiệp'}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>(TTBT)</span>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => {
              if (changeTheme) {
                changeTheme(theme === 'dark' ? 'light' : 'dark');
              } else {
                const curr = document.documentElement.getAttribute('data-theme');
                const next = curr === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', next);
              }
            }}
            title="Đổi giao diện Sáng / Tối"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          {/* Chuông Thông Báo Đối Soát TKGD (Độc Lập TTBT) */}
          <TkgdNotificationDropdown onOpenLogs={() => setShowLogsModal(true)} />

          {/* Nút Mở Nhật Ký Tác Vụ TKGD (Audit Logs Độc Lập) */}
          <button
            onClick={() => setShowLogsModal(true)}
            title="Xem Nhật Ký Tác Vụ TKGD (Audit Logs)"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: showLogsModal ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-card)',
              border: showLogsModal ? '1px solid #3b82f6' : '1px solid var(--border-color)',
              color: showLogsModal ? '#3b82f6' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Clock size={15} />
          </button>

          {/* Nút Làm mới */}
          <button
            onClick={fetchRecords}
            disabled={loading}
            title="Làm mới dữ liệu"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-blue-500' : ''} />
          </button>

          {/* Nút Hướng Dẫn Sử Dụng (Tutorial Tour) */}
          <button
            onClick={() => {
              if (mainTab === 'CONFIG') {
                resetTutorial('tkgd-config');
                startTutorial('tkgd-config', tkgdConfigTutorialSteps);
              } else {
                setShowStats(true);
                localStorage.setItem('tkgd_show_stats', 'true');
                resetTutorial('tkgd');
                startTutorial('tkgd', tkgdTutorialSteps);
              }
            }}
            title={mainTab === 'CONFIG' ? 'Xem hướng dẫn cài đặt & cấu hình bot' : 'Xem hướng dẫn sử dụng phân hệ TKGD'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '36px',
              padding: '0 12px',
              borderRadius: '10px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              color: '#3b82f6',
              fontWeight: 600,
              fontSize: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            className="hover:bg-blue-500 hover:text-white"
          >
            <HelpCircle size={15} />
            <span>Hướng Dẫn</span>
          </button>

          {/* Cụm Action Toolbar khi ở Tab RECONCILE */}
          {mainTab === 'RECONCILE' && (
            <TkgdActionToolbar
              isProcessing={isProcessing}
              processingStage={processingStage}
              sprintMode={sprintMode}
              setSprintMode={setSprintMode}
              pendingMsCount={tkgdStats?.pendingMsCount || 0}
              showStats={showStats}
              toggleStats={toggleStats}
              onRunPipelineAll={handleRunPipelineAll}
              onDownloadExcel={handleDownloadExcel}
              onSyncMail={handleSyncMail}
              onSyncMSystem={handleSyncMSystem}
              onRunReconcile={handleRunReconcile}
              autoStatus={autoStatus}
            />
          )}
        </div>
      </div>

      {/* =========================================================================
       * CHUYỂN ĐỔI NỘI DUNG GIỮA 2 TAB (CẤU HÌNH vs ĐỐI SOÁT)
       * ========================================================================= */}
      {mainTab === 'CONFIG' ? (
        <TkgdConfigPanel />
      ) : (
        <>
          {/* Live Real-time Progress Tracker khi đang chạy tác vụ ngầm */}
          {isProcessing && (
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                borderRadius: '16px',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 8px 24px rgba(59, 130, 246, 0.12)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Hàng trên: Icon + Tên trạng thái + Badges */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#3b82f6',
                      flexShrink: 0,
                    }}
                  >
                    <Loader2 size={20} className="animate-spin" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        Hệ Thống Đang Xử Lý
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          borderRadius: '20px',
                          backgroundColor:
                            sprintMode === 'FAST'
                              ? 'rgba(59, 130, 246, 0.15)'
                              : 'rgba(139, 92, 246, 0.15)',
                          color: sprintMode === 'FAST' ? '#3b82f6' : '#8b5cf6',
                          fontWeight: 700,
                        }}
                      >
                        {sprintMode === 'FAST' ? 'Chế độ: Nhanh (Text)' : 'Chế độ: Đầy Đủ (Ảnh & PDF)'}
                      </span>
                      {progress?.currentCode && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                          }}
                        >
                          Đang xử lý: {progress.currentCode}
                          {progress.currentName ? ` (${progress.currentName})` : ''}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {progress?.stage || processingStage || 'Đang thực thi tác vụ trong nền, vui lòng đợi trong giây lát...'}
                    </p>
                  </div>
                </div>

                {/* Phần trăm & Số lượng hồ sơ */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginLeft: 'auto' }}>
                  {progress && progress.total > 0 ? (
                    <>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        Hồ sơ: <strong style={{ color: '#3b82f6' }}>{progress.current}</strong> / {progress.total}
                      </span>
                      <span
                        style={{
                          fontSize: '1.1rem',
                          fontWeight: 800,
                          color: '#3b82f6',
                          fontFamily: 'monospace',
                        }}
                      >
                        {progress.percent}%
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Tự động cập nhật bảng khi hoàn tất
                    </span>
                  )}
                </div>
              </div>

              {/* Hàng dưới: Thanh Progress Bar */}
              <div
                style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  borderRadius: '999px',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progress?.percent && progress.percent > 0 ? progress.percent : (isProcessing ? 20 : 0)}%`,
                    background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #10b981 100%)',
                    borderRadius: '999px',
                    transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Stats Cards (Thống kê KPI) */}
          {(showStats || isTutorialActive) && (
            <TkgdStatsCards
              stats={tkgdStats}
              currentShowing={records.length}
              activeFilter={statusFilter}
              onFilterSelect={(f) => setStatusFilter(f)}
            />
          )}

          {/* Bộ lọc ngày, trạng thái, tìm kiếm */}
          <TkgdFilterBar
            filter={statusFilter}
            setFilter={setStatusFilter}
            batchDate={dateFilter}
            setBatchDate={setDateFilter}
            searchTerm={searchQuery}
            setSearchTerm={setSearchQuery}
            isCompactView={compactView}
            toggleCompactView={toggleCompactView}
            stats={tkgdStats}
            total={total}
            onResetPage={() => setPage(1)}
          />

          {/* Bảng dữ liệu Master Table */}
          <TkgdRecordsTable
            records={records}
            loading={loading}
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
            total={total}
            totalPages={totalPages}
            isCompactView={compactView}
            expandedRowId={expandedRowId}
            setExpandedRowId={setExpandedRowId}
            isProcessing={isProcessing}
            syncingRowCode={syncingRowCode}
            onInspect={handleOpenInspection}
            onSyncMSystem={(code) => handleSyncMSystem(code)}
            onReparseAccount={handleReparseAccount}
          />
        </>
      )}

      {/* =========================================================================
       * MODALS & VIEWER OVERLAYS
       * ========================================================================= */}
      {/* 1. Modal Chi Tiết Đối Soát 3 Chiều */}
      <TkgdInspectionModal
        record={inspectRecord}
        onClose={() => setInspectRecord(null)}
        accountManifest={accountManifest}
        loadingManifest={loadingManifest}
        onPreviewImage={(state) => setPreviewImage(state)}
        onPreviewPdf={(state) => setPreviewPdf(state)}
        apiBaseUrl={API_BASE_URL}
        onRecordUpdated={(updated) => {
          setRecords((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
          setInspectRecord(updated);
          fetchStats();
        }}
      />

      {/* 2. Modal Phóng To & Xoay Ảnh (Lightbox) */}
      {previewImage && (
        <ImageLightboxModal
          previewImage={previewImage}
          onClose={() => setPreviewImage(null)}
          onRotate={rotateCw}
        />
      )}

      {/* 3. Modal Khung Nhúng PDF Xem Trước */}
      {previewPdf && (
        <PdfPreviewFrame
          previewPdf={previewPdf}
          onClose={() => setPreviewPdf(null)}
        />
      )}

      {/* 4. Modal Nhật Ký Tác Vụ TKGD (Audit Logs Độc Lập TTBT) */}
      <TkgdActivityLogsModal
        isOpen={showLogsModal}
        onClose={() => setShowLogsModal(false)}
      />
    </div>
  );
};
