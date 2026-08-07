import { createDataCenterShell } from '../dataCenterShell.js';
import './brandMindCenter.css';

const BRAND_MIND_MODULES = Object.freeze([
  '品牌心智TOP',
  '心智维度',
  '行业机会',
  '品牌覆盖',
  '强化机会',
  '拓展机会'
]);

export function createBrandMindCenter({ definition, onRequestClose }) {
  return createDataCenterShell({
    definition,
    eyebrow: 'Brand Mind Intelligence',
    statusMessage: '品牌心智数据契约准备中',
    moduleLabels: BRAND_MIND_MODULES,
    onRequestClose
  });
}
