enum TraceLine {
  ConfigResolved = '[crucible:debug] config resolved: provider "openrouter"',
  CompatibleConfigResolved = '[crucible:debug] config resolved: provider "openai-compatible"',
  ProviderRequest = 'provider request attempt 1 to "openrouter"',
  CompatibleProviderRequest = 'provider request attempt 1 to "openai-compatible"',
  VerdictTrue = 'judge verdict true',
  ExtractionFor = 'for extract',
}

export { TraceLine };
