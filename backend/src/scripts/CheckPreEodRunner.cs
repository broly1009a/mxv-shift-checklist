using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using OfficeOpenXml;

namespace TestPreEodCSharp
{
    class Program
    {
        public class PreEODFiles
        {
            public byte[] Dsgd { get; set; }
            public byte[] AcmTrades { get; set; }
            public byte[] CqgFr { get; set; }
            public byte[] Tttt { get; set; }
            public byte[] CqgPs { get; set; }
        }

        public class PreEODTotals
        {
            public decimal TotalACM_MS { get; set; }
            public decimal TotalACM_Straits { get; set; }
            public decimal DifferACM { get; set; }
            public decimal TotalCQG_MS { get; set; }
            public decimal TotalCQG_FR { get; set; }
            public decimal DifferCQG { get; set; }
        }

        public class MismatchedTrade
        {
            public string Source { get; set; }
            public string MaLenh { get; set; }
            public string MaTKGD { get; set; }
            public string MaHD { get; set; }
            public decimal GiaKhop { get; set; }
            public decimal KlGiaoDich { get; set; }
            public string NgayGio { get; set; }
            public string Reason { get; set; }
        }

        public class MismatchedPosition
        {
            public string Account { get; set; }
            public string Symbol { get; set; }
            public decimal MsPosition { get; set; }
            public decimal CQGPosition { get; set; }
            public decimal Differ { get; set; }
        }

        public class PreEODResult
        {
            public bool Passed { get; set; }
            public PreEODTotals Totals { get; set; }
            public List<MismatchedTrade> MismatchedTrades { get; set; }
            public List<MismatchedPosition> MismatchedPositions { get; set; }
        }

        public class DsgdRow
        {
            public string MaLenh { get; set; }
            public string MaTKGD { get; set; }
            public string MaHD { get; set; }
            public decimal KlGiaoDich { get; set; }
            public decimal GiaKhop { get; set; }
            public string NgayGio { get; set; }
            public string CombinedKey { get; set; }
        }

        public class FrRow
        {
            public string Ord { get; set; }
            public string Account { get; set; }
            public string Symbol { get; set; }
            public decimal Qty { get; set; }
            public decimal FillP { get; set; }
            public string Time { get; set; }
            public string AccountRaw { get; set; }
            public string CombinedKey { get; set; }
        }

        public class PositionReconItem
        {
            public string Account { get; set; }
            public string Symbol { get; set; }
            public decimal Position { get; set; }
        }

        public struct StraitsCsvResult
        {
            public decimal TotalVolume { get; set; }
        }

        private static readonly Dictionary<string, string> LmeCodeMap = new Dictionary<string, string>
        {
            { "LALZ", "AHD" },
            { "LDKZ", "CAD" },
            { "LEDZ", "PBD" },
            { "LNIZ", "NID" },
            { "LTIZ", "SND" },
            { "LZHZ", "ZDS" }
        };

        private static readonly Dictionary<string, string> ReverseMonthCode = new Dictionary<string, string>
        {
            { "01", "F" },
            { "02", "G" },
            { "03", "H" },
            { "04", "J" },
            { "05", "K" },
            { "06", "M" },
            { "07", "N" },
            { "08", "Q" },
            { "09", "U" },
            { "10", "V" },
            { "11", "X" },
            { "12", "Z" }
        };

        public static decimal ParseCqgNumber(string val)
        {
            if (string.IsNullOrWhiteSpace(val)) return 0;
            string str = val.Trim();

            if (str.Contains(","))
            {
                str = str.Replace(".", "").Replace(",", ".");
            }

            decimal num;
            if (decimal.TryParse(str, NumberStyles.Any, CultureInfo.InvariantCulture, out num))
            {
                return num;
            }

            return 0;
        }

        private static string NormalizeHeader(string str)
        {
            if (string.IsNullOrWhiteSpace(str)) return "";

            string temp = str.Normalize(NormalizationForm.FormD);
            StringBuilder sb = new StringBuilder();
            foreach (char c in temp)
            {
                if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                {
                    sb.Append(c);
                }
            }

            string result = sb.ToString().Normalize(NormalizationForm.FormC).ToLower();
            result = System.Text.RegularExpressions.Regex.Replace(result, @"\s+", " ");
            return result.Trim();
        }

        private static int FindHeaderIndex(List<string> headers, string target, List<string> aliases)
        {
            if (headers == null) return -1;
            aliases = aliases ?? new List<string>();

            string normTarget = NormalizeHeader(target);
            List<string> normAliases = aliases.Select(NormalizeHeader).ToList();

            for (int i = 0; i < headers.Count; i++)
            {
                string normH = NormalizeHeader(headers[i]);
                if (normH == normTarget || normAliases.Contains(normH))
                {
                    return i;
                }
            }

            return -1;
        }

        private static string FormatDDMMYYYY(DateTime d)
        {
            return d.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);
        }

        private static string GetNormalizedAccount(string account)
        {
            if (string.IsNullOrEmpty(account)) return "";
            string acc = account.Trim();
            acc = System.Text.RegularExpressions.Regex.Replace(acc, "F$", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            acc = System.Text.RegularExpressions.Regex.Replace(acc, "L$", "-L", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            acc = System.Text.RegularExpressions.Regex.Replace(acc, "S$", "-S", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            acc = acc.Replace("--", "-");
            return acc.ToUpperInvariant();
        }

        private static decimal ParseCellValueDecimal(ExcelRange cell)
        {
            if (cell.Value == null) return 0;
            if (cell.Value is double || cell.Value is decimal || cell.Value is int || cell.Value is long || cell.Value is float)
            {
                return Convert.ToDecimal(cell.Value);
            }
            return ParseCqgNumber(cell.Text);
        }

        public static string ConvertLMESymbol(string symbol, DateTime date, List<string> holidays)
        {
            if (string.IsNullOrEmpty(symbol) || !LmeCodeMap.ContainsKey(symbol))
            {
                return symbol;
            }

            holidays = holidays ?? new List<string>();
            DateTime adjustedDate = date.AddMonths(3);

            if (adjustedDate.DayOfWeek == DayOfWeek.Saturday)
            {
                adjustedDate = adjustedDate.AddDays(-1);
            }
            else if (adjustedDate.DayOfWeek == DayOfWeek.Sunday)
            {
                adjustedDate = adjustedDate.AddDays(1);
            }

            string adjustedDateStr = FormatDDMMYYYY(adjustedDate);

            Dictionary<string, string> dayoffMap = new Dictionary<string, string>();
            foreach (string h in holidays)
            {
                if (string.IsNullOrEmpty(h)) continue;
                string[] parts = h.Split(',');
                if (parts.Length >= 2)
                {
                    dayoffMap[parts[0].Trim()] = parts[1].Trim();
                }
            }

            while (dayoffMap.ContainsKey(adjustedDateStr))
            {
                string nextDateStr = dayoffMap[adjustedDateStr];
                if (string.IsNullOrEmpty(nextDateStr)) break;
                adjustedDateStr = nextDateStr;
                DateTime nextDate;
                if (DateTime.TryParseExact(adjustedDateStr, "dd/MM/yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out nextDate))
                {
                    adjustedDate = nextDate;
                }
                else
                {
                    break;
                }
            }

            string newDay = adjustedDate.Day.ToString("D2");
            string newMonth = adjustedDate.Month.ToString("D2");
            string newYear = adjustedDate.Year.ToString();

            string mapped = LmeCodeMap[symbol];
            string monthCode;
            if (!ReverseMonthCode.TryGetValue(newMonth, out monthCode))
            {
                throw new Exception(string.Format("Convert month failed for: {0}", newMonth));
            }
            string yearShort = newYear.Substring(2);

            return string.Format("{0}D{1}{2}{3}", mapped, newDay, monthCode, yearShort);
        }

        private static string FormatPriceForComparison(decimal val)
        {
            return ((double)val).ToString(CultureInfo.InvariantCulture);
        }

        private static List<DsgdRow> ParseDSGD(byte[] buffer)
        {
            List<DsgdRow> result = new List<DsgdRow>();
            using (MemoryStream stream = new MemoryStream(buffer))
            using (ExcelPackage package = new ExcelPackage(stream))
            {
                ExcelWorksheet worksheet = package.Workbook.Worksheets.FirstOrDefault();
                if (worksheet == null)
                    throw new Exception("Không tìm thấy sheet nào trong file DSGD.xlsx");

                if (worksheet.Dimension == null) return result;

                int rowCount = worksheet.Dimension.Rows;
                int colCount = worksheet.Dimension.Columns;
                if (rowCount < 2) return result;

                List<string> header = new List<string>();
                for (int col = 1; col <= colCount; col++)
                {
                    header.Add(worksheet.Cells[1, col].Text.Trim());
                }

                int maLenhIdx = header.IndexOf("Mã lệnh");
                int maTKGDIdx = header.IndexOf("Mã TKGD");
                int maHDIdx = header.IndexOf("Mã HĐ");
                int klGiaoDichIdx = header.IndexOf("KL giao dịch");
                int giaKhopIdx = header.IndexOf("Giá khớp");
                int ngayGioIdx = header.IndexOf("Ngày giờ thực hiện");

                if (maLenhIdx == -1 || maTKGDIdx == -1 || maHDIdx == -1 || klGiaoDichIdx == -1 || giaKhopIdx == -1)
                {
                    throw new Exception("Thiếu cột bắt buộc trong file DSGD.xlsx (Mã lệnh, Mã TKGD, Mã HĐ, KL giao dịch, Giá khớp)");
                }

                for (int row = 2; row <= rowCount; row++)
                {
                    string maLenh = worksheet.Cells[row, maLenhIdx + 1].Text.Trim();
                    string maTKGD = GetNormalizedAccount(worksheet.Cells[row, maTKGDIdx + 1].Text.Trim());
                    string maHD = worksheet.Cells[row, maHDIdx + 1].Text.Trim();

                    decimal klGiaoDich = ParseCellValueDecimal(worksheet.Cells[row, klGiaoDichIdx + 1]);
                    decimal giaKhop = ParseCellValueDecimal(worksheet.Cells[row, giaKhopIdx + 1]);

                    string ngayGio = ngayGioIdx != -1 ? worksheet.Cells[row, ngayGioIdx + 1].Text.Trim() : "";

                    if (string.IsNullOrEmpty(maLenh) || string.IsNullOrEmpty(maTKGD) || string.IsNullOrEmpty(maHD))
                        continue;

                    result.Add(new DsgdRow
                    {
                        MaLenh = maLenh,
                        MaTKGD = maTKGD,
                        MaHD = maHD,
                        KlGiaoDich = klGiaoDich,
                        GiaKhop = giaKhop,
                        NgayGio = ngayGio,
                        CombinedKey = string.Format(CultureInfo.InvariantCulture, "{0}{1}{2}", maTKGD, maHD, FormatPriceForComparison(giaKhop))
                    });
                }
            }
            return result;
        }

        private static List<FrRow> ParseFR(byte[] buffer, DateTime date, List<string> holidays)
        {
            List<FrRow> result = new List<FrRow>();
            using (MemoryStream stream = new MemoryStream(buffer))
            using (ExcelPackage package = new ExcelPackage(stream))
            {
                ExcelWorksheet worksheet = package.Workbook.Worksheets.FirstOrDefault();
                if (worksheet == null) return result;

                if (worksheet.Dimension == null) return result;
                int rowCount = worksheet.Dimension.Rows;
                int colCount = worksheet.Dimension.Columns;
                if (rowCount < 2) return result;

                int headerRowIdx = 1;
                int ordIdx = -1;
                int accountIdx = -1;
                int symbolIdx = -1;
                int qtyIdx = -1;
                int fillPIdx = -1;
                int timeIdx = -1;

                int scanLimit = Math.Min(rowCount, 5);
                for (int r = 1; r <= scanLimit; r++)
                {
                    List<string> rowHeaders = new List<string>();
                    for (int col = 1; col <= colCount; col++)
                    {
                        rowHeaders.Add(worksheet.Cells[r, col].Text.Trim());
                    }

                    int tempOrdIdx = FindHeaderIndex(rowHeaders, "Ord #", new List<string> { "ord", "ord #", "order", "order #", "order number" });
                    int tempAccountIdx = FindHeaderIndex(rowHeaders, "Account", new List<string> { "account", "tk", "tài khoản", "ma tkgd", "account number", "acc" });
                    int tempSymbolIdx = FindHeaderIndex(rowHeaders, "Symbol", new List<string> { "symbol", "ma hd", "mã hợp đồng", "ma hop dong", "contract" });
                    int tempQtyIdx = FindHeaderIndex(rowHeaders, "Qty", new List<string> { "qty", "quantity", "kl", "khối lượng", "volume", "qty." });
                    int tempFillPIdx = FindHeaderIndex(rowHeaders, "Fill P", new List<string> { "fill p", "fill price", "gia khop", "giá khớp", "fill_p", "fillpx", "fill px" });
                    int tempTimeIdx = FindHeaderIndex(rowHeaders, "Time", new List<string> { "time", "thoi gian", "ngày giờ", "ngay gio" });

                    if (tempOrdIdx != -1 && tempAccountIdx != -1 && tempSymbolIdx != -1 && tempQtyIdx != -1 && tempFillPIdx != -1)
                    {
                        headerRowIdx = r;
                        ordIdx = tempOrdIdx;
                        accountIdx = tempAccountIdx;
                        symbolIdx = tempSymbolIdx;
                        qtyIdx = tempQtyIdx;
                        fillPIdx = tempFillPIdx;
                        timeIdx = tempTimeIdx;
                        break;
                    }
                }

                if (ordIdx == -1 || accountIdx == -1 || symbolIdx == -1 || qtyIdx == -1 || fillPIdx == -1)
                {
                    throw new Exception("Thiếu cột bắt buộc trong file CQG FR (Ord #, Account, Symbol, Qty, Fill P)");
                }

                for (int row = headerRowIdx + 1; row <= rowCount; row++)
                {
                    string ord = worksheet.Cells[row, ordIdx + 1].Text.Trim();
                    string account = worksheet.Cells[row, accountIdx + 1].Text.Trim();
                    string symbol = worksheet.Cells[row, symbolIdx + 1].Text.Trim();

                    decimal qty = ParseCellValueDecimal(worksheet.Cells[row, qtyIdx + 1]);
                    decimal fillPVal = ParseCellValueDecimal(worksheet.Cells[row, fillPIdx + 1]);

                    string time = timeIdx != -1 ? worksheet.Cells[row, timeIdx + 1].Text.Trim() : "";

                    if (string.IsNullOrEmpty(ord) || string.IsNullOrEmpty(account) || string.IsNullOrEmpty(symbol))
                        continue;

                    string accountRaw = GetNormalizedAccount(account);
                    string symbolRaw = ConvertLMESymbol(symbol, date, holidays);

                    result.Add(new FrRow
                    {
                        Ord = ord,
                        Account = account,
                        Symbol = symbol,
                        Qty = qty,
                        FillP = fillPVal,
                        Time = time,
                        AccountRaw = accountRaw,
                        CombinedKey = string.Format(CultureInfo.InvariantCulture, "{0}{1}{2}", accountRaw, symbolRaw, FormatPriceForComparison(fillPVal))
                    });
                }
            }
            return result;
        }

        private static StraitsCsvResult ParseStraitsCsv(byte[] buffer)
        {
            string text = Encoding.UTF8.GetString(buffer);
            string[] lines = text.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);
            if (lines.Length == 0)
            {
                throw new Exception("File Straits CSV rỗng");
            }

            string headerLine = lines[0];
            string[] headers = headerLine.Split(',').Select(h => h.Trim().ToLower()).ToArray();
            int buyColIndex = Array.IndexOf(headers, "buy");
            int sellColIndex = Array.IndexOf(headers, "sell");

            if (buyColIndex == -1 || sellColIndex == -1)
            {
                throw new Exception("Không tìm thấy cột 'Buy' hoặc 'Sell' trong file CSV Straits");
            }

            decimal totalVolume = 0;
            for (int i = 1; i < lines.Length; i++)
            {
                string line = lines[i].Trim();
                if (string.IsNullOrEmpty(line)) continue;

                string[] values = line.Split(',');
                if (buyColIndex < values.Length)
                {
                    string buyStr = values[buyColIndex].Replace("\"", "").Trim();
                    decimal buyVal = ParseCqgNumber(buyStr);
                    totalVolume += buyVal;
                }
                if (sellColIndex < values.Length)
                {
                    string sellStr = values[sellColIndex].Replace("\"", "").Trim();
                    decimal sellVal = ParseCqgNumber(sellStr);
                    totalVolume += sellVal;
                }
            }

            return new StraitsCsvResult { TotalVolume = totalVolume };
        }

        private static List<PositionReconItem> ParseTTTTForRecon(byte[] buffer)
        {
            List<PositionReconItem> result = new List<PositionReconItem>();
            using (MemoryStream stream = new MemoryStream(buffer))
            using (ExcelPackage package = new ExcelPackage(stream))
            {
                ExcelWorksheet worksheet = package.Workbook.Worksheets.FirstOrDefault();
                if (worksheet == null) return result;

                if (worksheet.Dimension == null) return result;
                int rowCount = worksheet.Dimension.Rows;
                int colCount = worksheet.Dimension.Columns;
                if (rowCount < 2) return result;

                List<string> header = new List<string>();
                for (int col = 1; col <= colCount; col++)
                {
                    header.Add(worksheet.Cells[1, col].Text.Trim());
                }

                int accountIdx = FindHeaderIndex(header, "Mã TKGD", new List<string> { "Mã tài khoản", "Account", "Mã khách hàng", "Mã KH" });
                int symbolIdx = FindHeaderIndex(header, "Mã HĐ", new List<string> { "Mã hợp đồng", "Symbol", "Mã HH", "Mã hàng hóa" });
                int positionIdx = FindHeaderIndex(header, "KL ròng", new List<string> { "Khối lượng ròng", "Net Position", "Position", "Vị thế ròng", "Trạng thái ròng" });

                int finalAccIdx = accountIdx != -1 ? accountIdx : 7;
                int finalSymIdx = symbolIdx != -1 ? symbolIdx : 9;
                int finalPosIdx = positionIdx != -1 ? positionIdx : 19;

                for (int row = 2; row <= rowCount; row++)
                {
                    string accountRaw = worksheet.Cells[row, finalAccIdx + 1].Text.Trim();
                    string account = GetNormalizedAccount(accountRaw);
                    string symbol = worksheet.Cells[row, finalSymIdx + 1].Text.Trim();

                    decimal position = ParseCellValueDecimal(worksheet.Cells[row, finalPosIdx + 1]);

                    if (string.IsNullOrEmpty(account) || string.IsNullOrEmpty(symbol))
                        continue;

                    result.Add(new PositionReconItem
                    {
                        Account = account,
                        Symbol = symbol,
                        Position = position
                    });
                }
            }
            return result;
        }

        private static List<PositionReconItem> ParsePSForRecon(byte[] buffer, DateTime tradingDate, List<string> holidays)
        {
            List<PositionReconItem> result = new List<PositionReconItem>();
            using (MemoryStream stream = new MemoryStream(buffer))
            using (ExcelPackage package = new ExcelPackage(stream))
            {
                ExcelWorksheet worksheet = package.Workbook.Worksheets.FirstOrDefault();
                if (worksheet == null) return result;

                if (worksheet.Dimension == null) return result;
                int rowCount = worksheet.Dimension.Rows;
                int colCount = worksheet.Dimension.Columns;
                if (rowCount < 2) return result;

                int headerRowIdx = 1;
                int accountIdx = -1;
                int symbolIdx = -1;
                int positionIdx = -1;

                int scanLimit = Math.Min(rowCount, 5);
                for (int r = 1; r <= scanLimit; r++)
                {
                    List<string> rowHeaders = new List<string>();
                    for (int col = 1; col <= colCount; col++)
                    {
                        rowHeaders.Add(worksheet.Cells[r, col].Text.Trim());
                    }

                    int tempAccountIdx = FindHeaderIndex(rowHeaders, "Account", new List<string> { "account", "tk", "tài khoản", "ma tkgd", "account number", "acc" });
                    int tempSymbolIdx = FindHeaderIndex(rowHeaders, "Symbol", new List<string> { "symbol", "ma hd", "mã hợp đồng", "ma hop dong", "contract" });
                    int tempPositionIdx = FindHeaderIndex(rowHeaders, "Position", new List<string> { "net", "kl ròng", "vị thế", "trạng thái ròng", "pl", "profit", "lỗ" });

                    if (tempAccountIdx != -1 && tempSymbolIdx != -1)
                    {
                        headerRowIdx = r;
                        accountIdx = tempAccountIdx;
                        symbolIdx = tempSymbolIdx;
                        if (tempPositionIdx != -1)
                        {
                            positionIdx = tempPositionIdx;
                        }
                        break;
                    }
                }

                if (accountIdx == -1 || symbolIdx == -1)
                {
                    accountIdx = 0;
                    symbolIdx = 3;
                }
                int finalPosIdx = positionIdx != -1 ? positionIdx : 8;

                for (int row = headerRowIdx + 1; row <= rowCount; row++)
                {
                    string accountRaw = worksheet.Cells[row, accountIdx + 1].Text.Trim();
                    string account = GetNormalizedAccount(accountRaw);
                    string symbol = worksheet.Cells[row, symbolIdx + 1].Text.Trim();
                    symbol = ConvertLMESymbol(symbol, tradingDate, holidays);

                    decimal position = ParseCellValueDecimal(worksheet.Cells[row, finalPosIdx + 1]);

                    if (string.IsNullOrEmpty(account) || string.IsNullOrEmpty(symbol))
                        continue;

                    result.Add(new PositionReconItem
                    {
                        Account = account,
                        Symbol = symbol,
                        Position = position
                    });
                }
            }
            return result;
        }

        public static PreEODResult CheckPreEOD(
            PreEODFiles files,
            string acmTradesName,
            DateTime tradingDate,
            List<string> holidays)
        {
            holidays = holidays ?? new List<string>();

            DateTime d = tradingDate.AddDays(-1);
            while (d.DayOfWeek == DayOfWeek.Saturday || d.DayOfWeek == DayOfWeek.Sunday)
            {
                d = d.AddDays(-1);
            }
            string expectedDateStr = string.Format("{0:D2}{1:D2}{2}", d.Day, d.Month, d.Year);

            if (!string.IsNullOrEmpty(acmTradesName) && !acmTradesName.Contains(expectedDateStr))
            {
                throw new Exception(string.Format("File ACM Trades ({0}) không đúng ngày T-1 ({1:D2}/{2:D2}/{3}). Vui lòng kiểm tra lại.", acmTradesName, d.Day, d.Month, d.Year));
            }

            List<DsgdRow> dsgdData = ParseDSGD(files.Dsgd);
            decimal totalACM_MS = 0;
            decimal totalCQG_MS = 0;
            foreach (DsgdRow gd in dsgdData)
            {
                if (gd.MaTKGD.EndsWith("A", StringComparison.OrdinalIgnoreCase))
                {
                    totalACM_MS += gd.KlGiaoDich;
                }
                else
                {
                    totalCQG_MS += gd.KlGiaoDich;
                }
            }

            StraitsCsvResult acmStraitsData = ParseStraitsCsv(files.AcmTrades);
            decimal totalACM_Straits = acmStraitsData.TotalVolume;
            decimal differACM = Math.Abs(totalACM_MS - totalACM_Straits);

            List<FrRow> frData = ParseFR(files.CqgFr, tradingDate, holidays);
            decimal totalCQG_FR = 0;
            foreach (FrRow fr in frData)
            {
                if (fr.Symbol != "ZWAZCE")
                {
                    totalCQG_FR += fr.Qty;
                }
            }
            decimal differCQG = Math.Abs(totalCQG_MS - totalCQG_FR);

            List<MismatchedTrade> mismatchedTrades = new List<MismatchedTrade>();

            foreach (FrRow fr in frData)
            {
                if (fr.Symbol == "ZWAZCE") continue;
                bool existsInDSGD = dsgdData.Any(gd => gd.CombinedKey == fr.CombinedKey);
                if (!existsInDSGD)
                {
                    mismatchedTrades.Add(new MismatchedTrade
                    {
                        Source = "CQG",
                        MaLenh = fr.Ord,
                        MaTKGD = fr.AccountRaw,
                        MaHD = fr.Symbol,
                        GiaKhop = fr.FillP,
                        KlGiaoDich = fr.Qty,
                        NgayGio = fr.Time,
                        Reason = "Lệnh CQG không tìm thấy bên M-System"
                    });
                }
            }

            foreach (DsgdRow gd in dsgdData)
            {
                if (gd.MaTKGD.EndsWith("A", StringComparison.OrdinalIgnoreCase)) continue;
                bool existsInFR = frData.Any(fr => fr.CombinedKey == gd.CombinedKey);
                if (!existsInFR)
                {
                    mismatchedTrades.Add(new MismatchedTrade
                    {
                        Source = "MSystem",
                        MaLenh = gd.MaLenh,
                        MaTKGD = gd.MaTKGD,
                        MaHD = gd.MaHD,
                        GiaKhop = gd.GiaKhop,
                        KlGiaoDich = gd.KlGiaoDich,
                        NgayGio = gd.NgayGio,
                        Reason = "Giao dịch M-System không tìm thấy bên CQG"
                    });
                }
            }

            List<PositionReconItem> ttttList = ParseTTTTForRecon(files.Tttt);
            List<PositionReconItem> psList = ParsePSForRecon(files.CqgPs, tradingDate, holidays);

            Dictionary<string, PositionReconItem> msSummary = new Dictionary<string, PositionReconItem>();
            foreach (PositionReconItem item in ttttList)
            {
                if (item.Account.EndsWith("A", StringComparison.OrdinalIgnoreCase)) continue;

                string key = string.Format("{0}_{1}", item.Account, item.Symbol);
                PositionReconItem existing;
                if (msSummary.TryGetValue(key, out existing))
                {
                    existing.Position += item.Position;
                }
                else
                {
                    msSummary[key] = new PositionReconItem
                    {
                        Account = item.Account,
                        Symbol = item.Symbol,
                        Position = item.Position
                    };
                }
            }

            Dictionary<string, PositionReconItem> cqgSummary = new Dictionary<string, PositionReconItem>();
            foreach (PositionReconItem item in psList)
            {
                string key = string.Format("{0}_{1}", item.Account, item.Symbol);
                PositionReconItem existing;
                if (cqgSummary.TryGetValue(key, out existing))
                {
                    existing.Position += item.Position;
                }
                else
                {
                    cqgSummary[key] = new PositionReconItem
                    {
                        Account = item.Account,
                        Symbol = item.Symbol,
                        Position = item.Position
                    };
                }
            }

            List<MismatchedPosition> mismatchedPositions = new List<MismatchedPosition>();
            HashSet<string> allKeys = new HashSet<string>(msSummary.Keys.Union(cqgSummary.Keys));

            foreach (string key in allKeys)
            {
                PositionReconItem ms;
                msSummary.TryGetValue(key, out ms);
                PositionReconItem cqg;
                cqgSummary.TryGetValue(key, out cqg);

                string account = ms != null ? ms.Account : (cqg != null ? cqg.Account : "");
                string symbol = ms != null ? ms.Symbol : (cqg != null ? cqg.Symbol : "");
                decimal msVal = ms != null ? ms.Position : 0;
                decimal cqgVal = cqg != null ? cqg.Position : 0;
                decimal diff = msVal - cqgVal;

                if (Math.Abs(diff) > 0.001m)
                {
                    mismatchedPositions.Add(new MismatchedPosition
                    {
                        Account = account,
                        Symbol = symbol,
                        MsPosition = msVal,
                        CQGPosition = cqgVal,
                        Differ = diff
                    });
                }
            }

            bool passed = (differACM == 0) && (differCQG == 0) && (mismatchedTrades.Count == 0) && (mismatchedPositions.Count == 0);

            return new PreEODResult
            {
                Passed = passed,
                Totals = new PreEODTotals
                {
                    TotalACM_MS = totalACM_MS,
                    TotalACM_Straits = totalACM_Straits,
                    DifferACM = differACM,
                    TotalCQG_MS = totalCQG_MS,
                    TotalCQG_FR = totalCQG_FR,
                    DifferCQG = differCQG
                },
                MismatchedTrades = mismatchedTrades,
                MismatchedPositions = mismatchedPositions
            };
        }

        static void Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            Console.WriteLine("================================================================================");
            Console.WriteLine("CHAY TRUC TIEP MA C# GOC CUA CheckPreEOD VOI DU LIEU NGAY 25/09/2026");
            Console.WriteLine("================================================================================");

            string baseDir = @"C:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Pictures\Dữ liệu chuẩn ngày 25";
            string dsgdPath = Path.Combine(baseDir, @"25.09 MS\DSGD.xlsx");
            string ttttPath = Path.Combine(baseDir, @"25.09 MS\TTTT.xlsx");
            string acmPath = Path.Combine(baseDir, @"25.09 ACM\EOD FO trades_PT Straits Financial Indonesia - 10017890000_25092026.csv");
            string frPath = Path.Combine(baseDir, @"25.09 CQG\FR.xlsx");
            string psPath = Path.Combine(baseDir, @"25.09 CQG\PS.xlsx");

            PreEODFiles files = new PreEODFiles
            {
                Dsgd = File.ReadAllBytes(dsgdPath),
                AcmTrades = File.ReadAllBytes(acmPath),
                CqgFr = File.ReadAllBytes(frPath),
                Tttt = File.ReadAllBytes(ttttPath),
                CqgPs = File.ReadAllBytes(psPath)
            };

            string acmName = Path.GetFileName(acmPath);
            DateTime tradingDate = new DateTime(2026, 9, 28);

            Console.WriteLine("Dang thuc thi CheckPreEOD bang ma C# goc...");
            System.Diagnostics.Stopwatch sw = System.Diagnostics.Stopwatch.StartNew();
            PreEODResult res = CheckPreEOD(files, acmName, tradingDate, null);
            sw.Stop();

            Console.WriteLine();
            Console.WriteLine("================================================================================");
            Console.WriteLine(string.Format("KET QUA DOI CHIEU TU MA C# GOC (Thoi gian: {0} ms)", sw.ElapsedMilliseconds));
            Console.WriteLine("================================================================================");
            Console.WriteLine(string.Format("• Passed Status : {0}", res.Passed));

            Console.WriteLine();
            Console.WriteLine("--- 1. TONG HOP KHOI LUONG GIAO DICH (C#) ---");
            Console.WriteLine(" [ACM / Tu Doanh]");
            Console.WriteLine(string.Format("   - M-System MS (duoi A) : {0:N0} lot", res.Totals.TotalACM_MS));
            Console.WriteLine(string.Format("   - ACM Straits (file CSV): {0:N0} lot", res.Totals.TotalACM_Straits));
            Console.WriteLine(string.Format("   - Chenh lech ACM        : {0:N0} lot", res.Totals.DifferACM));

            Console.WriteLine(" [CQG / Khach Hang Thuong]");
            Console.WriteLine(string.Format("   - M-System MS (khac A) : {0:N0} lot", res.Totals.TotalCQG_MS));
            Console.WriteLine(string.Format("   - CQG FR (tru ZWAZCE)  : {0:N0} lot", res.Totals.TotalCQG_FR));
            Console.WriteLine(string.Format("   - Chenh lech CQG        : {0:N0} lot", res.Totals.DifferCQG));

            Console.WriteLine();
            Console.WriteLine("--- 2. CHI TIET LENH LECH KHOP LENH (C#) ---");
            Console.WriteLine(string.Format("• So luong lenh lech: {0}", res.MismatchedTrades.Count));
            if (res.MismatchedTrades.Count > 0)
            {
                foreach (MismatchedTrade t in res.MismatchedTrades.Take(10))
                {
                    Console.WriteLine(string.Format("  - [{0}] TK: {1}, HD: {2}, Gia: {3}, Qty: {4} : {5}", t.Source, t.MaTKGD, t.MaHD, t.GiaKhop, t.KlGiaoDich, t.Reason));
                }
                if (res.MismatchedTrades.Count > 10)
                {
                    Console.WriteLine(string.Format("  ... va con {0} lenh lech khac", res.MismatchedTrades.Count - 10));
                }
            }
            else
            {
                Console.WriteLine("OK! Khong co lenh lech nao giua MS va CQG!");
            }

            Console.WriteLine();
            Console.WriteLine("--- 3. CHI TIET LECH VI THE TAT TOAN NET (C#) ---");
            Console.WriteLine(string.Format("• So vi the net lech: {0}", res.MismatchedPositions.Count));
            if (res.MismatchedPositions.Count > 0)
            {
                foreach (MismatchedPosition p in res.MismatchedPositions)
                {
                    Console.WriteLine(string.Format("  - TK: {0} | HD: {1} | MS: {2} | CQG: {3} | Lech: {4}", p.Account, p.Symbol, p.MsPosition, p.CQGPosition, p.Differ));
                }
            }
            else
            {
                Console.WriteLine("OK! Khong co lech vi the net!");
            }

            Console.WriteLine();
            Console.WriteLine("================================================================================");
            Console.WriteLine("HOAN TAT KIEM TRA C#");
            Console.WriteLine("================================================================================");
        }
    }
}
