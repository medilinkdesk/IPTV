@echo off
title SURAJ IPTV Player
echo ==============================================
echo  Starting SURAJ IPTV Player with CORS Proxy...
echo  Opening http://127.0.0.1:8080 in browser
echo ==============================================
start http://127.0.0.1:8080/
python -u server.py
pause
