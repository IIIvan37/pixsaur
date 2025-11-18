export interface ScrDskTemplateOptions {
  scrBinFilename: string
  scrLabel: string
  dskFilename: string
  screenFilename: string
}

export function generateScrDskTemplate(options: ScrDskTemplateOptions): string {
  const { scrBinFilename, scrLabel, dskFilename, screenFilename } = options

  return `
${scrLabel}:
    incbin "${scrBinFilename}"
${scrLabel}_end:

    SAVE '${screenFilename}', ${scrLabel}, ${scrLabel}_end - ${scrLabel}, DSK, '${dskFilename}'
  `
}
