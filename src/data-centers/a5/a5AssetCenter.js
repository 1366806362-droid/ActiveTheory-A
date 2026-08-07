import { createDataCenterShell } from '../dataCenterShell.js';
import './a5AssetCenter.css';

const A5_MODULES = Object.freeze([
  '5A资产结构',
  '5A流转路径',
  '八大人群',
  '竞品方向优势',
  '人群机会'
]);

export function createA5AssetCenter({ definition, onRequestClose }) {
  return createDataCenterShell({
    definition,
    eyebrow: 'Audience Asset Intelligence',
    statusMessage: '数据契约准备中',
    moduleLabels: A5_MODULES,
    onRequestClose
  });
}
