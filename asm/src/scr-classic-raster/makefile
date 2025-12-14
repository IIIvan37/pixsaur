# Makefile for scr-classic-raster
# Assembles main.asm using RASM

# Configuration
ASM = rasm
SRC = main.asm
DIST = dist
OUTPUT = $(DIST)/serval

# RASM options
# -oi: output snapshot file
ASM_FLAGS = -o $(OUTPUT)

.PHONY: all clean

all: $(OUTPUT)

$(OUTPUT): $(SRC) | $(DIST)
	$(ASM) $(SRC) $(ASM_FLAGS)

$(DIST):
	mkdir -p $(DIST)

clean:
	rm -rf $(DIST)/*

# Run the snapshot in an emulator (optional, adjust path as needed)
run: $(OUTPUT)
	@echo "Snapshot generated: $(OUTPUT)"
