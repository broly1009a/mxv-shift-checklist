import { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { SprintMode, TkgdProgressState, TkgdAutoPipelineStatus } from '../types/tkgd.types';
import { tkgdApi } from '../services/tkgd.api';

interface UseTkgdActionsProps {
  batchDate?: string;
  token?: string | null;
  userEmail?: string;
  onSuccess?: () => Promise<void> | void;
}

export function useTkgdActions({ batchDate, token, userEmail, onSuccess }: UseTkgdActionsProps = {}) {
  const [sprintMode, setSprintMode] = useState<SprintMode>('FULL');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [progress, setProgress] = useState<TkgdProgressState | null>(null);
  const [syncingRowCode, setSyncingRowCode] = useState<string | null>(null);
  const [autoStatus, setAutoStatus] = useState<TkgdAutoPipelineStatus | null>(null);

  // Lấy trạng thái Tự Động Hóa 24/7
  const fetchAutoStatus = useCallback(async () => {
    try {
      const st = await tkgdApi.getAutoPipelineStatus(token, userEmail);
      if (st) setAutoStatus(st);
    } catch { }
  }, [token, userEmail]);

  useEffect(() => {
    fetchAutoStatus();
    const interval = setInterval(fetchAutoStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchAutoStatus]);

  // Bật/Tắt chế độ Tự Động 24/7
  const handleToggleAutoPipeline = useCallback(async (enabled?: any) => {
    try {
      // Đảm bảo chỉ nhận giá trị boolean, tránh React SyntheticEvent gây lỗi Circular JSON
      const boolVal = typeof enabled === 'boolean' ? enabled : undefined;
      const res = await tkgdApi.toggleAutoPipeline(boolVal, token, userEmail);
      toast.success(res.message);
      await fetchAutoStatus();
    } catch (err: any) {
      toast.error('Lỗi khi đổi trạng thái Tự Động: ' + err.message);
    }
  }, [token, userEmail, fetchAutoStatus]);

  // Poll tiến độ thời gian thực khi isProcessing = true
  useEffect(() => {
    let timer: any = null;
    if (isProcessing) {
      const fetchProgress = async () => {
        try {
          const p = await tkgdApi.getProgress(token, userEmail);
          if (p) setProgress(p);
        } catch { }
      };
      fetchProgress();
      timer = setInterval(fetchProgress, 1000);
    } else {
      setProgress(null);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isProcessing, token, userEmail]);

  // Nút 1: Quét Mail Outlook
  const handleSyncMail = useCallback(async () => {
    setIsProcessing(true);
    setProcessingStage('Đang đọc email Outlook yêu cầu mở TKGD mới...');
    try {
      const data = await tkgdApi.syncMail(batchDate, token, userEmail);
      if (data?.success) {
        toast.success(data.message || `Đã nạp thành công ${data.count} email!`);
        if (onSuccess) await onSuccess();
      } else {
        toast.error(data?.message || 'Quét mail thất bại');
      }
    } catch (err: any) {
      toast.error('Lỗi khi quét mail: ' + err.message);
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  }, [batchDate, token, userEmail, onSuccess]);

  // Nút 2: Cào M-System (1 hồ sơ hoặc tất cả)
  const handleSyncMSystem = useCallback(
    async (investorCode?: string) => {
      setIsProcessing(true);
      if (investorCode) setSyncingRowCode(investorCode);
      setProcessingStage(
        investorCode
          ? `Đang cào dữ liệu M-System cho tài khoản ${investorCode}...`
          : `Đang đăng nhập M-System và cào danh sách hồ sơ...`
      );
      try {
        const data = await tkgdApi.syncMSystem(
          {
            investorCode,
            downloadImages: sprintMode === 'FULL',
            batchDate,
          },
          token,
          userEmail
        );
        if (data?.success) {
          toast.success(data.message || 'Đã cào M-System thành công!');
          if (onSuccess) await onSuccess();
        } else {
          toast.error(data?.message || 'Cào M-System thất bại');
        }
      } catch (err: any) {
        toast.error('Lỗi khi cào M-System: ' + err.message);
      } finally {
        setIsProcessing(false);
        setProcessingStage('');
        setSyncingRowCode(null);
      }
    },
    [sprintMode, batchDate, token, userEmail, onSuccess]
  );

  // Nút 3: Chạy quy trình Tổng Hợp Toàn Bộ (All-in-One)
  const handleRunPipelineAll = useCallback(async () => {
    setIsProcessing(true);
    setProcessingStage('Đang khởi chạy chu trình Tổng Hợp Toàn Bộ (A-Z)...');
    try {
      const data = await tkgdApi.runPipelineAll(
        {
          downloadImages: sprintMode === 'FULL',
          batchDate,
        },
        token,
        userEmail
      );
      if (data?.success) {
        toast.success(data.message || 'Hoàn tất toàn bộ chu trình!');
        if (onSuccess) await onSuccess();
      } else {
        toast.error(data?.message || 'Chạy toàn bộ thất bại');
      }
    } catch (err: any) {
      toast.error('Lỗi chu trình toàn bộ: ' + err.message);
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  }, [sprintMode, batchDate, token, userEmail, onSuccess]);

  // Kích hoạt chạy đối soát chéo
  const handleRunReconcile = useCallback(async () => {
    setIsProcessing(true);
    setProcessingStage('Đang đối soát chéo dữ liệu và tạo file Excel...');
    try {
      const data = await tkgdApi.runReconcile(token, userEmail);
      if (data?.success) {
        toast.success(
          `Đối soát thành công! Khớp: ${data.summary?.khopCount || 0}, Lệch: ${data.summary?.lechCount || 0}`
        );
        if (onSuccess) await onSuccess();
      } else {
        toast.error(data?.message || 'Chạy đối soát thất bại');
      }
    } catch (err: any) {
      toast.error('Lỗi khi chạy đối soát: ' + err.message);
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  }, [token, userEmail, onSuccess]);

  // Tải file Excel đối soát về máy
  const handleDownloadExcel = useCallback(async () => {
    try {
      let blob = await tkgdApi.downloadExcelBlob(token, userEmail);
      if (!blob) {
        toast('Chưa có file sẵn trên máy chủ, đang tự động chạy đối soát để tạo file...', { icon: 'ℹ️' });
        await handleRunReconcile();
        blob = await tkgdApi.downloadExcelBlob(token, userEmail);
        if (!blob) throw new Error('Không tìm thấy file Excel sau khi chạy đối soát.');
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Auto_Data_mail_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Đã tải file Excel kết quả đối soát thành công!');
    } catch (err: any) {
      toast.error('Lỗi khi tải file Excel: ' + err.message);
    }
  }, [token, userEmail, handleRunReconcile]);

  return {
    sprintMode,
    setSprintMode,
    isProcessing,
    processingStage,
    progress,
    autoStatus,
    handleToggleAutoPipeline,
    fetchAutoStatus,
    syncingRowCode,
    handleSyncMail,
    handleSyncMSystem,
    handleRunPipelineAll,
    handleRunReconcile,
    handleDownloadExcel,
  };
}
