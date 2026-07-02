const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const cmePdfPath = path.resolve(__dirname, '../../it-tool-src/margin-checker/margin-checker/bin/Debug/Input/Ky quy thay doi - Input/Ky quy thay doi - Input/CME/CME PDF.pdf');
const bursaPdfPath = path.resolve(__dirname, '../../it-tool-src/margin-checker/margin-checker/bin/Debug/Input/Ky quy thay doi - Input/Ky quy thay doi - Input/Bursa/Bursa PDF.pdf');

async function test() {
  try {
    const cmeBuffer = fs.readFileSync(cmePdfPath);
    const pdf = new PDFParse();
    await pdf.load(cmeBuffer);
    const text = pdf.getText();
    console.log('CME PDF characters:', text.length);
    
    const regex = /^([A-Z]{2,5}).*?\bUSD\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)/gm;
    let match;
    let count = 0;
    while ((match = regex.exec(text)) !== null) {
      console.log(`CME Match: CC=${match[1]}, Maint=${match[5]}`);
      count++;
      if (count > 5) break;
    }

    const bursaBuffer = fs.readFileSync(bursaPdfPath);
    const bursaPdf = new PDFParse();
    await bursaPdf.load(bursaBuffer);
    const bursaText = bursaPdf.getText();
    console.log('Bursa PDF characters:', bursaText.length);
    const bursaLines = bursaText.split('\n').map(l => l.trim()).filter(Boolean);
    let inTable = false;
    let bursaCount = 0;
    for (const line of bursaLines) {
      if (line.toLowerCase().startsWith('commodity')) {
        inTable = true;
        continue;
      }
      if (inTable && line.toLowerCase().startsWith('cpo intracommodity')) {
        inTable = false;
        break;
      }
      if (inTable) {
        console.log('Bursa Line:', line);
        bursaCount++;
        if (bursaCount > 5) break;
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
