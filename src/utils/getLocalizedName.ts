/**
 * Pick a localized name from a record that may have name_ar/nameAr/name_en/nameEn
 * columns, falling back through the other language and then any available name.
 * Pure renderer helper — never invents a value.
 */
export const getLocalizedName = (
  record: any,
  lang: 'ar' | 'en' = 'ar'
): string => {
  if (!record) return ''
  const ar =
    record.name_ar ?? record.nameAr ?? record.nameArabic ?? record.nameAR ?? null
  const en =
    record.name_en ?? record.nameEn ?? record.nameEnglish ?? record.nameEN ?? null
  const generic = record.name ?? record.title ?? record.label ?? null

  if (lang === 'ar') {
    return ar || en || generic || ''
  }
  return en || ar || generic || ''
}