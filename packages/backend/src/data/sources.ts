export interface SourceDescriptor {
  id: string;
  name: string;
  type: string;
  path: string;
}

export const mockSources: SourceDescriptor[] = [
  {
    id: 'src-1',
    name: 'Primary Pharmacodynamics Study.pdf',
    type: 'pdf',
    path: 'studies/primary-pharmacodynamics.pdf'
  },
  {
    id: 'src-2',
    name: 'Secondary Pharmacodynamics.xlsx',
    type: 'spreadsheet',
    path: 'studies/secondary-pharmacodynamics.xlsx'
  },
  {
    id: 'src-3',
    name: 'Safety Pharmacology Summary.docx',
    type: 'document',
    path: 'reports/safety-pharmacology-summary.docx'
  }
];
