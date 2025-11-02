#!/usr/bin/env bash 

clear

echo DL file for create appimage
if [ -f appimagetool-x86_64.AppImage ]; then
	echo done.
	echo 
else
	wget -q https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage
	chmod +x appimagetool-x86_64.AppImage
	echo done.
	echo
fi

echo DL last version .deb pixsaur
curl -s https://api.github.com/repos/IIIvan37/pixsaur/releases/latest \
| grep "browser_download_url.*deb" \
| cut -d : -f 2,3 \
| tr -d \" \
| wget -qi - -P work
echo done.
echo

echo extract file .deb in work/deb
ar x work/*.deb --output work/deb
echo done.
echo

echo extract file data.tar.gz :
tar -xzf work/deb/data.tar.gz -C work/deb
echo done.
echo

echo 'copy pri-ogram file "pixsaur" in work/pixsaur'
mkdir -p work/pixsaur/usr/bin
cp work/deb/usr/bin/pixsaur work/pixsaur/usr/bin/pixsaur
echo done.
echo

echo copy all files from work/src/ to work/pixsaur/
cp work/src/* work/pixsaur/
echo done.
echo

echo Retrieve the version number of the .deb file
ver=$(ls work/*.deb | cut -d _ -f2)
echo done.
echo

echo add of the version number of the pixsaur.desktop file : ${ver}
echo X-AppImage-Version=v${ver} >> work/pixsaur/pixsaur.desktop
echo done.
echo

echo create appimage file
ARCH=x86_64 ./appimagetool-x86_64.AppImage work/pixsaur pixsaur_${ver}_amd64.appimage
echo done.
echo

echo chmod appimage file
chmod +x pixsaur_${ver}_amd64.appimage
echo done.
echo

echo clear folders
rm -rf work/deb/*
rm -rf work/pixsaur/*
rm -rf work/pixsaur/.DirIcon
rm work/*.deb
echo done.
echo

echo to run : ./pixsaur_${ver}_amd64.appimage
