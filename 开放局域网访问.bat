@echo off
chcp 65001 >nul
title 开放局域网访问（配镜 CRM）

:: ---- 自动申请管理员权限（会弹一次 UAC，点“是”）----
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo 需要管理员权限来放行防火墙，正在申请...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo.
echo   正在为 配镜 CRM 放行 TCP 3000 端口（仅专用/域网络，公用网络不放行）...
echo.

netsh advfirewall firewall delete rule name="OpticalCRM-3000" >nul 2>&1
netsh advfirewall firewall add rule name="OpticalCRM-3000" dir=in action=allow protocol=TCP localport=3000 profile=private,domain

echo.
echo   完成。同一 WiFi 下的手机 / 收银机 / 平板，用浏览器打开下面的地址：
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=* delims= " %%b in ("%%a") do echo     http://%%b:3000
)
echo.
echo   登录密码与本机相同。若打不开，请确认两台设备连的是同一个路由器/WiFi。
echo.
pause
