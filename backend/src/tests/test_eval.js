const vm = require('vm');

const formulas = [
  'Math.Round(NewMargin * ScalingFactor * 1.1, 0)',
  'Math.Round(NewMaintenance * 1.1, 0)',
  'SPANPriceScanRange',
  'Math.Round(NewAppliedMarginRate / 10m, 0) * 10m * 1.1m',
  'Math.Round((decimal)NewAppliedMarginRate, 0, MidpointRounding.AwayFromZero) * 1.1m',
  'Math.Round(NewAppliedMarginRate * 1.1, 0)',
  'BPL',
  'InitialMargin',
  'PerLot'
];

function cleanFormula(f) {
  return f
    .replace(/\b(\d+(\.\d+)?)m\b/gi, '$1')
    .replace(/\(decimal\)/g, '')
    .replace(/,\s*MidpointRounding\.AwayFromZero/gi, '')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*\)/g, ')')
    .replace(/Math\.Round/g, 'round');
}

function evalFormula(f, ctx) {
  const cleaned = cleanFormula(f);
  let js = cleaned;
  for (const [k, v] of Object.entries(ctx)) {
    const regex = new RegExp(`\\b${k}\\b`, 'g');
    js = js.replace(regex, v);
  }
  const sandbox = {
    Math,
    round: (val, dec = 0) => {
      const fac = Math.pow(10, dec);
      return Math.round(val * fac) / fac;
    }
  };
  return vm.runInNewContext(js, sandbox);
}

const ctx = {
  NewMargin: 1000,
  ScalingFactor: 1,
  NewMaintenance: 900,
  SPANPriceScanRange: 800,
  NewAppliedMarginRate: 752,
  BPL: 600,
  InitialMargin: 500,
  PerLot: 400
};

formulas.forEach(f => {
  console.log('Original:', f);
  console.log('Cleaned: ', cleanFormula(f));
  console.log('Result:  ', evalFormula(f, ctx));
  console.log('---');
});
