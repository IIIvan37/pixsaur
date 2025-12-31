# Makefile for scr-classic-raster
# Assembles main.asm using RASM

# Configuration
ASM = rasm
SRC = main.asm
DIST = dist
OUTPUT = $(DIST)/serval
EMU = /Users/ivanduchauffour/iiivan/AceDL.app/Contents/MacOS/AceDL
# RASM options
# -o: common radix for all files
ASM_FLAGS = -o $(OUTPUT)

.PHONY: all clean

all: $(OUTPUT)

$(OUTPUT): $(SRC) | $(DIST)
	$(ASM) $(SRC) $(ASM_FLAGS)

$(DIST):
	mkdir -p $(DIST)

clean:
	rm -rf $(DIST)/*

run: $(OUTPUT)
	$(EMU) $(OUTPUT).sna
	@echo "Snapshot generated: $(OUTPUT).sna" -alone
