import { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { SprintMode, TkgdProgressState, TkgdAutoPipelineStatus, RunPipelineOptions } from '../types/tkgd.types';
import { tkgdApi } from '../services/tkgd.api';

interface UseTkgdActionsProps {
  batchDate?: string;
  token?: string | null;
  userEmail?: string;
  onSuccess?: () => Promise<void> | void;
}

// Âm thanh chuông báo hoàn thành nhẹ nhàng qua Web Audio API
function playNotificationChime() {
  try {
    if (typeof window === 'undefined') return;
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.4);

      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 500);
    }
  } catch {}
}

export function useTkgdActions({ batchDate, token, userEmail, onSuccess }: UseTkgdActionsProps = {}) {
  const [sprintMode, setSprintMode] = useState<SprintMode>('FULL');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [progress, setProgress] = useState<TkgdProgressState | null>(null);
  const [syncingRowCode, setSyncingRowCode] = useState<string | null>(null);
  const [autoStatus, setAutoStatus] = useState<TkgdAutoPipelineStatus | null>(null);

  // Lấy trạng thái Auto Pipeline hiện tại
  const fetchAutoStatus = useCallback(async () => {
    try {
      const status = await tkgdApi.getAutoPipelineStatus(token, userEmail);
      if (status) setAutoStatus(status);
    } catch { }
  }, [token, userEmail]);

  useEffect(() => {
    fetchAutoStatus();
    const interval = setInterval(fetchAutoStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchAutoStatus]);

  // Bật/tắt Auto Pipeline
  const handleToggleAutoPipeline = useCallback(async (boolVal: boolean) => {
    try {
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
          if (p) {
            setProgress(p);
            // Khi tác vụ ngầm kết thúc (percent 100 hoặc isProcessing false)
            if (!p.isProcessing && (p.percent === 100 || p.taskType === 'IDLE')) {
              setIsProcessing(false);
              setProcessingStage('');
              playNotificationChime();
              toast.success(p.detail || 'Đã hoàn tất chu trình bóc tách & đối soát TKGD!', {
                duration: 4500,
                icon: '✅',
              });
              if (onSuccess) await onSuccess();
            }
          }
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
  }, [isProcessing, token, userEmail, onSuccess]);

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

  // Quét lại Email & Bóc tách lại File cho 1 hồ sơ cụ thể
  const handleReparseAccount = useCallback(
    async (recordId: string, accountCode?: string) => {
      setIsProcessing(true);
      if (accountCode) setSyncingRowCode(accountCode);
      setProcessingStage(
        accountCode
          ? `Đang quét lại email và bóc tách lại file cho hồ sơ ${accountCode}...`
          : `Đang quét lại email và bóc tách lại file cho hồ sơ...`
      );
      try {
        const data = await tkgdApi.reparseAccount(
          {
            recordId,
            accountCode,
            batchDate,
          },
          token,
          userEmail
        );
        if (data?.success) {
          toast.success(data.message || 'Đã bóc tách lại hồ sơ thành công!');
          if (onSuccess) await onSuccess();
        } else {
          toast.error(data?.message || 'Bóc tách lại hồ sơ thất bại');
        }
      } catch (err: any) {
        toast.error('Lỗi khi bóc tách lại hồ sơ: ' + err.message);
      } finally {
        setIsProcessing(false);
        setProcessingStage('');
        setSyncingRowCode(null);
      }
    },
    [batchDate, token, userEmail, onSuccess]
  );

  // Nút 3: Chạy quy trình Tổng Hợp Toàn Bộ (All-in-One)
  const handleRunPipelineAll = useCallback(
    async (customOptions?: Partial<RunPipelineOptions>) => {
      setIsProcessing(true);
      setProcessingStage('Đang khởi chạy chu trình Tổng Hợp Toàn Bộ...');
      try {
        const data = await tkgdApi.runPipelineAll(
          {
            downloadImages: sprintMode === 'FULL',
            batchDate,
            ...customOptions,
          },
          token,
          userEmail
        );
        if (data?.success) {
          toast.success(data.message || 'Đã khởi chạy chu trình thành công!');
          // Không tắt isProcessing ở đây để useEffect tiếp tục poll getProgress cho tới khi xong
        } else {
          toast.error(data?.message || 'Chạy toàn bộ thất bại');
          setIsProcessing(false);
          setProcessingStage('');
        }
      } catch (err: any) {
        toast.error('Lỗi chu trình toàn bộ: ' + err.message);
        setIsProcessing(false);
        setProcessingStage('');
      }
    },
    [sprintMode, batchDate, token, userEmail]
  );

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
    handleReparseAccount,
    handleRunPipelineAll,
    handleRunReconcile,
    handleDownloadExcel,
  };
}
