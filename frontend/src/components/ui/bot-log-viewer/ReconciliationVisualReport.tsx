import React from 'react';
import { ParsedBotData } from './types';
import { PreEodReconciliationVisualReport } from './PreEodReconciliationVisualReport';
import { KlgdReconciliationVisualReport } from './KlgdReconciliationVisualReport';
import { SodReconciliationVisualReport } from './SodReconciliationVisualReport';

interface ReconciliationVisualReportProps {
  parsedData: ParsedBotData;
  activeStatus: string;
}

export const ReconciliationVisualReport: React.FC<ReconciliationVisualReportProps> = ({ parsedData, activeStatus }) => {
  if (parsedData.jsonType === 'PRE_EOD') {
    return <PreEodReconciliationVisualReport parsedData={parsedData} activeStatus={activeStatus} />;
  }
  if (parsedData.jsonType === 'CQG') {
    return <SodReconciliationVisualReport parsedData={parsedData} activeStatus={activeStatus} />;
  }
  return <KlgdReconciliationVisualReport parsedData={parsedData} activeStatus={activeStatus} />;
};

