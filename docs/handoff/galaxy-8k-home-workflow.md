# 主银河 8K 家庭工作流交接

## 当前稳定状态

- 当前接入分支：`poc/galaxy-h1-video-integration`
- 方案 D 稳定 Commit：`2d1c449f6537b5154d79ac2cdf38067d8713b490`
- 主银河 V2.4 稳定 Commit：`3195f1410d767effa250a8b476fa73506127dccd`
- H1 脚本与实验备份分支：`wip/galaxy-hybrid-h1-20260717`
- H1 WIP Commit：`4283e230b89d68d47fe1fe8f605e2f550bd08c61`
- 当前正常首页在本分支默认显示 H1-HD + 方案 D；`?galaxyComposition=classic` 回退 H1 经典构图，`?galaxyVersion=v24` 回退稳定 V2.4。

## 当前 H1-HD 视频

- 项目路径：`public/videos/hero/galaxy/h1-galaxy-alpha-hd.webm`
- SHA-256：`7E3FEAE3D9D35C52BBD3541DDF26AB7FC6CDE5C3102CADF93F600D7E72F6BDA9`
- 编码：VP9 Alpha
- 分辨率：1920×1080
- 时长：8 秒
- 帧率：24 FPS

## 清晰度诊断结论

- 银河 Alpha 有效边界约为 1103×682 像素。
- Alpha 有效面积约占画布 24.71%，透明留白约占 75.29%。
- 方案 D 在 1920×1080 页面中的投影约为 2598.6×1338.8 像素。
- 每个 H1-HD 有效源像素约对应 2.356×1.963 个屏幕像素。
- 主因是有效源分辨率不足、透明画布利用率偏低以及方案 D 放大；VP9 编码损失属于次要因素。
- H1 清晰度 V0.3 的代码差异与静态诊断已归档到项目外：`C:\Users\Administrator\Documents\ActiveTheory-H1-Sharpness-V03-Archive\`。

## 方案 D 锁定参数

- Scale：`1.296`
- Position：`[0.46, 0.186, 0.018]`
- Z Rotation：`0°`
- 核心屏幕位置：约 X `84.1%`、Y `35.0%`
- 右侧超屏：约 `38%`
- 顶部超屏：约 `36%`

上述构图参数不可通过缩小银河来换取清晰度；8K母版及后续视频必须在完全相同的屏幕位置、大小和裁切下验证。

## 家庭电脑下一步

目标环境：RTX 5060 Ti 16GB、32GB 内存。

1. 建立可信的AI超分环境，只使用官方或可信开源仓库与模型权重；优先评估 Real-ESRGAN、SwinIR 或同等级真正高频重建方案。
2. 不允许仅用 Lanczos、Bicubic 或其他普通插值生成“8K母版”。普通插值只可作为基线对照。
3. 从当前E2/H1结构生成两个8192×8192 RGBA候选：
   - Candidate A：结构保持型真实超分，优先保留E2双主旋臂、暖金核心和尘埃方向。
   - Candidate B：Candidate A + Blender H1三维星尘、核心粒子与外围星尘细节，不能改变E2主体轮廓。
4. 使用 `python tools/validateGalaxyMaster.py <input PNG>` 检查尺寸、Alpha安全区、主体占比、亮度和矩形边缘。
5. 在方案 D 完全相同的位置、大小和裁切下制作静态 A/B 对比；同时检查核心、旋臂、尘埃与外围星尘的200%近景。
6. 只有静态候选通过视觉确认后，才渲染完整8秒、24 FPS、4K透明WebM；保留现有H1-HD文件，不覆盖。

## 家庭工作禁止事项

- 不修改方案 D 的 Scale、Position、Rotation、核心位置或超屏比例。
- 不创建新的银河视觉方向，不改变E2/H1双旋臂身份。
- 不返回纯粒子路线或六层平行Plane路线。
- 不覆盖 `public/videos/hero/galaxy/h1-galaxy-alpha-hd.webm`。
- 不直接在 `hero-v2-visual`、`main` 或其他稳定分支上开发。
- 静态8K候选未通过前，不渲染完整8秒4K透明视频。
- 不把普通插值放大、CSS/Shader锐化或高码率编码当作高频细节重建。
