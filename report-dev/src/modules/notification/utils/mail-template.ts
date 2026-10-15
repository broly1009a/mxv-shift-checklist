export const getMailTemplate = (content: string) => {
  return `
    <div style="font-family: 'Roboto', Arial, sans-serif; background-color: #f3f4f6; padding: 16px;">
      <div style="max-width: 600px; background-color: #ffffff; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; margin: 0 auto;">
        <div style="background-color: #ffffff; border-bottom: 1px solid #f3f4f6; padding: 32px; text-align: center;">
          <img alt="MXV Logo" style="height: 64px; width: auto; object-fit: contain;"
            src="${process.env.FRONTEND_URL || "http://10.0.4.19:8080"}/logo/mxv_logo.webp" />
        </div>
        <div style="padding: 32px 40px; color: #4b5563; font-size: 16px; line-height: 1.625;">
          ${content}
        </div>
        <div style="background-color: #f9fafb; border-top: 1px solid #f3f4f6; padding: 24px 40px; text-align: center;">
          <p style="color: #6b7280; font-size: 14px; margin: 0;">
            Lưu ý: Đây là thư gửi tự động từ hệ thống, vui lòng không trả lời thư này.<br>
            Trân trọng,<br>
            MXV
          </p>
        </div>
      </div>
    </div>
  `;
};
