// TODO: Integration test for ExportPanel (requires mocking preview atom)
// Note: previewImageAtom is used by ExportPanel but it's an async read-only atom
// so we don't attempt to set it in unit tests here. Integration tests can use
// a custom store to override async atom values if necessary.
// import ExportPanel from './export-panel'

vi.mock('@/components/ui/icon')

describe('ExportPanel', () => {
  it.todo('disables the export button when no image is selected')

  // TODO: Add integration test that sets preview image atoms and asserts enabling behavior
})
