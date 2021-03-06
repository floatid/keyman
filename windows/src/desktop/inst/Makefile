#
# Keyman installation builder Makefile
#

!include ..\..\Defines.mak

# ----------------------------------------------------------------------

DESKTOP_FILES=keymandesktop.wixobj desktopui.wixobj cef.wixobj locale.wixobj

manual-setup: check setup

setup: desktop

prereq: prereq-resources
    #
    # Prepare make file to copy versioned filenames to release folder
    #

    cd $(ROOT)\src\desktop\inst
    $(MKVER_U) download.in download.mak

prereq-resources:
    #
    # Create resource dll
    #
    rc desktop_resources.rc
    $(LINKPATH) /DLL /OUT:desktop_resources.dll /RELEASE /NOENTRY /MACHINE:X86 desktop_resources.RES
    $(SIGNCODE) /d "Keyman Desktop Resources" desktop_resources.dll

desktop: prereq
    $(MAKE) -fdownload.mak candle
    $(WIXLIGHT) -dWixUILicenseRtf=License.rtf -out keymandesktop.msi -ext WixUIExtension $(DESKTOP_FILES)
    $(SIGNCODE) /d "Keyman Desktop" keymandesktop.msi
    # TODO: replace buildpkg with kmcomp and remove buildpkg from repository
    $(ROOT)\bin\buildtools\buildpkg -m keymandesktop.msi -s $(ROOT)\bin\desktop -l license.html
    $(SIGNCODE) /d "Keyman Desktop" keymandesktop.exe
    $(MAKE) -fdownload.mak copyredist-desktop

clean:
    cd $(ROOT)\src\desktop\inst
    if exist download.mak $(MAKE) -fdownload.mak clean
    -del /Q *.msi
    -del /Q *.msp
    -del /Q *.exe
    -del /Q *.wixobj
    -del /Q *.log
    -del /Q *.pcp
    -del /Q download.mak
    -del /Q desktop_resources.dll
    -del /Q desktop_resources.res
    -del /Q desktopui.wxs
    -del /Q cef.wxs
    -del /Q locale.wxs

check:
    if not exist $(ROOT)\src\engine\inst\keymanengine.msm $(MAKE) check-engine
    if not exist $(ROOT)\src\global\inst\data\unicodedata.mdb $(MAKE) check-unicodedata


check-engine:
    cd $(ROOT)\src\engine\inst
    $(MAKE)

check-unicodedata:
    cd $(ROOT)\src\global\inst
    $(MAKE)

# ----------------------------------------------------------------------

!include ..\..\Target.mak

# ----------------------------------------------------------------------
# EOF
# ----------------------------------------------------------------------
