export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Phiếu Theo Dõi Thực Hiện Trực Giao Dịch - MXV</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body { background: #fff; color: #000; }
          @media print {
            @page { size: A4; margin: 10mm; }
            html, body { background: #fff !important; }
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
