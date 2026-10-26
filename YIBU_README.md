# 一步 · 研究行动 Android 构建

此分支在原有服药记录项目之外增加「一步」研究 App 的独立构建。

- 源码与 Android 工程：`yibu-source.zip`，解压后为 `yibu/`。
- 打包流程：`.github/workflows/yibu-android.yml`，显示名 **Build Yibu Android APK**。
- 推送本分支的新版本源码包会自动打包；原有服药记录文件与流程保留。
- 构建成功后，进入 Actions 对应运行，在 Artifacts 下载 **yibu-debug-apk**，其中的 `yibu-debug.apk` 可传到 Android 手机上安装。
- 这是自用调试包；系统通知与后台行为仍需在真机验收。长期更新应改用固定签名，先备份再升级。
- 详细使用、隐私与备份、环境要求、打包说明见源码包中的 `README.md` 与 `VALIDATION.md`。

源码包不包含本机研究任务或日志数据。网页版和 APK 的本地数据各自独立，可用 App 内备份迁移。
