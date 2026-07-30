'use client';

import React, { useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { 
  BookOpen, 
  CheckCircle2, 
  FileSpreadsheet, 
  HelpCircle, 
  Play, 
  Clock, 
  FileCheck,
  AlertTriangle,
  Bot
} from 'lucide-react';

type TabType = 'shift' | 'reconcile' | 'bot' | 'faq';

export default function GuidePage() {
  const [activeTab, setActiveTab] = useState<TabType>('shift');

  return (
    <ProtectedRoute>
      <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ 
            fontSize: '1.8rem', 
            fontWeight: 800, 
            color: 'var(--text-primary)', 
            marginBottom: '8px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px' 
          }}>
            <BookOpen size={32} color="var(--color-accent)" />
            Hướng Dẫn Sử Dụng Hệ Thống
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Tài liệu hướng dẫn quy trình vận hành trực ca, đối chiếu số liệu và quản lý bot RPA tại MXV.
          </p>
        </div>

        {/* Tab Selection */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          marginBottom: '28px', 
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '12px',
          overflowX: 'auto'
        }}>
          {[
            { id: 'shift', label: 'Quy trình Trực ca', icon: Clock },
            { id: 'reconcile', label: 'Đối chiếu Số liệu', icon: FileSpreadsheet },
            { id: 'bot', label: 'Cấu hình & RPA Bot', icon: Bot },
            { id: 'faq', label: 'Xử lý Sự cố / FAQ', icon: HelpCircle },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: isActive ? 'var(--color-accent)' : 'transparent',
                  background: isActive ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                  color: isActive ? 'var(--color-accent)' : 'var(--text-secondary)',
                  fontSize: '0.88rem',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="glass-panel" style={{ padding: '32px', borderRadius: '16px' }}>
          
          {/* Tab 1: Quy trình Trực ca */}
          {activeTab === 'shift' && (
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '20px' }}>
                Quy Trình Trực Ca Vận Hành Hàng Ngày
              </h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid var(--color-accent)',
                    color: 'var(--color-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    flexShrink: 0
                  }}>1</div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>Bắt đầu ca trực</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>
                      Truy cập màn hình <strong>Ca trực hiện tại</strong>. Hệ thống sẽ tự động hiển thị danh sách các công việc (checklist) của ca trực đó dựa trên Mẫu đã cấu hình sẵn.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid var(--color-accent)',
                    color: 'var(--color-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    flexShrink: 0
                  }}>2</div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>Thực hiện công việc</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>
                      Tiến hành kiểm tra hệ thống, tải báo cáo hoặc đối chiếu dữ liệu tương ứng với từng checklist. Khi hoàn thành công việc nào, click tick chọn vào hộp kiểm. Hệ thống sẽ ghi nhận người thực hiện và thời gian hoàn thành.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid var(--color-accent)',
                    color: 'var(--color-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    flexShrink: 0
                  }}>3</div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>Ghi chú sự cố / Note thông tin</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>
                      Nếu công việc gặp sự cố hoặc cần ghi chú thêm thông tin cho ca sau, click vào biểu tượng ghi chú bên phải dòng công việc để nhập nội dung chi tiết.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid var(--color-accent)',
                    color: 'var(--color-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    flexShrink: 0
                  }}>4</div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>Bàn giao ca</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>
                      Khi kết thúc ca, người trực ca click <strong>"Xác nhận bàn giao ca"</strong>. Hệ thống sẽ tự động gộp dữ liệu checklist, các sự cố phát sinh và gửi báo cáo chi tiết trực tiếp lên nhóm chat Telegram của Ban giám sát vận hành.
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ 
                marginTop: '32px', 
                padding: '16px', 
                background: 'rgba(16, 185, 129, 0.04)', 
                border: '1px solid rgba(16, 185, 129, 0.1)', 
                borderRadius: '8px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}>
                <CheckCircle2 size={20} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Mẹo nhỏ cho ca trực:</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0, lineHeight: 1.5 }}>
                    Mỗi ca trực đều có thời gian nhắc nhở hạn chót. Nếu công việc sắp đến hạn mà chưa hoàn thành, hệ thống sẽ tự động bắn cảnh báo lên Telegram để nhắc nhở các thành viên trong ca trực.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Đối chiếu Số liệu */}
          {activeTab === 'reconcile' && (
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '20px' }}>
                Quy Trình Đối Chiếu Số Liệu Giao Dịch
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '24px' }}>
                Đối chiếu số liệu là công việc cực kỳ quan trọng để đảm bảo tính khớp lệnh 3 bên: <strong>M-System (Hệ thống MXV)</strong>, <strong>CQG (Đối tác giao dịch quốc tế)</strong> và <strong>Straits Financial (ACM/Nano - Đối tác thanh toán)</strong>.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '28px' }}>
                <div style={{ padding: '20px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '6px', borderRadius: '6px' }}>
                      <FileCheck size={18} color="var(--color-accent)" />
                    </div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Đối chiếu KLGD Trong Phiên
                    </h3>
                  </div>
                  <ul style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', paddingLeft: '20px', lineHeight: 1.7, margin: 0 }}>
                    <li><strong>Mục tiêu:</strong> Giám sát khớp lệnh real-time giữa MS và CQG.</li>
                    <li><strong>Chu kỳ:</strong> Chạy tự động định kỳ 1 giờ/lần.</li>
                    <li><strong>Dữ liệu:</strong> So khớp các giao dịch thô phát sinh trong phiên.</li>
                    <li><strong>Phản hồi:</strong> Cảnh báo ngay lập tức nếu lệch khối lượng hoặc giá khớp.</li>
                  </ul>
                </div>

                <div style={{ padding: '20px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '6px', borderRadius: '6px' }}>
                      <FileCheck size={18} color="var(--color-accent)" />
                    </div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Đối chiếu Pre-EOD (Cuối ngày T-1)
                    </h3>
                  </div>
                  <ul style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', paddingLeft: '20px', lineHeight: 1.7, margin: 0 }}>
                    <li><strong>Mục tiêu:</strong> Khóa chốt số liệu 3 bên trước giờ EOD.</li>
                    <li><strong>Dữ liệu đối chiếu:</strong>
                      <ul style={{ paddingLeft: '16px' }}>
                        <li>File Straits CSV (ACM Nano)</li>
                        <li>File tổng hợp CQG (Giao dịch, Vị thế ròng, Trạng thái mở)</li>
                        <li>Báo cáo kết xuất từ M-System</li>
                      </ul>
                    </li>
                    <li><strong>Hành động:</strong> Bắt buộc chạy trước khi chạy quy trình EOD.</li>
                  </ul>
                </div>
              </div>

              <div style={{ 
                padding: '16px', 
                background: 'rgba(245, 158, 11, 0.04)', 
                border: '1px solid rgba(245, 158, 11, 0.1)', 
                borderRadius: '8px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}>
                <AlertTriangle size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Nguyên tắc đối chiếu tệp thô CQG:</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0, lineHeight: 1.5 }}>
                    Hệ thống tích hợp tính năng <strong>CQG Raw Files Auto-Merging</strong>. Khi tải báo cáo thô từ 2 tài khoản CQG về (`FR1` + `FR2`, `PS1` + `PS2`...), hệ thống sẽ tự động ghép nối thành file gộp chuẩn (`FR.xlsx`, `PS.xlsx`...) để tiến hành đối chiếu, giảm bớt thao tác thủ công.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Cấu hình & RPA Bot */}
          {activeTab === 'bot' && (
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '20px' }}>
                Hướng Dẫn Vận Hành Hệ Thống Bot & RPA
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '24px' }}>
                Hệ thống sử dụng các bot RPA tự động để đăng nhập vào cổng thông tin M-System/CQG, tải báo cáo và thực hiện đối chiếu định kỳ.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '10px', borderRadius: '8px', color: 'var(--color-accent)', flexShrink: 0 }}>
                    <Play size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Đăng nhập & Bắt đầu tự động tải báo cáo
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>
                      Bot RPA được thiết lập để tự động chạy ngầm. Quản trị viên có thể cấu hình tài khoản, mật khẩu, cookie đăng nhập và URL đích của các cổng thông tin M-System hoặc CQG trong màn hình <strong>Cấu hình Bot/RPA</strong>.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '10px', borderRadius: '8px', color: 'var(--color-accent)', flexShrink: 0 }}>
                    <Play size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Cơ chế chạy Lot & Value Macro
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>
                      Bot thống kê báo cáo CCP được thiết lập để chạy hai tác vụ Lot Macro (Thống kê khối lượng) và Value Macro (Thống kê giá trị ký quỹ). Hãy chắc chắn rằng file nguồn Excel được tải lên đúng thư mục chỉ định của hệ thống trước giờ chạy Job.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '10px', borderRadius: '8px', color: 'var(--color-accent)', flexShrink: 0 }}>
                    <Play size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Quét Ký Quỹ Âm (Negative Margin Checking)
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>
                      Bot sẽ quét định kỳ trạng thái tài khoản ký quỹ của khách hàng. Nếu phát hiện tài khoản có số dư ký quỹ âm vượt quá ngưỡng an toàn, hệ thống sẽ tự động phát tín hiệu cảnh báo khẩn cấp lên Telegram cho Ban Quản lý rủi ro xử lý.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Câu hỏi thường gặp / Sự cố */}
          {activeTab === 'faq' && (
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '20px' }}>
                Xử Lý Sự Cố Thường Gặp
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    ❓ Tại sao bot báo lỗi không tải được tệp tin Straits CSV?
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.5, margin: 0 }}>
                    <strong>Trả lời:</strong> Straits CSV phải chứa từ khóa <code>Straits</code> trong tên tệp tin (ví dụ: <code>Straits.csv</code> hoặc <code>Straits_23072026.csv</code>). Nếu file tải lên không chứa từ khóa này, hệ thống sẽ không nhận diện để tiến hành đối chiếu ACM. Vui lòng kiểm tra lại tên file.
                  </p>
                </div>

                <div style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    ❓ Tôi quên không check hoàn thành công việc đúng giờ trực thì có sao không?
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.5, margin: 0 }}>
                    <strong>Trả lời:</strong> Hệ thống giám sát tự động sẽ gửi cảnh báo chậm ca trực lên Telegram nếu phát hiện các checklist quan trọng bị quá giờ (deadline) cấu hình. Bạn vẫn có thể tích chọn hoàn thành muộn và ghi chú rõ lý do chậm trễ vào ô Note của công việc.
                  </p>
                </div>

                <div style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    ❓ RPA Bot không tự động tải báo cáo M-System được?
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.5, margin: 0 }}>
                    <strong>Trả lời:</strong> Thông thường là do mật khẩu tài khoản M-System hoặc Token cookie đã hết hạn. Hãy cập nhật lại thông tin tài khoản hợp lệ trong phần <strong>Cấu hình Bot/RPA</strong> để RPA kích hoạt lại phiên làm việc mới.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </ProtectedRoute>
  );
}
