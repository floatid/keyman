#
# KMAnalyze Makefile
#

!include ..\..\Defines.mak

build: version.res dirs
    $(MSBUILD) kmanalyze.sln $(MSBUILD_BUILD)
    $(COPY) $(TARGET_PATH)\kmanalyze.exe $(PROGRAM)\developer

clean: def-clean
    $(MSBUILD) kmanalyze.sln $(MSBUILD_CLEAN)

signcode:
    $(SIGNCODE) /d "Keyman Developer Keyboard Analyzer" $(PROGRAM)\developer\kmanalyze.exe

backup:
    $(WZZIP) $(BUILD)\developer\kmanalyze.exe $(BACKUPDEFAULTS) kmanalyze.exe

test-manifest:
    @rem 

#install:
#    $(COPY) $(PROGRAM)\developer\kmanalyze.exe "$(INSTALLPATH_KEYMANDEVELOPER)\kmanalyze.exe"
    
!include ..\..\Target.mak
