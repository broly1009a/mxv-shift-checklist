# Hướng dẫn Tích hợp Đăng nhập Thực tế Microsoft 365 (SSO) cho TradingMXV

Tài liệu này hướng dẫn chi tiết cách cấu hình và triển khai tính năng đăng nhập thực tế bằng tài khoản Microsoft 365 doanh nghiệp (`hieptruong@mxv.vn`) cho hệ thống TradingMXV (Next.js Frontend & NestJS Backend).

Chúng ta sẽ sử dụng luồng **OAuth2 Authorization Code Flow** tiêu chuẩn. Luồng này chuyển hướng người dùng trực tiếp đến trang đăng nhập bảo mật của Microsoft, sau đó trao đổi mã xác thực trên backend để lấy thông tin tài khoản. Phương pháp này bảo mật tối đa (không lộ Client Secret ở client) và không cần cài thêm các thư viện cồng kềnh.

---

## Phần 1: Đăng ký Ứng dụng trên Microsoft Entra ID (Azure Portal)

Bạn cần đăng ký ứng dụng của mình trong Microsoft Entra ID của doanh nghiệp để lấy thông tin Client ID và Client Secret.

### Các bước thực hiện:

1. **Truy cập Cổng Quản lý**:
   - Truy cập **[Microsoft Entra admin center](https://entra.microsoft.com/)** hoặc **[Azure Portal](https://portal.azure.com/)**.
   - Đăng nhập bằng tài khoản **`hieptruong@mxv.vn`** do công ty cung cấp.
   > [!NOTE]
   > Nếu nút tạo ứng dụng bị vô hiệu hóa hoặc bị ẩn, có nghĩa là IT Administrator của Sở MXV đã giới hạn quyền tự đăng ký ứng dụng của nhân viên. Khi đó, bạn cần gửi yêu cầu cho IT Admin để họ tạo ứng dụng hộ và cung cấp lại cho bạn các thông số dưới đây.

2. **Đăng ký Ứng dụng mới (App Registration)**:
   - Trong menu bên trái, chọn **Microsoft Entra ID** (hoặc **Azure Active Directory**).
   - Chọn mục **App registrations** -> click **New registration**.
   - Điền các thông tin:
     - **Name**: Nhập tên gợi nhớ (ví dụ: `TradingMXV-Dev` hoặc `MXV Shift Checklist`).
     - **Supported account types**: Chọn dòng thứ 1: **"Accounts in this organizational directory only (Mercantile Exchange of Vietnam only - Single Tenant)"** để chỉ cho phép các tài khoản có đuôi `@mxv.vn` đăng nhập.
     - **Redirect URI**: 
       - Chọn loại platform là **Web**.
       - Điền URL callback của Backend khi chạy localhost: `http://localhost:3000/api/v1/auth/microsoft/callback`. *(Khi deploy lên staging/production, bạn sẽ thêm URL tương ứng vào đây)*.
   - Nhấn **Register** để hoàn tất.

3. **Lấy Client ID và Tenant ID**:
   - Sau khi tạo xong, bạn sẽ được đưa đến trang **Overview** của ứng dụng.
   - Hãy copy và lưu lại 2 giá trị:
     - **Application (client) ID**
     - **Directory (tenant) ID**

4. **Tạo Client Secret**:
   - Trong menu bên trái của ứng dụng, chọn **Certificates & secrets** -> click **Client secrets** -> chọn **New client secret**.
   - Nhập mô tả (ví dụ: `Dev Secret`) và chọn thời hạn hết hạn (khuyến nghị 180 ngày hoặc 1 năm).
   - Click **Add**.
   - > [!IMPORTANT]
     > Hãy copy ngay giá trị cột **Value** (không phải Secret ID). Giá trị này chỉ hiển thị duy nhất một lần tại thời điểm tạo. Nếu bạn tải lại trang, nó sẽ bị ẩn vĩnh viễn.

5. **Cấu hình Quyền API (API Permissions)**:
   - Vào mục **API permissions** -> click **Add a permission** -> chọn **Microsoft Graph** -> chọn **Delegated permissions**.
   - Tìm kiếm và tích chọn các quyền cơ bản:
     - `openid`
     - `profile`
     - `email`
     - `User.Read` (thường đã được tích sẵn mặc định).
   - Nhấn **Add permissions** ở cuối trang để lưu lại.

---

## Phần 2: Cấu hình Biến Môi Trường (Environment Variables)

Thêm các thông số đã lấy được vào file cấu hình môi trường `.env` của **Backend** (thường nằm ở root của thư mục `backend`):

```env
# Microsoft 365 OAuth2 Configuration
MICROSOFT_CLIENT_ID=your_client_id_here
MICROSOFT_CLIENT_SECRET=your_client_secret_value_here
MICROSOFT_TENANT_ID=your_tenant_id_here
MICROSOFT_CALLBACK_URL=http://localhost:3000/api/v1/auth/microsoft/callback
FRONTEND_URL=http://localhost:3000
```

---

## Phần 3: Cài đặt và Tích hợp Code vào Ứng dụng

### 1. Cập nhật phía Backend (NestJS)

Chúng ta sẽ sử dụng trực tiếp tính năng `fetch` có sẵn trong Node.js (từ bản v18 trở đi đã được hỗ trợ mặc định) để gọi Microsoft API mà không cần cài thêm thư viện nào khác.

#### Bước A: Cập nhật `auth.service.ts`

Thêm phương thức xử lý trao đổi mã xác thực (Authorization Code) lấy thông tin User từ Microsoft Graph API.

Mở file [auth.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/TradingMXV/backend/src/modules/auth/auth.service.ts):
```typescript
// Thêm phương thức này vào class AuthService

async exchangeMicrosoftCode(code: string) {
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_CALLBACK_URL;

  // 1. Gửi request POST lên Microsoft để đổi Authorization Code lấy Access Token
  const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      scope: 'openid profile email User.Read',
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      client_secret: clientSecret,
    }),
  });

  if (!tokenResponse.ok) {
    const errData = await tokenResponse.json();
    throw new UnauthorizedException(errData.error_description || 'Không thể xác thực mã với Microsoft.');
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  // 2. Sử dụng Access Token để lấy thông tin chi tiết của user từ Microsoft Graph API
  const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!profileResponse.ok) {
    throw new UnauthorizedException('Không thể lấy thông tin tài khoản từ Microsoft Graph.');
  }

  const profile = await profileResponse.json();
  const email = profile.mail || profile.userPrincipalName;
  const fullName = profile.displayName;

  // 3. Gọi hàm validate hiện có để kiểm tra/tạo tài khoản trong DB của bạn
  const user = await this.validateMicrosoftSSO(email, fullName);
  
  // 4. Sinh JWT nội bộ của hệ thống và trả về
  return this.login(user);
}
```

#### Bước B: Cập nhật `auth.controller.ts`

Tạo 2 endpoint mới: một để redirect user sang Microsoft, một làm Callback nhận kết quả từ Microsoft.

Mở file [auth.controller.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/TradingMXV/backend/src/modules/auth/auth.controller.ts):
```typescript
// Thêm import Response từ express và các decorator cần thiết: Get, Query, Res
import { Controller, Post, Body, Get, Put, UseGuards, Request, UnauthorizedException, Res, Query } from '@nestjs/common';
import { Response } from 'express';

// Thêm 2 endpoints mới vào class AuthController

@Get('microsoft')
async microsoftLogin(@Res() res: Response) {
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.MICROSOFT_CALLBACK_URL || '');
  const scope = encodeURIComponent('openid profile email User.Read');
  
  // Tạo đường dẫn redirect sang trang đăng nhập của Microsoft
  const authorizationUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&response_mode=query&scope=${scope}&state=mxv_auth_state`;
  
  return res.redirect(authorizationUrl);
}

@Get('microsoft/callback')
async microsoftCallback(@Query('code') code: string, @Res() res: Response) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  if (!code) {
    return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent('Không nhận được mã xác thực từ Microsoft')}`);
  }
  
  try {
    // Đổi code lấy token và thông tin user
    const result = await this.authService.exchangeMicrosoftCode(code);
    
    // Đăng nhập thành công -> Redirect về Frontend kèm JWT và thông tin User dưới dạng query parameter
    const token = result.access_token;
    const userStr = encodeURIComponent(JSON.stringify(result.user));
    
    return res.redirect(`${frontendUrl}/login?token=${token}&user=${userStr}`);
  } catch (error: any) {
    const errorMsg = error.message || 'Đăng nhập Microsoft thất bại';
    return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(errorMsg)}`);
  }
}
```

---

### 2. Cập nhật phía Frontend (Next.js)

Phía Frontend chỉ cần thực hiện 2 việc đơn giản:
1. Khi nhấn nút "Đăng nhập bằng Microsoft 365", chuyển hướng (redirect) trình duyệt sang API của Backend (`/api/v1/auth/microsoft`).
2. Khi Microsoft Redirect về Frontend (kèm theo các thông tin xác thực trên URL), frontend sẽ đọc URL, lưu Token vào LocalStorage và cập nhật Context.

#### Bước A: Cập nhật nút Đăng nhập trong `login/page.tsx`

Thay vì mở modal giả lập, chuyển hướng trực tiếp người dùng sang Backend:

Mở file [page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/TradingMXV/frontend/src/app/login/page.tsx):
- Chỉnh sửa sự kiện `onClick` của nút **Đăng nhập bằng Microsoft 365**:

```typescript
// Sửa sự kiện onClick của nút Microsoft 365 Login ở dòng 215-219 thành:
onClick={() => {
  setError('');
  setSuccess('');
  // Chuyển hướng trực tiếp sang API redirect của Backend
  const backendBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  window.location.href = `${backendBaseUrl}/api/v1/auth/microsoft`;
}}
```

#### Bước B: Xử lý nhận Token từ URL trong `login/page.tsx`

Thêm logic vào `useEffect` để bắt thông tin đăng nhập thành công từ URL:

```typescript
// Bổ sung xử lý URL parameters vào useEffect hiện tại trong login/page.tsx
useEffect(() => {
  // 1. Kiểm tra nếu đã có user đăng nhập rồi thì chuyển sang Dashboard
  if (user) {
    router.push('/dashboard');
    return;
  }

  // 2. Kiểm tra các tham số trả về trên URL sau khi đăng nhập qua Microsoft
  const urlParams = new URLSearchParams(window.location.search);
  const tokenVal = urlParams.get('token');
  const userJson = urlParams.get('user');
  const errorParam = urlParams.get('error');

  if (tokenVal && userJson) {
    try {
      const userVal = JSON.parse(decodeURIComponent(userJson));
      
      // Lưu vào localStorage
      localStorage.setItem('mxv_token', tokenVal);
      localStorage.setItem('mxv_user', JSON.stringify(userVal));
      
      setSuccess('Đăng nhập Microsoft 365 thành công! Đang chuyển hướng...');
      
      // Reload trang để AuthProvider tự động đọc dữ liệu mới từ localStorage và cập nhật state
      window.location.href = '/dashboard';
    } catch (e) {
      setError('Lỗi phân tích thông tin tài khoản.');
    }
  } else if (errorParam) {
    setError(decodeURIComponent(errorParam));
  }
}, [user, router]);
```

---

## Phần 4: Quy trình Kiểm thử (Testing)

1. Đảm bảo Backend (`npm run start:dev`) và Frontend (`npm run dev`) đều đang chạy.
2. Mở trình duyệt ẩn danh (Incognito) để tránh bị tự động đăng nhập bằng tài khoản Microsoft cũ.
3. Truy cập trang Đăng nhập: `http://localhost:3000/login`.
4. Nhấn nút **Đăng nhập bằng Microsoft 365**.
5. Trình duyệt sẽ chuyển hướng đến trang đăng nhập Microsoft:
   - Nhập tài khoản: `hieptruong@mxv.vn`.
   - Nhập mật khẩu cơ quan của bạn.
   - Xác thực OTP/MFA nếu công ty yêu cầu.
6. Microsoft sẽ hỏi xác nhận quyền truy cập lần đầu. Nhấn **Accept** (Chấp nhận).
7. Hệ thống sẽ redirect ngược lại Backend callback -> Backend xử lý và tự động tạo tài khoản trong DB -> redirect về Frontend kèm token -> Bạn sẽ đăng nhập thành công và vào màn hình Dashboard.
