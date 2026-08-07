@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto :node_missing

if not exist "node_modules" (
  where npm.cmd >nul 2>nul
  if errorlevel 1 goto :npm_missing

  echo [Grok Studio Pro] 首次运行，正在安装依赖...
  call npm.cmd install
  if errorlevel 1 goto :install_failed
)

echo [Grok Studio Pro] 正在运行完整单元测试...
echo.
node --experimental-strip-types --test "src/**/*.test.ts"
set "EXIT_CODE=%ERRORLEVEL%"
goto :finish

:node_missing
echo [错误] 未找到 Node.js。请安装 Node.js 22 后重试。
set "EXIT_CODE=1"
goto :finish

:npm_missing
echo [错误] 未找到 npm，无法安装项目依赖。
set "EXIT_CODE=1"
goto :finish

:install_failed
echo [错误] 依赖安装失败，请检查网络和 npm 输出。
set "EXIT_CODE=1"

:finish
if "%EXIT_CODE%"=="0" (
  echo.
  echo [Grok Studio Pro] 全部测试通过。
) else (
  echo.
  echo [Grok Studio Pro] 测试失败，错误码：%EXIT_CODE%
)
if not defined CI pause
exit /b %EXIT_CODE%
