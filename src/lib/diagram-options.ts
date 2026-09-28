// Shared fixed-option lists for the properties form dropdowns. UML
// notation / type names, intentionally untranslated (they are notation, not
// UI chrome); the "None" option label is translated in the sidebar via the
// `properties.none` key and uses the empty string as its value.

export const ATTRIBUTE_TYPE_OPTIONS = [
  'int',
  'boolean',
  'byte',
  'char',
  'double',
  'float',
  'long',
  'short',
] as const;

export const MULTIPLICITY_OPTIONS = [
  '*',
  '0',
  '0..*',
  '0..1',
  '1',
  '1..*',
] as const;
