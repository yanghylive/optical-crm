@echo off
chcp 65001 >nul
title 配镜 CRM 轻量版
cd /d "%~dp0app"
echo.
echo   正在启动 配镜 CRM 轻量版 ...
echo.
echo   本机访问：  http://localhost:3000
echo   同一 WiFi 下的手机 / 收银机，用下面的地址：
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=* delims= " %%b in ("%%a") do echo               http://%%b:3000
)
echo.
echo   首次使用请先双击「开放局域网访问.bat」放行防火墙。
echo   关闭本窗口即可停止服务。
echo.
node server.js
pause
