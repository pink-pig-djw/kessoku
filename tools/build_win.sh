#!/bin/bash
# 一键打包 Windows 版：素材转 WebP → 复制进 desktop/www → electron-builder 打成安装程序 + 免安装 zip → 复制到 dist/
# usage: bash tools/build_win.sh
set -e
cd "$(dirname "$0")/.."
export ELECTRON_MIRROR="${ELECTRON_MIRROR:-https://npmmirror.com/mirrors/electron/}"
export ELECTRON_BUILDER_BINARIES_MIRROR="${ELECTRON_BUILDER_BINARIES_MIRROR:-https://npmmirror.com/mirrors/electron-builder-binaries/}"
node tools/build_app.js
rm -rf desktop/www && cp -r app/www desktop/www
# 图标：一里的脸（512×512 圆角方形），窗口图标和 exe 图标共用
node -e "
const sharp=require('./app/node_modules/sharp');
(async()=>{const [cx,cy,s]=[592,240,380];
const face=await sharp('assets/ch/bocchi_smile.png').extract({left:cx-s/2,top:cy-s/2+10,width:s,height:s}).resize(470,470).toBuffer();
const mask=Buffer.from('<svg width=\"512\" height=\"512\"><rect width=\"512\" height=\"512\" rx=\"112\" fill=\"#fff\"/></svg>');
const sq=await sharp({create:{width:512,height:512,channels:4,background:'#1d2033'}}).composite([{input:face,left:21,top:31}]).png().toBuffer();
const icon=await sharp(sq).composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
require('fs').mkdirSync('desktop/build',{recursive:true});
await sharp(icon).toFile('desktop/build/icon.png'); await sharp(icon).resize(256,256).toFile('desktop/www/icon.png');})();"
cd desktop
rm -rf release
npx electron-builder --win nsis zip --x64
cd ..
mkdir -p dist
cp "desktop/release/"*.exe dist/ && cp "desktop/release/"*.zip dist/
ls -la dist/
