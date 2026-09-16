# 品牌心智核心通透/层次实验：未达到视觉要求

## 起点与范围

Before: `87dcfb5084c6ece69b0781bdfec7b6830c156e1b`。
Fetch 后共同基线仍是 `58259cf5d173110221145104b9c9dcacbbe5595d`，已包含在 Before 历史中。
独立分支 `feat/brandmind-core-depth-clarity`，未修改共同 Master、其他 worktree 或默认场景。
仅修改既有体积材质，增加候选选择、诊断、测试及重跑脚本；不增加渲染系统。

## 查证的问题

- Core 实际进入 1600×900 linear HalfFloat Composer target；Canvas 1600×900，DPR1。
  没有低分辨率 Core 中间图被放大的过程。
- 关闭 Bloom，旧版仍是平滑浑浊物体。固定 ROI 的 Bloom 开关像素平均差异小于
  0.003/255；不能将本轮问题归因于 Bloom 模糊。
- 原密度包含包围体内基础填充与两片贯穿介质，内光又乘以密度相关 band。
  内光诊断和密度切片显示内光与遮挡重合，局部吸收过强。
- 对原始线性渲染目标进行透过率读回（不是从 ACES 截图推算）：
  Before 有效灰度采样 87156，T 中位数约 0.1891、P10 0.03955，34.40% 的 T<0.1。
  After 有效采样 94314，T 中位数约 0.9370、P10 0.8203，T<0.1 为 0。
  两者透明边缘支持范围不同，不能把这些统计当作逐像素视觉评分。
- Three r185 的非 XR offscreen program 不应用材质 tone mapping，输出使用 working
  space；OutputPass 统一完成 ACES/display transfer。未发现重复颜色变换证据。
- 新候选 24/40 步同 ROI 的平均绝对差约 0.07/255；不支持“盲目加步数即可修复”。

## 实现与修正记录

独立发光积分：`L += T * j * (1-exp(-sigma*ds))/sigma`；真空极限为 `T*j*ds`。
密度与 j 不再共用一个权重。保持一个局部包围盒、原尺寸/位置、40步默认及24步对照，
NormalBlending/straight alpha；不实现折射、多次散射或新的体积纹理。

1. A：有限前后中层片状聚合区；B：局部团状聚合区。同一紧凑内光与弱包络。
   两者初稿都更通透，但中层太弱，仍像中心光斑加薄雾。选 A，未整合周边。
2. 修正一：只提高 A 有限中层的局部发光组织，并降低内光高亮。
   中层开始可辨，但边界与前后关系仍太软。
3. 修正二：A 的中层改有限平滑边界，内光加入非对称低发光折缝。
   三处聚合区和间隙可见，但整体变成分散软块，包络体量不足。停止视觉修正。

整数幂采用乘法，避免负底数 GLSL `pow` 的未定义行为；这不是额外美术候选。
开发中一次测试辅助函数误插入 GLSL 模板被 Node import/browser compile gate 捕获，
已移到模块顶层；最终构建和新浏览器实例重新验证，不继承失败运行结果。

## 没有通过的门槛

单核心 **未达到视觉要求**：内光更独立，但不是一个完整、连贯、兼具厚度与通透性的
认知能量体。缩略图中内部仍太小太柔。低密度不能作为降低全部视觉体量的理由。
不能用工程测试通过代替视觉通过；没有恢复节点、关系或旧宽 Halo。

历史六个美术节点/三个关系 ID 保留，canonical mapping 仍是
`NEEDS_STABLE_REGISTRY_HOOK`。没有改模拟数据来匹配画面。

## 验证范围

- 完整 Node 入口 `node tools/fivea-v11-tests.cjs`：49 文件、141 runner tests、
  721 实际用例，0 fail/skip，本轮新增 7。
- `python -m unittest tools/test_earth_hybrid_assets.py tools/test_earth_orbital_assets.py`：6/6。
- `npm run build`、`git diff --check`：通过。Build 仍有既有大 bundle 提示；
  npm ci 提示既有 2 high audit 风险，本轮未擅自升级依赖。
- 浏览器 smoke：HOME、GEO/FiveA/Brand Mind进入返回、两个 Panel 开关、
  A1–A5 scale/energy、四条 flowStrength 均通过。console/runtime 0；
  Canvas/主RAF/Wheel 1/1/1。指针 down 原有2个，未新增。
- HOME Earth Hybrid Hero Lock ready/mix0；HOME、Earth、FiveA、GEO 默认源码均未修改。
- 10秒单核心技术样本，Edge153 / RTX5060Ti /1600×900/DPR1/约120Hz，
  前台窗口、5秒预热、无录屏。精确数据在 `technical.json`。
  Before与After均约120.01FPS，median/P95/P99/max = 8.3/8.5/8.5/8.6ms，
  >50ms与>100ms均0，16全场draw calls（其中Core 1次）。
  这不是60秒最终稳态/交互验收，GPU时间与显存未测量。
- 短片为原生 PNG 帧按真实时间戳编码 MP4，无变速/补粒子/增强。
  固定时间12，QA 在Core draw中临时进行真实透视相机 ±0.10 world X 变化并恢复。
  不是正式鼠标交互验收；不据此宣称全部运动门槛通过。
- 未执行：恢复周边后的完整场景、Panel展开美术适配、60+60秒、10次进出、
  最终全场GPU/Core增量成本、完整视差交互验收。

## 证据与重跑

本机工作区 `C:/Users/COLORFUL/Documents/ActiveTheory-BrandMind-Core-Clarity`。
预览服务端口5199，仅本机：
`/?scene=brandmind&brandMindCoreClarity=A`；Before使用 `brandMindVolumeV12=B`。
默认无参数不启用实验。

`tools/brandmind-clarity-gate.cjs` 模式：diagnosis、candidates、correction、final、
evidence、video、technical。`BRANDMIND_URL` 可指定服务。
correction 模式会捕获当前源码，不会重建历史修正一；历史图保存在本地art。
`python tools/brandmind-clarity-evidence.py` 仅裁切/缩放/排版，不做锐化调色。

证据均在未追踪 `art/brandmind-core-clarity/`，含 overview、before_after、internal、
bloom、small、demo.mp4 和 index.html。正式资源不依赖 art；art/cache 不提交。
此实验 checkpoint 明确 **NOT READY FOR PRODUCTION**，等待用户决定后续路线。
