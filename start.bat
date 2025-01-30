@echo off
powershell -ExecutionPolicy Bypass -Command "& {Start-Process PowerShell -ArgumentList '-ExecutionPolicy Bypass -File \"%~dp0install-and-run.ps1\"' -Verb RunAs}"
pause 